const crypto = require("crypto");

const TTL_MS = Number(process.env.MOLDELAB_SCANNER_TOKEN_TTL_MS || 15 * 60 * 1000);
const tokens = new Map();

function pruneExpired() {
  const now = Date.now();
  for (const [token, entry] of tokens.entries()) {
    if (entry.expiresAt <= now) tokens.delete(token);
  }
}

/** Cria token de pareamento exclusivo para um usuario aprovado (valido por TTL_MS). */
function create(userId) {
  if (!userId) throw new Error("userId obrigatorio");
  pruneExpired();
  const token = crypto.randomBytes(24).toString("hex");
  tokens.set(token, { userId: String(userId), expiresAt: Date.now() + TTL_MS });
  return token;
}

function validate(token) {
  if (!token) return null;
  const entry = tokens.get(String(token));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokens.delete(String(token));
    return null;
  }
  return entry.userId;
}

function extractFromRequest(request, url) {
  const fromQuery = url?.searchParams?.get("token");
  if (fromQuery) return fromQuery;
  const header = request.headers["x-scanner-token"];
  if (header) return String(header);
  return null;
}

module.exports = {
  create,
  validate,
  extractFromRequest,
};
