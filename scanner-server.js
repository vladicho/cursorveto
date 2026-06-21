const crypto = require("crypto");
const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const auth = require("./lib/auth");
const scannerToken = require("./lib/scanner-token");

const distPath = path.join(__dirname, "dist");
const distReady = fs.existsSync(path.join(distPath, "index.html"));
const isProductionHost = Boolean(process.env.RENDER) || process.env.NODE_ENV === "production";

if (isProductionHost && !distReady) {
  console.warn("Aviso: pasta dist/ ausente; servindo arquivos fonte como fallback.");
}

const root = distReady ? distPath : __dirname;
const requestedPort = Number(process.env.PORT || process.env.MOLDELAB_SCANNER_PORT || 8787);
const fixedPort = Boolean(process.env.PORT || process.env.MOLDELAB_SCANNER_PORT);
let activePort = requestedPort;
const desktops = new Set();
const mobiles = new Set();
const latestFramesByUser = new Map();
const basicAuthUser = process.env.MOLDELAB_BASIC_AUTH_USER || "";
const basicAuthPassword = process.env.MOLDELAB_BASIC_AUTH_PASSWORD || "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isBasicAuthEnabled() {
  return Boolean(basicAuthUser && basicAuthPassword);
}

function allowBasicAuth(request, response, url) {
  if (!isBasicAuthEnabled()) return true;
  if (url.pathname === "/health") return true;

  const header = request.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      const user = separator >= 0 ? decoded.slice(0, separator) : "";
      const password = separator >= 0 ? decoded.slice(separator + 1) : "";
      if (timingSafeEqualText(user, basicAuthUser) && timingSafeEqualText(password, basicAuthPassword)) return true;
    } catch {
      // Fall through to challenge.
    }
  }

  response.writeHead(401, {
    "Content-Type": "text/plain; charset=utf-8",
    "WWW-Authenticate": 'Basic realm="MoldeLab", charset="UTF-8"',
    "Cache-Control": "no-store",
  });
  response.end("Autenticacao necessaria.");
  return false;
}

function securityHeaders(contentType) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Cache-Control": contentType?.startsWith("text/html") ? "no-store" : "public, max-age=3600",
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

function localAddress() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const item of entries || []) {
      if (item.family === "IPv4" && !item.internal) return item.address;
    }
  }
  return "127.0.0.1";
}

function publicOrigin(request) {
  if (request) {
    const host = request.headers["x-forwarded-host"] || request.headers.host;
    if (host) {
      const protoHeader = request.headers["x-forwarded-proto"];
      const proto = protoHeader ? String(protoHeader).split(",")[0].trim() : "http";
      return `${proto}://${host}`;
    }
  }
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  return `http://${localAddress()}:${activePort}`;
}

function resolveScannerUserId(request, url) {
  const approved = request ? auth.getApprovedUser(request) : null;
  if (approved) return approved.id;
  const token = scannerToken.extractFromRequest(request, url);
  return scannerToken.validate(token);
}

function mobileUrl(request) {
  const approved = request ? auth.getApprovedUser(request) : null;
  const base = `${publicOrigin(request)}/mobile-scanner.html`;
  if (!approved) return base;
  const token = scannerToken.create(approved.id);
  return `${base}?token=${encodeURIComponent(token)}`;
}

function denyScanner(response) {
  response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Scanner requer login no MoldeLab ou QR valido.");
}

