import { useCallback, useState } from "react";

// Hook isolado para o comando `ask <pergunta>` do Terminal.
// Só faz uma chamada de rede pra um endpoint fixo, sem tool-calling nem
// execução de comando/SQL. Qualquer erro (rede, rate limit, servidor fora do
// ar) vira uma mensagem amigável — nunca deixa a exceção subir pra UI.

// Terminal é sempre em inglês (chrome/mensagens do sistema) — ver Terminal.js.
const FALLBACK_MESSAGE = "AI unavailable right now, please try again later.";

function useTerminalAI() {
  const [loading, setLoading] = useState(false);

  const ask = useCallback(async (message) => {
    setLoading(true);

    try {
      const response = await fetch("/api/portfolio/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        return { ok: false, reply: FALLBACK_MESSAGE };
      }

      const data = await response.json().catch(() => null);

      if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
        return { ok: false, reply: FALLBACK_MESSAGE };
      }

      return { ok: true, reply: data.reply };
    } catch (error) {
      return { ok: false, reply: FALLBACK_MESSAGE };
    } finally {
      setLoading(false);
    }
  }, []);

  return { ask, loading };
}

export default useTerminalAI;
