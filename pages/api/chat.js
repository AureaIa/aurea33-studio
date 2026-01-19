// pages/api/chat.js

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

function clamp(str = "", max = 8000) {
  str = String(str || "");
  return str.length > max ? str.slice(0, max) : str;
}

function safeHistory(history) {
  // history: [{role:'user'|'assistant', content:'...'}]
  if (!Array.isArray(history)) return [];
  const cleaned = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-24) // ✅ memoria corta (últimos 24)
    .map((m) => ({
      role: m.role,
      content: clamp(m.content, 2000),
    }));
  return cleaned;
}

function isStream(req) {
  const accept = req.headers.accept || "";
  return accept.includes("text/event-stream") || req.query.stream === "1";
}

function sseInit(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write(`event: ready\ndata: {}\n\n`);
}

function sseSend(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// ✅ Rate limit ultra simple en memoria (dev/local)
const _rl = globalThis.__AUREA_RL__ || (globalThis.__AUREA_RL__ = new Map());
function rateLimit(key, limit = 25, windowMs = 60_000) {
  const now = Date.now();
  const entry = _rl.get(key) || { n: 0, t: now };
  if (now - entry.t > windowMs) {
    entry.n = 0;
    entry.t = now;
  }
  entry.n += 1;
  _rl.set(key, entry);
  return entry.n <= limit;
}

async function callOpenAI({ apiKey, payload, signal }) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  return r;
}

function buildSystem({ mode = "fast" }) {
  // mode: fast | precise | creative
  const style =
    mode === "precise"
      ? "Eres AUREA 33. Sé extremadamente preciso, técnico, con pasos claros. Si falta contexto, asume lo mínimo y dilo."
      : mode === "creative"
      ? "Eres AUREA 33. Sé creativo, futurista, propositivo, pero siempre útil y accionable."
      : "Eres AUREA 33. Responde rápido, claro y directo. Prioriza utilidad.";

  return `${style}
Reglas:
- Español.
- Respuestas estructuradas cuando convenga (bullets, pasos, checklist).
- Si piden código, devuelve código listo para pegar.
- No inventes: si algo es suposición, dilo.`;
}