function sendJson(response, statusCode, payload) {
  if (response.writableEnded || response.headersSent) return;
  response.writeHead(statusCode, { "Content-Type": mimeTypes[".json"], "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function readBody(request, limitBytes = 18_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > limitBytes) {
        reject(new Error("payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function handleScikitDigitize(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Metodo nao permitido." });
    return;
  }

  const configuredUrl = process.env.SKIMAGE_SERVICE_URL || "";
  if (!configuredUrl) {
    sendJson(response, 503, { ok: false, error: "Microservico scikit-image nao configurado." });
    return;
  }

  try {
    const serviceUrl = configuredUrl.startsWith("http") ? configuredUrl : `http://${configuredUrl}`;
    const body = await readBody(request, 22_000_000);
    const upstream = await fetch(`${serviceUrl.replace(/\/$/, "")}/digitize/scikit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SKIMAGE_SHARED_SECRET ? { "X-MoldeLab-Secret": process.env.SKIMAGE_SHARED_SECRET } : {}),
      },
      body,
    });
    const text = await upstream.text();
    response.writeHead(upstream.status, { "Content-Type": mimeTypes[".json"], "Cache-Control": "no-store" });
    response.end(text || JSON.stringify({ ok: upstream.ok }));
  } catch (error) {
    sendJson(response, 502, { ok: false, error: `Falha no microservico scikit-image: ${error.message}` });
  }
}

function qrSvg(text) {
  const version = 4;
  const size = 17 + version * 4;
  const dataCodewords = 80;
  const eccCodewords = 20;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const bytes = [...Buffer.from(text, "utf8")];

  function set(x, y, value, isReserved = true) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = Boolean(value);
    if (isReserved) reserved[y][x] = true;
  }

  function finder(x, y) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        const dark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        set(xx, yy, dark);
      }
    }
  }

  function alignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  function pushBits(target, value, length) {
    for (let bit = length - 1; bit >= 0; bit -= 1) target.push((value >>> bit) & 1);
  }

  function gfTables() {
    const exp = Array(512).fill(0);
    const log = Array(256).fill(0);
    let value = 1;
    for (let index = 0; index < 255; index += 1) {
      exp[index] = value;
      log[value] = index;
      value <<= 1;
      if (value & 0x100) value ^= 0x11d;
    }
    for (let index = 255; index < 512; index += 1) exp[index] = exp[index - 255];
    return { exp, log };
  }

  const gf = gfTables();
  const gfMul = (a, b) => (a && b ? gf.exp[gf.log[a] + gf.log[b]] : 0);
  let generator = [1];
  for (let degree = 0; degree < eccCodewords; degree += 1) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMul(coefficient, gf.exp[degree]);
    });
    generator = next;
  }

  const bits = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, 8);
  bytes.forEach((byte) => pushBits(bits, byte, 8));
  const maxBits = dataCodewords * 8;
  pushBits(bits, 0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(bits.slice(index, index + 8).reduce((total, bit) => (total << 1) | bit, 0));
  }
  for (let pad = 0; data.length < dataCodewords; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);

  const ecc = Array(eccCodewords).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ ecc[0];
    ecc.copyWithin(0, 1);
    ecc[eccCodewords - 1] = 0;
    for (let index = 0; index < eccCodewords; index += 1) ecc[index] ^= gfMul(generator[index + 1], factor);
  });
  const codeBits = [...data, ...ecc].flatMap((byte) => Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1));

  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  alignment(26, 26);
  for (let index = 8; index < size - 8; index += 1) {
    set(index, 6, index % 2 === 0);
    set(6, index, index % 2 === 0);
  }
  set(8, size - 8, true);
  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      reserved[8][index] = true;
      reserved[index][8] = true;
    }
  }
  for (let index = 0; index < 8; index += 1) {
    reserved[8][size - 1 - index] = true;
    reserved[size - 1 - index][8] = true;
  }

  function maskBit(mask, x, y) {
    return [
      (x + y) % 2 === 0,
      y % 2 === 0,
      x % 3 === 0,
      (x + y) % 3 === 0,
      (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
      ((x * y) % 2) + ((x * y) % 3) === 0,
      (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ][mask];
  }

  function applyData(mask) {
    const trial = modules.map((row) => [...row]);
    let bitIndex = 0;
    let upward = true;
    for (let x = size - 1; x > 0; x -= 2) {
      if (x === 6) x -= 1;
      for (let step = 0; step < size; step += 1) {
        const y = upward ? size - 1 - step : step;
        for (let dx = 0; dx < 2; dx += 1) {
          const xx = x - dx;
          if (reserved[y][xx]) continue;
          trial[y][xx] = Boolean(codeBits[bitIndex] || 0) !== maskBit(mask, xx, y);
          bitIndex += 1;
        }
      }
      upward = !upward;
    }
    return trial;
  }

  function penalty(matrix) {
    let total = 0;
    for (let y = 0; y < size; y += 1) {
      let runColor = matrix[y][0];
      let run = 1;
      for (let x = 1; x < size; x += 1) {
        if (matrix[y][x] === runColor) run += 1;
        else {
          if (run >= 5) total += run - 2;
          runColor = matrix[y][x];
          run = 1;
        }
      }
      if (run >= 5) total += run - 2;
    }
    for (let x = 0; x < size; x += 1) {
      let runColor = matrix[0][x];
      let run = 1;
      for (let y = 1; y < size; y += 1) {
        if (matrix[y][x] === runColor) run += 1;
        else {
          if (run >= 5) total += run - 2;
          runColor = matrix[y][x];
          run = 1;
        }
      }
      if (run >= 5) total += run - 2;
    }
    return total;
  }

  function formatBits(mask) {
    let dataValue = (1 << 3) | mask;
    let value = dataValue << 10;
    for (let bit = 14; bit >= 10; bit -= 1) {
      if ((value >>> bit) & 1) value ^= 0x537 << (bit - 10);
    }
    return (((dataValue << 10) | value) ^ 0x5412) & 0x7fff;
  }

  let bestMask = 0;
  let bestMatrix = applyData(0);
  let bestPenalty = penalty(bestMatrix);
  for (let mask = 1; mask < 8; mask += 1) {
    const trial = applyData(mask);
    const score = penalty(trial);
    if (score < bestPenalty) {
      bestMask = mask;
      bestMatrix = trial;
      bestPenalty = score;
    }
  }

  const fmt = formatBits(bestMask);
  const coords1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const coords2 = [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [size - 8, 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]];
  coords1.forEach(([x, y], index) => { bestMatrix[y][x] = Boolean((fmt >>> index) & 1); });
  coords2.forEach(([x, y], index) => { bestMatrix[y][x] = Boolean((fmt >>> index) & 1); });

  const scale = 6;
  const quiet = 4;
  const rects = [];
  bestMatrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) rects.push(`<rect x="${(x + quiet) * scale}" y="${(y + quiet) * scale}" width="${scale}" height="${scale}"/>`);
  }));
  const pixels = (size + quiet * 2) * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${pixels} ${pixels}">
<rect width="100%" height="100%" fill="#fff"/>
<g fill="#000">${rects.join("")}</g>
</svg>`;
}

function sendWs(socket, payload) {
  if (socket.destroyed) return;
  const data = Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload));
  let header;
  if (data.length < 126) {
    header = Buffer.from([0x81, data.length]);
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  socket.write(Buffer.concat([header, data]));
}

function readWsFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];
    let length = byte2 & 0x7f;
    let cursor = offset + 2;
    if (length === 126) {
      if (cursor + 2 > buffer.length) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (cursor + 8 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }
    const masked = Boolean(byte2 & 0x80);
    const mask = masked ? buffer.subarray(cursor, cursor + 4) : null;
    if (masked) cursor += 4;
    if (cursor + length > buffer.length) break;
    const payload = Buffer.from(buffer.subarray(cursor, cursor + length));
    if (masked) {
      for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    }
    if ((byte1 & 0x0f) === 1) messages.push(payload.toString("utf8"));
    offset = cursor + length;
  }
  return { messages, remaining: buffer.subarray(offset) };
}

