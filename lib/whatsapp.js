/**
 * WhatsApp Business API (Meta oficial) — integração com Bedrock.
 *
 * Variáveis de ambiente obrigatórias:
 *   WHATSAPP_VERIFY_TOKEN        — token escolhido por você no painel Meta
 *   WHATSAPP_ACCESS_TOKEN        — token permanente (system user) da API
 *   WHATSAPP_PHONE_NUMBER_ID     — ID do número registrado no Meta Business
 *
 * Variáveis opcionais:
 *   WHATSAPP_GRAPH_API_VERSION   — padrão "v21.0"
 *   AWS_REGION                   — padrão "us-east-2"
 */

const https = require("https");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

// ── Configuração ────────────────────────────────────────────────────────────────

const VERIFY_TOKEN = () => process.env.WHATSAPP_VERIFY_TOKEN || "";
const ACCESS_TOKEN = () => process.env.WHATSAPP_ACCESS_TOKEN || "";
const PHONE_NUMBER_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const GRAPH_VERSION = () => process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
const BEDROCK_MODEL = () =>
  process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-6";

const SYSTEM_PROMPT = `Você é o assistente do Moldelab via WhatsApp, uma plataforma de criação e edição de moldes de costura.

Seu papel é guiar o usuário do início ao fim, acompanhando cada etapa do processo:
1. Boas-vindas e entendimento do que o usuário quer criar
2. Coleta de medidas e informações do molde (tipo de peça, tamanho, tecido)
3. Orientação sobre como usar a plataforma (ferramentas, operações disponíveis)
4. Geração de descrições detalhadas do molde
5. Revisão e ajustes finais

Seja proativo: pergunte o que o usuário quer fazer, sugira próximos passos, ofereça dicas sobre moldes e costura quando relevante.
Responda sempre em português brasileiro. Seja direto, amigável e técnico quando necessário.
Mantenha respostas curtas (máximo 3 parágrafos) pois serão enviadas pelo WhatsApp.`;

// ── Histórico de conversas em memória (por número do remetente) ─────────────

const conversations = new Map();
const MAX_HISTORY = 20;

function getHistory(from) {
  if (!conversations.has(from)) conversations.set(from, []);
  return conversations.get(from);
}

function addToHistory(from, role, content) {
  const history = getHistory(from);
  history.push({ role, content });
  // Manter só as últimas MAX_HISTORY mensagens para não estourar contexto
  while (history.length > MAX_HISTORY) history.shift();
}

// ── Bedrock ─────────────────────────────────────────────────────────────────────

let _bedrockClient = null;

function bedrockClient() {
  if (!_bedrockClient) {
    _bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-2",
    });
  }
  return _bedrockClient;
}

async function askBedrock(messages) {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages,
  });

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL(),
    contentType: "application/json",
    accept: "application/json",
    body,
  });

  const response = await bedrockClient().send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content?.[0]?.text || "Desculpe, não consegui processar sua mensagem.";
}

// ── Envio de mensagens pelo WhatsApp ────────────────────────────────────────────

function sendWhatsAppMessage(to, text) {
  return new Promise((resolve, reject) => {
    const phoneId = PHONE_NUMBER_ID();
    const token = ACCESS_TOKEN();
    if (!phoneId || !token) {
      reject(new Error("WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN não configurados."));
      return;
    }

    const payload = JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    });

    const options = {
      hostname: "graph.facebook.com",
      path: `/${GRAPH_VERSION()}/${phoneId}/messages`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          console.error(`WhatsApp API erro ${res.statusCode}:`, data);
          reject(new Error(`WhatsApp API ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function markAsRead(messageId) {
  return new Promise((resolve) => {
    const phoneId = PHONE_NUMBER_ID();
    const token = ACCESS_TOKEN();
    if (!phoneId || !token) { resolve(); return; }

    const payload = JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });

    const options = {
      hostname: "graph.facebook.com",
      path: `/${GRAPH_VERSION()}/${phoneId}/messages`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      res.on("data", () => {});
      res.on("end", resolve);
    });
    req.on("error", () => resolve());
    req.write(payload);
    req.end();
  });
}

// ── Processamento de mensagens recebidas ────────────────────────────────────────

async function processIncomingMessage(message, from) {
  const text = message.text?.body;
  if (!text) return; // Ignora mídia, stickers, etc. por enquanto

  console.log(`[WhatsApp] Mensagem de ${from}: ${text.substring(0, 80)}...`);

  // Marcar como lida
  markAsRead(message.id).catch(() => {});

  // Adicionar mensagem do usuário ao histórico
  addToHistory(from, "user", text);

  try {
    // Enviar histórico para o Bedrock
    const history = getHistory(from);
    const reply = await askBedrock(history);

    // Adicionar resposta ao histórico
    addToHistory(from, "assistant", reply);

    // Enviar resposta pelo WhatsApp
    await sendWhatsAppMessage(from, reply);
    console.log(`[WhatsApp] Resposta enviada para ${from}`);
  } catch (error) {
    console.error(`[WhatsApp] Erro ao processar mensagem de ${from}:`, error.message);
    try {
      await sendWhatsAppMessage(
        from,
        "Desculpe, tive um problema ao processar sua mensagem. Tente novamente em instantes. 🙏",
      );
    } catch {
      // Falha dupla — só loga.
    }
  }
}

// ── Handlers HTTP ───────────────────────────────────────────────────────────────

/**
 * GET /webhook/whatsapp — verificação do webhook pela Meta.
 */
function handleVerification(url, response) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN()) {
    console.log("[WhatsApp] Webhook verificado com sucesso.");
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end(challenge);
    return;
  }

  console.warn("[WhatsApp] Verificação falhou — token inválido.");
  response.writeHead(403, { "Content-Type": "text/plain" });
  response.end("Forbidden");
}

/**
 * POST /webhook/whatsapp — recebe notificações da Meta.
 */
function handleIncoming(request, response) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) request.destroy();
  });

  request.on("end", () => {
    // Meta espera 200 imediato
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));

    try {
      const data = JSON.parse(body);
      const entries = data.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== "messages") continue;
          const value = change.value || {};
          const messages = value.messages || [];

          for (const message of messages) {
            const from = message.from; // número do remetente (ex: 5511999999999)
            // Processar em background — não bloqueia o 200
            processIncomingMessage(message, from).catch((err) =>
              console.error("[WhatsApp] Erro não tratado:", err.message),
            );
          }
        }
      }
    } catch (error) {
      console.error("[WhatsApp] Erro ao parsear webhook:", error.message);
    }
  });
}

/**
 * Verifica se o WhatsApp está configurado (todas as variáveis obrigatórias).
 */
function isConfigured() {
  return Boolean(VERIFY_TOKEN() && ACCESS_TOKEN() && PHONE_NUMBER_ID());
}

module.exports = {
  handleVerification,
  handleIncoming,
  sendWhatsAppMessage,
  isConfigured,
};
