const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const dataDir = process.env.MOLDELAB_DATA_DIR || path.join(root, "data");
const dbPath = path.join(dataDir, "moldelab.db");
const cookieName = "moldelab_session";
const tokenTtl = "7d";
const disabled = process.env.MOLDELAB_AUTH_DISABLED === "1";
const allowRegister = process.env.MOLDELAB_ALLOW_REGISTER !== "0";

let db;

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
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  bootstrapAdmin();
}

function bootstrapAdmin() {
  const email = process.env.MOLDELAB_BOOTSTRAP_EMAIL;
  const password = process.env.MOLDELAB_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (existing) return;
  const name = process.env.MOLDELAB_BOOTSTRAP_NAME || "Administrador";
  createUser(name, email, password);
  console.log(`Usuario inicial criado: ${email.trim().toLowerCase()}`);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createUser(name, email, password) {
  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 12);
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, name.trim(), normalizeEmail(email), passwordHash, createdAt);
  return findUserById(id);
}

function findUserByEmail(email) {
  return db.prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?").get(normalizeEmail(email));
}

function findUserById(id) {
  return db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?").get(id);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret(), { expiresIn: tokenTtl });
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, jwtSecret());
    return findUserById(payload.sub);
  } catch {
    return null;
  }
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  const cookies = {};
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    cookies[key] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function isSecureRequest(request) {
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

function getUserFromRequest(request) {
  if (disabled) return { id: "dev", name: "Desenvolvimento", email: "dev@moldelab.local" };
  const token = parseCookies(request)[cookieName];
  if (!token) return null;
  return verifyToken(token);
}

function isPublicPath(pathname) {
  if (pathname === "/login.html" || pathname === "/login.js") return true;
  if (pathname === "/styles.css") return true;
  if (pathname === "/mobile-scanner.html") return true;
  if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/register")) return true;
  if (pathname.startsWith("/scanner")) return true;
  if (pathname.startsWith("/ws/")) return true;
  return false;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
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

function handleAuthApi(request, response, url) {
  if (!url.pathname.startsWith("/api/auth/")) return false;

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    const user = getUserFromRequest(request);
    if (!user) return sendJson(response, 401, { ok: false, error: "Nao autenticado." });
    return sendJson(response, 200, { ok: true, user: publicUser(user) });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    clearSessionCookie(response, request);
    return sendJson(response, 200, { ok: true });
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
        const token = signToken(user);
        setSessionCookie(response, token, request);
        sendJson(response, 201, { ok: true, user: publicUser(user) });
        return;
      }

      if (url.pathname === "/api/auth/login") {
        const email = normalizeEmail(payload.email);
        const password = String(payload.password || "");
        const user = findUserByEmail(email);
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
          sendJson(response, 401, { ok: false, error: "Email ou senha incorretos." });
          return;
        }
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
}

function redirectToLogin(response, nextPath = "/") {
  const target = `/login.html?next=${encodeURIComponent(nextPath)}`;
  response.writeHead(302, { Location: target });
  response.end();
}

function init() {
  if (disabled) {
    console.log("Autenticacao desabilitada (MOLDELAB_AUTH_DISABLED=1).");
    return;
  }
  initDb();
  console.log(`Autenticacao ativa. Banco: ${dbPath}`);
}

module.exports = {
  init,
  disabled,
  allowRegister,
  isPublicPath,
  getUserFromRequest,
  handleAuthApi,
  redirectToLogin,
};
