// pages/api/code.js

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};

function clamp(str = "", max = 12000) {
  str = String(str || "");
  return str.length > max ? str.slice(0, max) : str;
}

function safeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-30)
    .map((m) => ({ role: m.role, content: clamp(m.content, 2500) }));
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// ultra simple RL (dev/local)
const _rl = globalThis.__AUREA_CODE_RL__ || (globalThis.__AUREA_CODE_RL__ = new Map());
function rateLimit(key, limit = 35, windowMs = 60_000) {
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

function buildSystem({ mode = "precise", stack = "nextjs" }) {
  return `Eres AUREA 33 CODE — un ingeniero senior obsesionado con calidad.
Objetivo: generar código que funcione al primer intento, minimizando errores.

Stack actual: ${stack}

Reglas:
- Responde en español.
- Si falta información CRÍTICA, primero pregunta SOLO lo mínimo (máx 3 preguntas). Si no es crítico, asume y explícitalo.
- Siempre entrega salida usable: código completo o patch por archivo.
- Si el usuario pega código con error, explica causa + fix exacto.
- Incluye: (1) implementación, (2) pasos para correr/verificar, (3) mini checklist de edge cases.
- Prioriza: robustez, tipado si aplica, manejo de errores, y claridad.
- Evita “depende”; decide y avanza.

Formato de salida (muy importante):
1) "Diagnóstico" (breve)
2) "Solución" (código)
3) "Cómo probar" (pasos)
4) "Edge cases" (bullets)

Modo: ${mode} (precise|fast|creative)`;
}

async function callOpenAI({ apiKey, payload, signal }) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal,
  });
  return r;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req);
  if (!rateLimit(ip)) return res.status(429).json({ error: "Rate limit: espera 1 minuto." });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const body = req.body || {};
    const prompt = clamp(body.prompt || body.message || "", 9000).trim();
    const projectId = clamp(body.projectId || "", 120);
    const mode = ["fast", "precise", "creative"].includes(body.mode) ? body.mode : "precise";
    const stack = clamp(body.stack || "nextjs-firebase", 80);
    const history = safeHistory(body.history);

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const model = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
    const system = buildSystem({ mode, stack });

    const payload = {
      model,
      input: [
        { role: "system", content: system },
        ...history,
        {
          role: "user",
          content:
            `project:${projectId || "—"}\n` +
            `modo:${mode}\n` +
            `stack:${stack}\n\n` +
            `Solicitud:\n${prompt}`,
        },
      ],
      // 🔥 fuerza a que sea “código listo”
      reasoning: { effort: "medium" },
    };

    const r = await callOpenAI({ apiKey, payload });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "OpenAI error" });

    const text =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      "Sin respuesta del modelo.";

    // Meta útil para tu HUD/inspector si quieres
    return res.status(200).json({
      text,
      meta: {
        model,
        mode,
        stack,
        projectId: projectId || null,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