function buildTools() {
  // Tools “pasados de lanza” pero simples:
  // - summarize: resume conversación
  // - name_project: sugiere nombre corto para el proyecto
  // - next_actions: da 5 próximos pasos
  return [
    {
      type: "function",
      name: "summarize_thread",
      description: "Resume el hilo en bullets, decisiones y pendientes.",
      parameters: {
        type: "object",
        properties: {
          bullets: { type: "integer", default: 7 },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "suggest_project_name",
      description: "Sugiere un nombre corto y potente para el proyecto basado en el hilo.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      type: "function",
      name: "next_actions",
      description: "Devuelve próximos pasos accionables (máximo 7) con prioridad.",
      parameters: {
        type: "object",
        properties: {
          max: { type: "integer", default: 5 },
        },
        required: [],
      },
    },
  ];
}

function toolImpl(name, args, context) {
  const { history, userMessage, projectId } = context;

  if (name === "summarize_thread") {
    const bullets = Math.min(Math.max(args?.bullets ?? 7, 3), 12);
    const joined = [...history.map((m) => `${m.role}: ${m.content}`), `user: ${userMessage}`].join("\n");
    // Resumen local simple (rápido). Si quieres, lo hacemos con otro call al modelo.
    return {
      summary: joined
        .split("\n")
        .slice(-bullets)
        .map((l) => `• ${l.slice(0, 120)}`)
        .join("\n"),
      projectId: projectId || "—",
    };
  }

  if (name === "suggest_project_name") {
    const last = userMessage.slice(0, 60);
    return { name: `AUREA • ${last.replace(/[^\wáéíóúüñ\s-]/gi, "").trim()}`.slice(0, 44) };
  }

  if (name === "next_actions") {
    const max = Math.min(Math.max(args?.max ?? 5, 3), 7);
    const actions = [
      "Conectar streaming UI (si aún no).",
      "Agregar guardado de history por proyecto (ya lo tienes en localStorage).",
      "Implementar modo fast/precise toggle en UI.",
      "Registrar métricas (latencia, tokens estimados).",
      "Agregar export de conversación por TAB (ya lo tienes).",
      "Agregar botón ‘limpiar chat’ por proyecto.",
      "Agregar retry inteligente en errores 429/5xx.",
    ].slice(0, max);
    return { actions };
  }

  return { ok: false };
}

async function runNonStreaming({ apiKey, model, system, history, userMessage, projectId, mode }) {
  const payload = {
    model,
    input: [
      { role: "system", content: system },
      ...history,
      {
        role: "user",
        content: `project:${projectId || "—"}\nmode:${mode}\nmsg:${userMessage}`,
      },
    ],
    // tool support (non-stream)
    tools: buildTools(),
    tool_choice: "auto",
  };

  const r = await callOpenAI({ apiKey, payload });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || "OpenAI error");

  // ✅ si el modelo pidió tool call
  const toolCall = data?.output?.find?.((x) => x.type === "tool_call");
  if (toolCall?.name) {
    const result = toolImpl(toolCall.name, toolCall.arguments || {}, { history, userMessage, projectId });
    // devolvemos tool output + un texto amable
    return {
      text: `✅ Tool: ${toolCall.name}\n\n${JSON.stringify(result, null, 2)}`,
      meta: { tool: toolCall.name, result },
    };
  }

  const text =
    data?.output_text ||
    data?.output?.[0]?.content?.[0]?.text ||
    "Sin respuesta del modelo.";

  return { text, meta: { model } };
}

async function runStreaming({ req, res, apiKey, model, system, history, userMessage, projectId, mode }) {
  sseInit(res);

  const payload = {
    model,
    input: [
      { role: "system", content: system },
      ...history,
      {
        role: "user",
        content: `project:${projectId || "—"}\nmode:${mode}\nmsg:${userMessage}`,
      },
    ],
    stream: true,
    tools: buildTools(),
    tool_choice: "auto",
  };

  const ac = new AbortController();
  req.on("close", () => ac.abort());

  const r = await callOpenAI({ apiKey, payload, signal: ac.signal });
  if (!r.ok || !r.body) {
    const data = await r.json().catch(() => ({}));
    sseSend(res, "error", { error: data?.error?.message || `OpenAI error ${r.status}` });
    res.end();
    return;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";
  let fullText = "";

  // Responses stream devuelve chunks tipo "event: ..." (SSE)
  // Lo pasamos tal cual pero también extraemos delta de texto.
  while (true) {
    const { done, value } = await reader.read().catch(() => ({ done: true, value: null }));
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part.split("\n");
      const dataLine = lines.find((l) => l.startsWith("data: "));
      if (!dataLine) continue;

      const jsonStr = dataLine.replace("data: ", "").trim();
      if (jsonStr === "[DONE]") continue;

      const evt = safeJsonParseSSE(jsonStr);
      if (!evt) continue;

      // extrae texto incremental
      const delta = evt?.delta?.text || evt?.response?.output_text || "";
      if (delta) {
        fullText += delta;
        sseSend(res, "delta", { text: delta });
      }

      // tool call detect (si llega)
      if (evt?.type === "response.output_item.added" && evt?.item?.type === "tool_call") {
        sseSend(res, "tool", { name: evt?.item?.name });
      }

      // fin
      if (evt?.type === "response.completed") {
        sseSend(res, "done", { text: fullText, meta: { model } });
      }
    }
  }

  // Si por alguna razón no llegó "completed"
  if (!fullText) {
    sseSend(res, "done", { text: "✅ Listo. (sin delta)", meta: { model } });
  }
  res.end();
}

function safeJsonParseSSE(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req);
  const ok = rateLimit(ip, 40, 60_000); // 40 req/min por IP local
  if (!ok) return res.status(429).json({ error: "Rate limit: espera 1 minuto." });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const body = req.body || {};
    const message = clamp(body.message || "", 4000).trim();
    const projectId = clamp(body.projectId || "", 120);
    const mode = ["fast", "precise", "creative"].includes(body.mode) ? body.mode : "fast";
    const history = safeHistory(body.history);

    if (!message) return res.status(400).json({ error: "Missing message" });

    const model = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
    const system = buildSystem({ mode });

    // ✅ STREAMING (si el cliente lo pide)
    if (isStream(req)) {
      await runStreaming({ req, res, apiKey, model, system, history, userMessage: message, projectId, mode });
      return;
    }

    // ✅ JSON normal (fallback)
    const out = await runNonStreaming({ apiKey, model, system, history, userMessage: message, projectId, mode });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
