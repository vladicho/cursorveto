/**
 * nesting-limits.js
 * Controla o uso diário de encaixe por usuário.
 *
 * Limites padrão:
 *   - 10 nestings por dia (meia-noite BRT, UTC-3)
 *   - Máx 85 peças por nesting
 *   - Admin é isento de limites
 *   - Créditos extras podem ser adicionados pelo admin via rota /api/admin/credits
 */

const DAILY_NESTING_LIMIT = 10;
const MAX_PIECES_PER_NESTING = 85;
const ADMIN_EMAIL = process.env.MOLDELAB_ADMIN_CONTACT_EMAIL || "admin@moldelab.com.br";

/**
 * Retorna a chave de data no fuso BRT (UTC-3).
 */
function todayKeyBRT() {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Inicializa o bloco de uso de nesting no objeto do usuário, se ausente.
 */
function ensureNestingFields(user) {
  if (!user.nesting_usage) user.nesting_usage = {};
  if (typeof user.extra_credits !== "number") user.extra_credits = 0;
}

/**
 * Retorna { used, limit, remaining, date } para o usuário hoje.
 */
function nestingStatus(user) {
  ensureNestingFields(user);
  const today = todayKeyBRT();
  const used = user.nesting_usage[today] || 0;
  const bonus = user.extra_credits || 0;
  const limit = DAILY_NESTING_LIMIT + bonus;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    date: today,
    maxPiecesPerNesting: MAX_PIECES_PER_NESTING,
    adminContact: ADMIN_EMAIL,
  };
}

/**
 * Verifica se o usuário pode iniciar um nesting.
 * @param {object} user - Objeto do usuário (do store).
 * @param {number} pieceCount - Número de peças no encaixe atual.
 * @returns {{ allowed: boolean, reason?: string, status: object }}
 */
function checkNestingAllowed(user, pieceCount = 0) {
  // Admin nunca é bloqueado
  if (user.role === "admin") {
    return { allowed: true, status: nestingStatus(user) };
  }

  ensureNestingFields(user);

  // Verifica limite de peças por nesting
  if (pieceCount > MAX_PIECES_PER_NESTING) {
    return {
      allowed: false,
      reason: `Este encaixe tem ${pieceCount} peças. O limite é ${MAX_PIECES_PER_NESTING} peças por encaixe.`,
      status: nestingStatus(user),
    };
  }

  // Verifica limite diário
  const status = nestingStatus(user);
  if (status.remaining <= 0) {
    return {
      allowed: false,
      reason: `Você atingiu o limite de ${status.limit} encaixe(s) por dia. Para adquirir créditos extras, entre em contato: ${ADMIN_EMAIL}`,
      status,
    };
  }

  return { allowed: true, status };
}

/**
 * Registra um nesting usado. Deve ser chamado APÓS o encaixe completar com sucesso.
 * @param {object} user - Objeto do usuário (do store, por referência é atualizado pelo caller).
 * @returns {object} status atualizado
 */
function recordNestingUsed(user) {
  if (user.role === "admin") return nestingStatus(user);

  ensureNestingFields(user);
  const today = todayKeyBRT();

  // Limpa dias antigos para não acumular lixo no JSON
  const allDays = Object.keys(user.nesting_usage);
  allDays.forEach((day) => {
    if (day !== today) delete user.nesting_usage[day];
  });

  user.nesting_usage[today] = (user.nesting_usage[today] || 0) + 1;
  return nestingStatus(user);
}

/**
 * Adiciona créditos extras ao usuário (chamado pelo admin).
 * @param {object} user
 * @param {number} credits - Positivo para adicionar, negativo para remover.
 */
function addCredits(user, credits) {
  ensureNestingFields(user);
  user.extra_credits = Math.max(0, (user.extra_credits || 0) + Number(credits));
  return nestingStatus(user);
}

/**
 * Reseta os créditos extras de um usuário para 0.
 */
function resetCredits(user) {
  ensureNestingFields(user);
  user.extra_credits = 0;
  return nestingStatus(user);
}

module.exports = {
  DAILY_NESTING_LIMIT,
  MAX_PIECES_PER_NESTING,
  ADMIN_EMAIL,
  todayKeyBRT,
  nestingStatus,
  checkNestingAllowed,
  recordNestingUsed,
  addCredits,
  resetCredits,
};
