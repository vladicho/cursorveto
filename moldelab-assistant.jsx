import { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";

const SYSTEM_PROMPT = `Você é o assistente do Moldelab, uma plataforma de criação e edição de moldes de costura no canvas.

Seu papel é guiar o usuário do início ao fim, acompanhando cada etapa do processo:
1. Boas-vindas e entendimento do que o usuário quer criar
2. Coleta de medidas e informações do molde (tipo de peça, tamanho, tecido)
3. Orientação sobre como usar o canvas (ferramentas, operações disponíveis)
4. Geração de descrições detalhadas do molde
5. Revisão e ajustes finais

Seja proativo: pergunte o que o usuário quer fazer, sugira próximos passos, ofereça dicas sobre moldes e costura quando relevante.
Responda sempre em português brasileiro. Seja direto, amigável e técnico quando necessário.
Quando gerar uma descrição de molde, formate com: Nome, Tipo de peça, Medidas, Tecido recomendado, Instruções de corte.`;

const WELCOME = `Olá! 👋 Sou o assistente do **Moldelab**.

Vou te acompanhar do início ao fim — desde a ideia até o molde finalizado no canvas.

Para começar: **o que você quer criar hoje?**
_(ex: blusa feminina, calça jeans, vestido de festa...)_`;

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "10px 14px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#a78bfa",
            display: "inline-block",
            animation: `bounce 1.2s ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            marginRight: 8,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          ✦
        </div>
      )}
      <div
        style={{
          maxWidth: "78%",
          padding: "10px 14px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser
            ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
            : "#1e1b2e",
          color: "#f0eeff",
          fontSize: 13.5,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          boxShadow: isUser
            ? "0 2px 8px rgba(124,58,237,0.3)"
            : "0 2px 8px rgba(0,0,0,0.2)",
        }}
        dangerouslySetInnerHTML={{
          __html: msg.content
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/_(.*?)_/g, "<em>$1</em>"),
        }}
      />
    </div>
  );
}

export default function MoldelabAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setPulse(false);
    }
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newMessages
            .filter((m) => m.role !== "assistant" || m.content !== WELCOME)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      const reply = data.content?.[0]?.text || "Erro ao responder.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Erro de conexão. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #0f0d1a; font-family: 'Inter', sans-serif; }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ripple { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.2);opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3d2f6e; border-radius: 4px; }
        textarea:focus { outline: none; }
      `}</style>

      {/* Demo canvas background */}
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#0f0d1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.07 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#a78bfa" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Fake canvas content */}
        <div style={{ opacity: 0.15, pointerEvents: "none" }}>
          <svg width="320" height="280" viewBox="0 0 320 280">
            <path d="M80 40 L240 40 L260 80 L260 220 L80 220 L60 180 Z" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="6 3" />
            <line x1="80" y1="130" x2="260" y2="130" stroke="#7c3aed" strokeWidth="0.8" />
            <line x1="170" y1="40" x2="170" y2="220" stroke="#7c3aed" strokeWidth="0.8" />
            <circle cx="170" cy="130" r="3" fill="#a78bfa" />
            <text x="90" y="58" fill="#c4b5fd" fontSize="10" fontFamily="Inter">Frente</text>
            <text x="200" y="58" fill="#c4b5fd" fontSize="10" fontFamily="Inter">Costas</text>
          </svg>
        </div>

        <div style={{ position: "absolute", top: 20, left: 24, color: "#6d28d9", fontSize: 22, fontWeight: 700, letterSpacing: -0.5, fontFamily: "Inter" }}>
          molde<span style={{ color: "#a78bfa" }}>lab</span>
        </div>

        {/* Floating button */}
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 100 }}>
          {!open && pulse && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "#7c3aed",
                animation: "ripple 1.8s ease-out infinite",
              }}
            />
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "none",
              background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
              color: "#fff",
              fontSize: 22,
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(124,58,237,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              transition: "transform .15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {open ? "✕" : "✦"}
          </button>
        </div>

        {/* Modal */}
        {open && (
          <div
            style={{
              position: "fixed",
              bottom: 96,
              right: 28,
              width: 360,
              height: 520,
              background: "#13102a",
              borderRadius: 20,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "fadeUp .22s ease",
              zIndex: 99,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 18px",
                background: "linear-gradient(135deg, #1a1535, #1e1640)",
                borderBottom: "1px solid rgba(124,58,237,0.2)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                ✦
              </div>
              <div>
                <div style={{ color: "#f0eeff", fontSize: 14, fontWeight: 600 }}>
                  Assistente Moldelab
                </div>
                <div style={{ color: "#a78bfa", fontSize: 11, marginTop: 1 }}>
                  ● online
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 14px",
              }}
            >
              {messages.map((m, i) => (
                <Message key={i} msg={m} />
              ))}
              {loading && (
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      marginRight: 8,
                      flexShrink: 0,
                    }}
                  >
                    ✦
                  </div>
                  <div
                    style={{
                      background: "#1e1b2e",
                      borderRadius: "18px 18px 18px 4px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              style={{
                padding: "12px 14px",
                borderTop: "1px solid rgba(124,58,237,0.15)",
                background: "#0f0d1a",
                display: "flex",
                gap: 8,
                alignItems: "flex-end",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Digite sua mensagem..."
                rows={1}
                style={{
                  flex: 1,
                  background: "#1e1b2e",
                  border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: 12,
                  color: "#f0eeff",
                  fontSize: 13.5,
                  padding: "10px 12px",
                  resize: "none",
                  fontFamily: "Inter, sans-serif",
                  lineHeight: 1.5,
                  maxHeight: 100,
                  overflowY: "auto",
                }}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                }}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  border: "none",
                  background:
                    loading || !input.trim()
                      ? "#2d2550"
                      : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  color: loading || !input.trim() ? "#5b4b8a" : "#fff",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                  transition: "all .15s",
                  boxShadow:
                    !loading && input.trim()
                      ? "0 2px 10px rgba(124,58,237,0.4)"
                      : "none",
                }}
              >
                {loading ? (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid #5b4b8a",
                      borderTopColor: "#a78bfa",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                ) : (
                  "↑"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


// ── Ponto de entrada ──────────────────────────────────────────────────────────
const container = document.getElementById("moldelab-chat");
if (container) {
  createRoot(container).render(<MoldelabAssistant />);
}
