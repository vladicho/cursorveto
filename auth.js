const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { createUserStore } = require("./user-store");
const nestingLimits = require("./nesting-limits");

const root = path.join(__dirname, "..");
const dataDir = process.env.MOLDELAB_DATA_DIR || path.join(root, "data");
const cookieName = "moldelab_session";
const tokenTtl = "7d";
const disabled = process.env.MOLDELAB_AUTH_DISABLED === "1";
const allowRegister = process.env.MOLDELAB_ALLOW_REGISTER !== "0";
const adminEmails = new Set(
  String(process.env.MOLDELAB_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

let store;
let bcrypt;
let jwt;

function loadAuthDeps() {
  if (!bcrypt) bcrypt = require("bcryptjs");
  if (!jwt) jwt = require("jsonwebtoken");
}

function jwtSecret() {
  const fromEnv = process.env.MOLDELAB_JWT_SECRET;
  if (fromEnv) return fromEnv;
  if (disabled) return "moldelab-dev-secret";

  ensureDataDir();
  const secretPath = path.join(dataDir, ".jwt-secret");
  if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, "utf8");
  const generated = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(secretPath, generated, { encoding: "utf8", mode: 0o600 });
  console.warn("MOLDELAB_JWT_SECRET nao definido; usando segredo persistido em disco.");
  return generated;
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function initDb() {
  ensureDataDir();
  store = createUserStore(dataDir);
  bootstrapAdmin();
}

function bootstrapAdmin() {
  try {
    const user = syncBootstrapAdmin();
    if (user) console.log(`Administrador inicial: ${user.email}`);
  } catch (error) {
    console.error("Nao foi possivel sincronizar o administrador bootstrap:", error.message);
  }
}

function syncBootstrapAdmin() {
  const email = process.env.MOLDELAB_BOOTSTRAP_EMAIL;
  const password = process.env.MOLDELAB_BOOTSTRAP_PASSWORD;
  if (!email || !password) return null;
  return store.ensureBootstrapAdmin({
    email,
    password,
    name: process.env.MOLDELAB_BOOTSTRAP_NAME || "Administrador",
    hashPassword: (value) => {
      loadAuthDeps();
      return bcrypt.hashSync(value, 12);
    },
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function resolveRole(email) {
  return adminEmails.has(normalizeEmail(email)) ? "admin" : "user";
}

function createUser(name, email, password, options = {}) {
  const normalized = normalizeEmail(email);
  const needsAdmin = !hasApprovedAdmin();
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalized,
    password_hash: (() => {
      loadAuthDeps();
      return bcrypt.hashSync(password, 12);
    })(),
    status: options.status || (needsAdmin ? "approved" : "pending"),
    role: options.role || (needsAdmin ? "admin" : resolveRole(normalized)),
    nesting_usage: {},
    extra_credits: 0,
    created_at: new Date().toISOString(),
    last_login: null,
    total_session_minutes: 0,
    login_count: 0,
  };
  return store.insert(user);
}

function findUserByEmail(email) {
  return store.findByEmail(email);
}

function findUserById(id) {
  if (id === "bootstrap") return bootstrapUser();
  return store.findById(id);
}

function listUsers(statusFilter) {
  const users = store.list(statusFilter || null);
  const bootstrap = bootstrapUser();
  if (bootstrap && !users.some((user) => normalizeEmail(user.email) === bootstrap.email)) {
    if (!statusFilter || bootstrap.status === statusFilter) users.unshift(bootstrap);
  }
  return users;
}

function bootstrapUser() {
  const email = normalizeEmail(process.env.MOLDELAB_BOOTSTRAP_EMAIL);
  if (!email) return null;
  return {
    id: "bootstrap",
    name: process.env.MOLDELAB_BOOTSTRAP_NAME || "Administrador",
    email,
    status: "approved",
    role: "admin",
  };
}

function setUserStatus(userId, status) {
  return store.update(userId, { status });
}

function recordLogin(userId) {
  const user = store.findById(userId);
  if (!user) return;
  store.update(userId, {
    last_login: new Date().toISOString(),
    login_count: (user.login_count || 0) + 1,
  });
}

function getUserDataSize(userId) {
  try {
    const projectsDir = path.join(dataDir, "projects", userId);
    if (!fs.existsSync(projectsDir)) return 0;
    let total = 0;
    const files = fs.readdirSync(projectsDir);
    for (const file of files) {
      try {
        const stat = fs.statSync(path.join(projectsDir, file));
        total += stat.size;
      } catch {}
    }
    return total;
  } catch {
    return 0;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    role: user.role,
  };
}

function publicUserWithMetrics(user) {
  const dataSize = getUserDataSize(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    role: user.role,
    created_at: user.created_at || null,
    last_login: user.last_login || null,
    login_count: user.login_count || 0,
    data_size_bytes: dataSize,
  };
}

function isApproved(user) {
  return user?.status === "approved";
}

function isAdmin(user) {
  return user?.role === "admin" && isApproved(user);
}

function hasApprovedAdmin() {
  return store.list().some((user) => isAdmin(user));
}

function signToken(user) {
  loadAuthDeps();
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret(), { expiresIn: tokenTtl });
}

function verifyToken(token) {
  try {
    loadAuthDeps();
    const payload = jwt.verify(token, jwtSecret());
    return findUserById(payload.sub);
  } catch {
    return null;
  }
}

function parseCookies(request) {
  const header = request?.headers?.cookie || "";
  const cookies = {};
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    cookies[key] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function isSecureRequest(request) {
  if (process.env.RENDER || process.env.NODE_ENV === "production") return true;
  const proto = request.headers["x-forwarded-proto"];
  if (proto) return String(proto).split(",")[0].trim() === "https";
  return false;
}

function setSessionCookie(response, token, request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`,
  );
}

function clearSessionCookie(response, request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function getSessionUser(request) {
  if (disabled) {
    return { id: "dev", name: "Desenvolvimento", email: "dev@moldelab.local", status: "approved", role: "admin" };
  }
  const token = parseCookies(request)[cookieName];
  if (!token) return null;
  return verifyToken(token);
}

function getApprovedUser(request) {
  const user = getSessionUser(request);
  if (!user || !isApproved(user)) return null;
  return user;
}

function isPublicPath(pathname) {
  if (pathname === "/login.html" || pathname === "/login.js") return true;
  if (pathname === "/admin.html" || pathname === "/admin.js") return true;
  if (pathname === "/mobile-scanner.js") return true;
  if (pathname === "/styles.css") return true;
  if (pathname === "/api/health.json") return true;
  if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/register")) return true;
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname.startsWith("/api/auth/me")) return true;
  return false;
}

function sendJson(response, statusCode, payload) {
  if (response.writableEnded || response.headersSent) return true;
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
  return true;
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON invalido"));
      }
    });
    request.on("error", reject);
  });
}

function validateRegistration({ name, email, password }) {
  if (!name || String(name).trim().length < 2) return "Informe seu nome.";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return "Informe um email valido.";
  if (!password || String(password).length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  return null;
}

function loginErrorForStatus(status) {
  if (status === "pending") return "Conta aguardando aprovacao do administrador.";
  if (status === "rejected") return "Conta recusada. Fale com o administrador.";
  return "Conta sem acesso.";
}

function handleAdminApi(request, response, url) {
  if (!url.pathname.startsWith("/api/admin/")) return false;

  try {
    const admin = getSessionUser(request);
    if (!isAdmin(admin)) {
      sendJson(response, 403, { ok: false, error: "Acesso restrito ao administrador." });
      return true;
    }

    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      syncBootstrapAdmin();
      const filter = url.searchParams.get("status") || "";
      const users = listUsers(filter || null).map(publicUserWithMetrics);
      sendJson(response, 200, { ok: true, users });
      return true;
    }

    const match = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/(approve|reject)$/);
    if (match && request.method === "POST") {
      const userId = decodeURIComponent(match[1]);
      const action = match[2];
      const target = findUserById(userId);
      if (!target) {
        sendJson(response, 404, { ok: false, error: "Usuario nao encontrado." });
        return true;
      }
      const status = action === "approve" ? "approved" : "rejected";
      const updated = setUserStatus(userId, status);
      sendJson(response, 200, { ok: true, user: publicUser(updated) });
      return true;
    }

    const creditsGetMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/credits$/);
    if (creditsGetMatch && request.method === "GET") {
      const userId = decodeURIComponent(creditsGetMatch[1]);
      const target = findUserById(userId);
      if (!target) {
        sendJson(response, 404, { ok: false, error: "Usuario nao encontrado." });
        return true;
      }
      const status = nestingLimits.nestingStatus(target);
      sendJson(response, 200, { ok: true, user: publicUser(target), nestingStatus: status });
      return true;
    }

    const creditsPostMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/credits$/);
    if (creditsPostMatch && request.method === "POST") {
      const userId = decodeURIComponent(creditsPostMatch[1]);
      const target = findUserById(userId);
      if (!target) {
        sendJson(response, 404, { ok: false, error: "Usuario nao encontrado." });
        return true;
      }
      readJsonBody(request).then((body) => {
        const credits = Number(body.credits);
        if (!Number.isInteger(credits) || credits === 0) {
          sendJson(response, 400, { ok: false, error: "Informe um numero inteiro de creditos diferente de zero." });
          return;
        }
        const updatedStatus = nestingLimits.addCredits(target, credits);
        store.updateNestingData(userId, target.nesting_usage, target.extra_credits);
        sendJson(response, 200, {
          ok: true,
          message: `${credits > 0 ? "+" : ""}${credits} credito(s) adicionado(s) para ${target.name}.`,
          nestingStatus: updatedStatus,
        });
      }).catch((err) => sendJson(response, 400, { ok: false, error: err.message }));
      return true;
    }

    const creditsDeleteMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/credits$/);
    if (creditsDeleteMatch && request.method === "DELETE") {
      const userId = decodeURIComponent(creditsDeleteMatch[1]);
      const target = findUserById(userId);
      if (!target) {
        sendJson(response, 404, { ok: false, error: "Usuario nao encontrado." });
        return true;
      }
      const updatedStatus = nestingLimits.resetCredits(target);
      store.updateNestingData(userId, target.nesting_usage, target.extra_credits);
      sendJson(response, 200, { ok: true, message: "Creditos extras zerados.", nestingStatus: updatedStatus });
      return true;
    }

    sendJson(response, 404, { ok: false, error: "Rota nao encontrada." });
    return true;
  } catch (error) {
    console.error("Erro na API admin:", error);
    sendJson(response, 500, { ok: false, error: "Erro interno no painel admin." });
    return true;
  }
}

function handleNestingApi(request, response, url) {
  if (!url.pathname.startsWith("/api/nesting/")) return false;

  try {
    const user = getApprovedUser(request);
    if (!user) {
      sendJson(response, 401, { ok: false, error: "Nao autenticado." });
      return true;
    }

    const freshUser = findUserById(user.id);
    if (!freshUser) {
      sendJson(response, 401, { ok: false, error: "Sessao invalida." });
      return true;
    }

    if (url.pathname === "/api/nesting/status" && request.method === "GET") {
      const status = nestingLimits.nestingStatus(freshUser);
      sendJson(response, 200, { ok: true, status });
      return true;
    }

    if (url.pathname === "/api/nesting/check" && request.method === "POST") {
      readJsonBody(request).then((body) => {
        const pieceCount = Number(body.pieceCount) || 0;
        const result = nestingLimits.checkNestingAllowed(freshUser, pieceCount);

        if (!result.allowed) {
          sendJson(response, 403, {
            ok: false,
            blocked: true,
            reason: result.reason,
            status: result.status,
          });
          return;
        }

        nestingLimits.recordNestingUsed(freshUser);
        store.updateNestingData(freshUser.id, freshUser.nesting_usage, freshUser.extra_credits);

        sendJson(response, 200, {
          ok: true,
          status: nestingLimits.nestingStatus(freshUser),
        });
      }).catch((err) => sendJson(response, 400, { ok: false, error: err.message }));
      return true;
    }

    sendJson(response, 404, { ok: false, error: "Rota nao encontrada." });
    return true;
  } catch (error) {
    console.error("Erro na API nesting:", error);
    sendJson(response, 500, { ok: false, error: "Erro interno." });
    return true;
  }
}

function handleAuthApi(request, response, url) {
  if (url.pathname.startsWith("/api/admin/")) {
    return handleAdminApi(request, response, url);
  }
  if (url.pathname.startsWith("/api/nesting/")) {
    return handleNestingApi(request, response, url);
  }
  if (!url.pathname.startsWith("/api/auth/")) return false;

  try {
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const user = getSessionUser(request);
      if (!user) return sendJson(response, 401, { ok: false, error: "Nao autenticado." });
      return sendJson(response, 200, { ok: true, user: publicUser(user) });
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      clearSessionCookie(response, request);
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, error: "Metodo nao permitido." });
      return true;
    }

    readJsonBody(request)
      .then((payload) => {
        if (url.pathname === "/api/auth/register") {
          if (!allowRegister) {
            sendJson(response, 403, { ok: false, error: "Cadastro desabilitado." });
            return;
          }
          const validationError = validateRegistration(payload);
          if (validationError) {
            sendJson(response, 400, { ok: false, error: validationError });
            return;
          }
          if (findUserByEmail(payload.email)) {
            sendJson(response, 409, { ok: false, error: "Este email ja esta cadastrado." });
            return;
          }
          const user = createUser(payload.name, payload.email, payload.password);
          sendJson(response, 201, {
            ok: true,
            pending: user.status === "pending",
            message: user.status === "approved"
              ? "Conta administradora criada. Voce ja pode entrar."
              : "Cadastro enviado. Aguarde a aprovacao do administrador para entrar.",
            user: publicUser(user),
          });
          return;
        }

        if (url.pathname === "/api/auth/login") {
          const email = normalizeEmail(payload.email);
          const password = String(payload.password || "");
          const bootstrapEmail = normalizeEmail(process.env.MOLDELAB_BOOTSTRAP_EMAIL);
          if (email && bootstrapEmail && email === bootstrapEmail && password === String(process.env.MOLDELAB_BOOTSTRAP_PASSWORD || "")) {
            let user;
            try {
              user = syncBootstrapAdmin();
            } catch (error) {
              console.error("Login bootstrap sem persistencia:", error.message);
            }
            const bootstrap = user || bootstrapUser();
            const token = signToken(bootstrap);
            setSessionCookie(response, token, request);
            sendJson(response, 200, { ok: true, user: publicUser(bootstrap) });
            return;
          }
          let user = findUserByEmail(email);
          loadAuthDeps();
          if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            sendJson(response, 401, { ok: false, error: "Email ou senha incorretos." });
            return;
          }
          if (!hasApprovedAdmin()) {
            user = store.update(user.id, { status: "approved", role: "admin" });
          }
          if (!isApproved(user)) {
            sendJson(response, 403, {
              ok: false,
              error: loginErrorForStatus(user.status),
              status: user.status,
            });
            return;
          }
          // Registra o login
          recordLogin(user.id);
          const token = signToken(user);
          setSessionCookie(response, token, request);
          sendJson(response, 200, { ok: true, user: publicUser(findUserById(user.id)) });
          return;
        }

        sendJson(response, 404, { ok: false, error: "Rota nao encontrada." });
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, error: error.message || "Requisicao invalida." });
      });

    return true;
  } catch (error) {
    console.error("Erro na API auth:", error);
    sendJson(response, 500, { ok: false, error: "Erro interno de autenticacao." });
    return true;
  }
}

function redirectToLogin(response, nextPath = "/") {
  if (response.writableEnded || response.headersSent) return true;
  const target = nextPath && nextPath !== "/"
    ? `/login.html?next=${encodeURIComponent(nextPath)}`
    : "/login.html";
  response.writeHead(302, { Location: target });
  response.end();
  return true;
}

function init() {
  if (disabled) {
    console.log("Autenticacao desabilitada (MOLDELAB_AUTH_DISABLED=1).");
    return;
  }
  try {
    initDb();
    console.log(`Autenticacao ativa. Dados: ${path.join(dataDir, "users.json")}`);
  } catch (error) {
    console.error("Falha ao iniciar autenticacao:", error);
    throw error;
  }
}

module.exports = {
  init,
  disabled,
  allowRegister,
  isPublicPath,
  getSessionUser,
  getApprovedUser,
  getUserFromRequest: getApprovedUser,
  isAdmin,
  handleAuthApi,
  handleNestingApi,
  redirectToLogin,
};