function routeWs(socket, role, raw) {
  if (role === "mobile") {
    for (const desktop of desktops) {
      if (desktop.userId === socket.userId) sendWs(desktop, raw);
    }
    return;
  }
  for (const mobile of mobiles) {
    if (mobile.userId === socket.userId) sendWs(mobile, raw);
  }
}

function sendToDesktops(payload, userId) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  for (const desktop of desktops) {
    if (desktop.userId === userId) sendWs(desktop, raw);
  }
}

function receiveMobileFrame(payload, userId) {
  const frame = {
    type: "frame",
    dataUrl: payload.dataUrl,
    capturedAt: payload.capturedAt || Date.now(),
    id: crypto.randomUUID(),
    userId,
  };
  latestFramesByUser.set(userId, frame);
  sendToDesktops(frame, userId);
  return frame;
}

function acceptWebSocket(request, socket, role, userId) {
  const key = request.headers["sec-websocket-key"];
  const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  const group = role === "mobile" ? mobiles : desktops;
  socket.userId = userId;
  group.add(socket);
  socket.wsBuffer = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    socket.wsBuffer = Buffer.concat([socket.wsBuffer, chunk]);
    const result = readWsFrames(socket.wsBuffer);
    socket.wsBuffer = result.remaining;
    result.messages.forEach((message) => {
      if (role === "mobile") {
        try {
          const payload = JSON.parse(message);
          if (payload.type === "frame" && payload.dataUrl) {
            receiveMobileFrame(payload, socket.userId);
            return;
          }
        } catch (error) {
          // Forward non-JSON messages below.
        }
      }
      routeWs(socket, role, message);
    });
  });
  socket.on("close", () => group.delete(socket));
  socket.on("error", () => group.delete(socket));
  if (role === "mobile") routeWs(socket, "mobile", JSON.stringify({ type: "phone-status", message: "Celular conectado ao app Windows." }));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (!allowBasicAuth(request, response, url)) return;
  if (auth.handleAuthApi(request, response, url)) return;

  if (url.pathname === "/api/health.json" && request.method === "GET") {
    response.writeHead(200, securityHeaders(mimeTypes[".json"]));
    let build = null;
    try {
      build = JSON.parse(fs.readFileSync(path.join(root, "build.json"), "utf8"));
    } catch {
      build = { builtAt: null, commit: null };
    }
    response.end(
      JSON.stringify({
        ok: true,
        frontend: distReady ? "dist" : "source",
        production: isProductionHost,
        build,
      }),
    );
    return;
  }

  if (url.pathname === "/health" && request.method === "GET") {
    response.writeHead(200, securityHeaders(mimeTypes[".json"]));
    response.end(JSON.stringify({ ok: true }));
    return;
  }


  if (url.pathname === "/api/chat" && request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", async () => {
      try {
        const { messages, system } = JSON.parse(body);
        const https = require("https");
        const payload = JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system,
          messages,
        });
        const options = {
          hostname: "api.anthropic.com",
          path: "/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY || "",
            "anthropic-version": "2023-06-01",
          },
        };
        const proxyReq = https.request(options, (proxyRes) => {
          let data = "";
          proxyRes.on("data", (chunk) => { data += chunk; });
          proxyRes.on("end", () => {
            response.writeHead(proxyRes.statusCode, securityHeaders(mimeTypes[".json"]));
            response.end(data);
          });
        });
        proxyReq.on("error", (err) => {
          response.writeHead(500, securityHeaders(mimeTypes[".json"]));
          response.end(JSON.stringify({ error: err.message }));
        });
        proxyReq.write(payload);
        proxyReq.end();
      } catch (err) {
        response.writeHead(400, securityHeaders(mimeTypes[".json"]));
        response.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/api/digitize/scikit") {
    handleScikitDigitize(request, response);
    return;
  }

  if (url.pathname === "/scanner-frame" && request.method === "POST") {
    const scannerUserId = resolveScannerUserId(request, url);
    if (!scannerUserId) {
      denyScanner(response);
      return;
    }
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 18_000_000) request.destroy();
    });
    request.on("end", () => {
      if (response.writableEnded || response.headersSent) return;
      try {
        const payload = JSON.parse(body);
        if (!payload.dataUrl) throw new Error("missing frame");
        const frame = receiveMobileFrame(payload, scannerUserId);
        response.writeHead(200, { "Content-Type": mimeTypes[".json"] });
        response.end(JSON.stringify({ ok: true, desktops: desktops.size, frameId: frame.id }));
      } catch (error) {
        response.writeHead(400, { "Content-Type": mimeTypes[".json"] });
        response.end(JSON.stringify({ ok: false, error: error.message }));
      }
    });
    return;
  }
  if (url.pathname === "/scanner-latest-frame.json") {
    const approved = auth.getApprovedUser(request);
    if (!approved) {
      denyScanner(response);
      return;
    }
    response.writeHead(200, securityHeaders(mimeTypes[".json"]));
    response.end(JSON.stringify({ ok: true, frame: latestFramesByUser.get(approved.id) || null }));
    return;
  }
  if (url.pathname === "/scanner-info.json") {
    if (!auth.getApprovedUser(request)) {
      denyScanner(response);
      return;
    }
    response.writeHead(200, securityHeaders(mimeTypes[".json"]));
    response.end(JSON.stringify({ mobileUrl: mobileUrl(request), qrUrl: "/scanner-qr.svg" }));
    return;
  }
  if (url.pathname === "/scanner-qr.svg") {
    if (!auth.getApprovedUser(request)) {
      denyScanner(response);
      return;
    }
    const link = mobileUrl(request);
    response.writeHead(200, securityHeaders(mimeTypes[".svg"]));
    response.end(qrSvg(link));
    return;
  }
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;

  if (requestedPath === "/index.html" && !auth.getApprovedUser(request)) {
    auth.redirectToLogin(response, "/");
    return;
  }

  if (requestedPath === "/mobile-scanner.html") {
    if (!resolveScannerUserId(request, url)) {
      auth.redirectToLogin(response, "/mobile-scanner.html");
      return;
    }
  }

  if (!auth.isPublicPath(requestedPath) && !auth.getApprovedUser(request) && requestedPath !== "/mobile-scanner.html") {
    response.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Autenticacao necessaria.");
    return;
  }
  const filePath = path.normalize(path.join(root, requestedPath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (response.writableEnded || response.headersSent) return;
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      ...securityHeaders(mimeTypes[ext] || "application/octet-stream"),
    };
    if (ext === ".js") headers["Cache-Control"] = "no-cache";
    response.writeHead(200, headers);
    response.end(content);
  });
});

server.on("upgrade", (request, socket) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/ws/mobile") {
    const wsUrl = new URL(request.url, `http://${request.headers.host}`);
    const scannerUserId = resolveScannerUserId(request, wsUrl);
    if (!scannerUserId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    return acceptWebSocket(request, socket, "mobile", scannerUserId);
  }
  if (url.pathname === "/ws/desktop") {
    const approved = auth.getApprovedUser(request);
    if (!approved) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    return acceptWebSocket(request, socket, "desktop", approved.id);
  }
  socket.destroy();
});

try {
  auth.init();
} catch (error) {
  console.error("Servidor abortado:", error.message);
  process.exit(1);
}

function listen(portToTry) {
  activePort = portToTry;
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && !fixedPort && portToTry < requestedPort + 20) {
      console.warn(`Porta ${portToTry} em uso; tentando ${portToTry + 1}.`);
      listen(portToTry + 1);
      return;
    }
    if (error.code === "EADDRINUSE") {
      console.error(`Porta ${portToTry} ja esta em uso. Feche o MoldeLab aberto ou altere MOLDELAB_SCANNER_PORT.`);
      process.exit(1);
    }
    console.error("Nao foi possivel iniciar o servidor local:", error.message);
    process.exit(1);
  });

  server.listen(portToTry, "0.0.0.0", () => {
    const localUrl = `http://localhost:${activePort}`;
    console.log(`MoldeLab: ${process.env.RENDER_EXTERNAL_URL || localUrl}`);
    console.log(`Frontend: ${distReady ? "dist (minificado)" : "source (desenvolvimento)"}`);
    console.log(`Scanner mobile: ${mobileUrl()}`);
    console.log("Abra o MoldeLab pelo endereco local e leia o QR Code pelo celular.");
    if (process.env.MOLDELAB_OPEN_BROWSER === "1") {
      childProcess.exec(`start "" "${localUrl}"`);
    }
  });
}

listen(requestedPort);
