// pages/app.js
import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import dynamic from "next/dynamic";

// ✅ Mantén tu Wizard (NO TOCO SU LÓGICA INTERNA)
// 👇 Solo lo conecto por props: onSubmit / onGenerateExcel
import ExcelWizardBubbles from "../components/ExcelWizardBubbles";
import StudioCanvas from "../components/studio/StudioCanvas";


const StudioCanvas = dynamic(
  () => import("../components/studio/StudioCanvas"),
  { ssr: false }
);

const TABS = [
  { key: "chat", title: "Chat AUREA" },
  { key: "images", title: "Imágenes" },
  { key: "code", title: "Código" },
  { key: "studio", title: "AUREA STUDIO 🚀" },
  { key: "excel", title: "Excel" },
];

/* ----------------------------- LocalStorage ----------------------------- */

function lsKey(uid) {
  return `aurea33:v2.1.4:${uid}:projects`;
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function loadProjectsLS(uid) {
  if (!uid) return null;
  const raw = localStorage.getItem(lsKey(uid));
  if (!raw) return null;
  return safeJsonParse(raw, null);
}

function saveProjectsLS(uid, payload) {
  if (!uid) return;
  localStorage.setItem(lsKey(uid), JSON.stringify(payload));
}

function uidNow() {
  return Date.now();
}

function makeId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function makeProject(title = "Nuevo proyecto") {
  const id = makeId();
  return {
    id,
    title,
    pinned: false,
    createdAt: uidNow(),
    updatedAt: uidNow(),
    tabs: {
      chat: { messages: [] },
      images: { messages: [] },
      code: { messages: [] },

      // ✅ Studio base (persistente)
      studio: {
        meta: {
          activeDocId: null,
          lastTemplate: null,
        },
        docs: [],
      },

      excel: {
        meta: {
          lastSpec: null,
          lastFileName: null,
          lastOkAt: null,
          lastError: null,
        },
      },
    },
  };
}


/* ----------------------------- Utilities ----------------------------- */

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openPrintWindow({ title, html }) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body{font-family: Arial, sans-serif; padding:24px; color:#111}
  h1{font-size:18px; margin:0 0 6px}
  .meta{font-size:12px; color:#444; margin-bottom:16px}
  .msg{border:1px solid #ddd; border-radius:10px; padding:10px 12px; margin:10px 0}
  .role{font-weight:700; font-size:12px; color:#333}
  .ts{font-size:11px; color:#777; margin-left:8px}
  .text{white-space:pre-wrap; margin-top:6px; font-size:12px}
  .pinned{border-color:#f7c600; box-shadow:0 0 0 2px rgba(247,198,0,.18) inset}
  img{max-width:640px; border-radius:10px; border:1px solid #ddd; margin-top:10px}
  @media print{ body{padding:0} .msg{break-inside:avoid} }
</style>
</head>
<body>
${html}
<script>
  setTimeout(()=>{ window.focus(); window.print(); }, 250);
</script>
</body>
</html>`);
  w.document.close();
}

// ✅ Parse filename desde Content-Disposition
function filenameFromDisposition(disposition, fallback = "AUREA_excel.xlsx") {
  try {
    if (!disposition) return fallback;
    const mStar = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (mStar?.[1]) return decodeURIComponent(mStar[1].trim().replaceAll('"', ""));
    const m = disposition.match(/filename\s*=\s*("?)([^";]+)\1/i);
    if (m?.[2]) return m[2].trim();
    return fallback;
  } catch {
    return fallback;
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function copyToClipboard(text) {
  if (!text) return false;
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const apply = () => setIsMobile(!!mq.matches);
    apply();

    // compat Safari/old
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, [breakpoint]);

  return isMobile;
}


/* ----------------------------- App Page ----------------------------- */

export default function AppPage() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // UI
  const [activeTab, setActiveTab] = useState("images");

// -----------------------------
// Theme (light / dark) ✅ FULL
// -----------------------------

// 1) State
const [theme, setTheme] = useState("dark"); // "light" | "dark"

// 2) Load theme on mount (localStorage)
useEffect(() => {
  if (typeof window === "undefined") return;
  const saved = localStorage.getItem("aurea33:theme");
  if (saved === "light" || saved === "dark") setTheme(saved);
}, []);

// 3) Persist theme
useEffect(() => {
  if (typeof window === "undefined") return;
  localStorage.setItem("aurea33:theme", theme);
}, [theme]);

// 4) Toggle helper
const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

const mobileOverlay = () => ({
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(6px)",
  zIndex: 9998,
});

const mobileDrawer = (open) => ({
  position: "fixed",
  top: 0,
  left: 0,
  bottom: 0,
  width: "min(86vw, 380px)",
  background: "rgba(10,12,18,0.92)",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
  zIndex: 9999,
  transform: open ? "translateX(0)" : "translateX(-102%)",
  transition: "transform 180ms ease-out",
  display: "flex",
  flexDirection: "column",
});


const drawerHeader = () => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
});

const drawerBody = () => ({
  padding: 12,
  overflow: "auto",
  flex: 1,
});


// 5) Vars (CSS custom props)
const themeVars = useMemo(() => {
  if (theme === "dark") {
    return {
      "--bg": "#0b0b0c",
      "--panel": "rgba(255,255,255,0.03)",
      "--panel2": "rgba(0,0,0,0.28)",
      "--border": "rgba(255,255,255,0.08)",
      "--text": "#ffffff",
      "--muted": "rgba(255,255,255,0.72)",
      "--gold": "#f7c600",
      "--shadow": "0 18px 60px rgba(0,0,0,0.55)",
      "--blur": "blur(10px)",
    };
  }

  // 🌤 Light premium (blanco / gris)
  return {
    "--bg": "#F4F5F7",
    "--panel": "#FFFFFF",
    "--panel2": "#FFFFFF",
    "--border": "rgba(15,23,42,0.10)",
    "--text": "#0F172A",
    "--muted": "rgba(15,23,42,0.65)",
    "--gold": "#C9A227",
    "--shadow": "0 18px 60px rgba(2,6,23,0.10)",
    "--blur": "blur(10px)",
  };
}, [theme]);

// 6) Base styles helpers (opcional pero recomendado)
const uiBase = useMemo(
  () => ({
    background: "var(--bg)",
    color: "var(--text)",
    minHeight: "100vh",
  }),
  []
);



  // Projects (persist)
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Inputs per tab (non-persist)
  const [chatInput, setChatInput] = useState("");
  const [imgPrompt, setImgPrompt] = useState("");
  const [codeInput, setCodeInput] = useState("");

  // Busy + status
  const [busy, setBusy] = useState(false);
  const [genStatus, setGenStatus] = useState("");

  // HUD/Inspector
  const [hudOpen, setHudOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  // Command palette / search
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [queryText, setQueryText] = useState("");

  // Toasts
  const [toasts, setToasts] = useState([]);

  // Abort
  const abortRef = useRef(null);

  // Scroll refs
  const chatListRef = useRef(null);
  const imgListRef = useRef(null);
  const codeListRef = useRef(null);

  // For project menus
  const [openMenuId, setOpenMenuId] = useState(null);

  // For MobileApp
  const isMobile = useIsMobile(980);

// hydration guard (CLAVE)
const [hydrated, setHydrated] = useState(false);
useEffect(() => setHydrated(true), []);

const safeIsMobile = hydrated ? isMobile : false;

const [sidebarOpen, setSidebarOpen] = useState(false);


useEffect(() => {
  if (!safeIsMobile) {
    setSidebarOpen(false);
    document.body.style.overflow = "";
    return;
  }

  const onKey = (e) => {
    if (e.key === "Escape") setSidebarOpen(false);
  };

  window.addEventListener("keydown", onKey);

  const prevOverflow = document.body.style.overflow;
  if (sidebarOpen) document.body.style.overflow = "hidden";

  return () => {
    window.removeEventListener("keydown", onKey);
    document.body.style.overflow = prevOverflow;
  };
}, [safeIsMobile, sidebarOpen]);

// 7) No Scroll crop por ECSS AUREA33


useEffect(() => {
  const html = document.documentElement;
  const body = document.body;

  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  const prevHtmlHeight = html.style.height;
  const prevBodyHeight = body.style.height;

  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  html.style.height = "100%";
  body.style.height = "100%";

  return () => {
    html.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
    html.style.height = prevHtmlHeight;
    body.style.height = prevBodyHeight;
  };
}, []);


  /* ----------------------------- Toasts ----------------------------- */
  const toast = (title, detail = "", kind = "ok", ms = 2800) => {
    const id = makeId();
    setToasts((prev) => [
      ...prev,
      { id, title, detail, kind, createdAt: uidNow(), ms: clamp(ms, 1200, 8000) },
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  };

  /* ----------------------------- Auth bootstrap ----------------------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
      if (!u) router.push("/login");
    });
    return () => unsub();
  }, [router]);

  const headerUser = useMemo(() => user?.email || "—", [user]);

  const getIdTokenForce = async () => {
    const u = auth.currentUser;
    if (!u) throw new Error("No hay usuario autenticado");
    return await u.getIdToken(true);
  };

  const onLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  /* ----------------------------- Projects load/save ----------------------------- */
  useEffect(() => {
    if (!authReady) return;
    if (!user?.uid) return;

    const data = loadProjectsLS(user.uid);

if (data?.projects?.length) {
  const patched = data.projects.map((p) => {
    const tabs = { ...(p.tabs || {}) };

    // 🔒 INYECTAR STUDIO SI NO EXISTE (proyectos viejos)
    if (!tabs.studio) {
      tabs.studio = {
        meta: {
          activeDocId: null,
          lastTemplate: null,
        },
        docs: [],
      };
    }

    return { ...p, tabs };
  });

  setProjects(patched);
  setActiveProjectId(data.activeProjectId || patched[0]?.id || null);
} else {
  const seed = [
    makeProject("gato astronauta"),
    makeProject("Genera una persona animada..."),
  ];
  setProjects(seed);
  setActiveProjectId(seed[0]?.id);
  saveProjectsLS(user.uid, { projects: seed, activeProjectId: seed[0]?.id });
}

  }, [authReady, user?.uid]);

  useEffect(() => {
    if (!authReady) return;
    if (!user?.uid) return;
    if (!projects?.length) return;
    saveProjectsLS(user.uid, { projects, activeProjectId });
  }, [projects, activeProjectId, authReady, user?.uid]);

  const activeProject = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find((p) => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const activeTabMessages = useMemo(() => {
  if (!activeProject) return [];
  if (activeTab === "chat") return activeProject.tabs?.chat?.messages || [];
  if (activeTab === "images") return activeProject.tabs?.images?.messages || [];
  if (activeTab === "code") return activeProject.tabs?.code?.messages || [];
  // ✅ Studio y Excel no se tratan como messages aquí
  return [];
}, [activeProject, activeTab]);


  const totalMessages = useMemo(() => {
  const p = activeProject;
  if (!p?.tabs) return 0;
  const c = p.tabs.chat?.messages?.length || 0;
  const i = p.tabs.images?.messages?.length || 0;
  const k = p.tabs.code?.messages?.length || 0;
  const s = p.tabs.studio?.docs?.length || 0;
  return c + i + k + s;
}, [activeProject]);


  const totalWords = useMemo(() => {
  const p = activeProject;
  if (!p?.tabs) return 0;
  const all = [
    ...(p.tabs.chat?.messages || []),
    ...(p.tabs.images?.messages || []),
    ...(p.tabs.code?.messages || []),
  ];
  const txt = all.map((m) => m.text || "").join(" ");
  return txt.trim() ? txt.trim().split(/\s+/).length : 0;
}, [activeProject]);


  const sortedProjects = useMemo(() => {
    const arr = [...(projects || [])];
    arr.sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return arr;
  }, [projects]);

  const updateActiveProject = (fn) => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === activeProjectId);
      if (idx < 0) return prev;
      const copy = [...prev];
      const updated = fn(copy[idx]);
      copy[idx] = { ...updated, updatedAt: uidNow() };
      return copy;
    });
  };

  const pushMsg = (tabKey, msg) => {
    updateActiveProject((p) => {
      const tabs = { ...(p.tabs || {}) };
      const tab = { ...(tabs[tabKey] || {}) };
      const messages = [
        ...(tab.messages || []),
        {
          id: makeId(),
          ts: uidNow(),
          pinned: false,
          ...msg,
        },
      ];
      tab.messages = messages;
      tabs[tabKey] = tab;
      return { ...p, tabs };
    });
  };

  /* ----------------------------- Pin message ----------------------------- */
  const toggleMessagePin = (tabKey, msgId) => {
    updateActiveProject((p) => {
      const tabs = { ...(p.tabs || {}) };
      const tab = { ...(tabs[tabKey] || {}) };
      const msgs = [...(tab.messages || [])];
      const idx = msgs.findIndex((m) => m.id === msgId);
      if (idx >= 0) msgs[idx] = { ...msgs[idx], pinned: !msgs[idx].pinned };
      tab.messages = msgs;
      tabs[tabKey] = tab;
      return { ...p, tabs };
    });
  };

  const pinnedMessagesForTab = useMemo(() => {
  const p = activeProject;
  if (!p?.tabs) return [];

  const msgs =
    activeTab === "chat"
      ? p.tabs.chat?.messages || []
      : activeTab === "images"
      ? p.tabs.images?.messages || []
      : activeTab === "code"
      ? p.tabs.code?.messages || []
      : [];

  return msgs.filter((m) => m.pinned);
}, [activeProject, activeTab]);


  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* ----------------------------- Export conversation ----------------------------- */
  const exportConversationTxt = (tabKey) => {
    const p = activeProject;
    if (!p) return;
    const msgs = p.tabs?.[tabKey]?.messages || [];
    const lines = [];
    lines.push(`AUREA 33 — Export TXT`);
    lines.push(`User: ${headerUser}`);
    lines.push(`Project: ${p.title}`);
    lines.push(`Tab: ${tabKey}`);
    lines.push(`Exported: ${new Date().toLocaleString()}`);
    lines.push(`----------------------------------------`);
    msgs.forEach((m) => {
      const ts = m.ts ? new Date(m.ts).toLocaleString() : "";
      lines.push(`[${ts}] ${m.role?.toUpperCase?.() || "MSG"}${m.pinned ? " (PIN)" : ""}`);
      if (m.text) lines.push(m.text);
      if (m.imageUrl) lines.push(`(imageUrl) ${m.imageUrl}`);
      lines.push("");
    });
    const filename = `aurea_${p.title.replace(/\s+/g, "_").slice(0, 32)}_${tabKey}.txt`;
    downloadText(filename, lines.join("\n"));
    toast("Export TXT", `Tab: ${tabKey}`, "ok");
  };

  const exportConversationPdf = (tabKey) => {
    const p = activeProject;
    if (!p) return;
    const msgs = p.tabs?.[tabKey]?.messages || [];

    const htmlMsgs = msgs
      .map((m) => {
        const ts = m.ts ? new Date(m.ts).toLocaleString() : "";
        const cls = m.pinned ? "msg pinned" : "msg";
        const text = m.text ? `<div class="text">${escapeHtml(m.text)}</div>` : "";
        const img = m.imageUrl ? `<img src="${escapeHtml(m.imageUrl)}" />` : "";
        return `<div class="${cls}">
          <div><span class="role">${escapeHtml(m.role || "msg")}</span><span class="ts">${escapeHtml(ts)}</span></div>
          ${text}
          ${img}
        </div>`;
      })
      .join("");

    const html = `
      <h1>${escapeHtml(p.title)} — ${escapeHtml(tabKey.toUpperCase())}</h1>
      <div class="meta">User: ${escapeHtml(headerUser)} • Export: ${escapeHtml(
      new Date().toLocaleString()
    )}</div>
      ${htmlMsgs}
    `;

    openPrintWindow({ title: `AUREA Export — ${p.title}`, html });
    toast("Export PDF", `Tab: ${tabKey}`, "ok");
  };

  /* ----------------------------- AutoScroll ----------------------------- */
  const scrollToBottom = (ref) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") scrollToBottom(chatListRef);
    if (activeTab === "images") scrollToBottom(imgListRef);
    if (activeTab === "code") scrollToBottom(codeListRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeProjectId]);

  useEffect(() => {
    if (activeTab === "chat") scrollToBottom(chatListRef);
    if (activeTab === "images") scrollToBottom(imgListRef);
    if (activeTab === "code") scrollToBottom(codeListRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabMessages?.length]);

  /* ----------------------------- Cancel ----------------------------- */
  const cancelAll = () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    setBusy(false);
    setGenStatus("");
    if (activeTab === "chat" || activeTab === "images" || activeTab === "code") {
      pushMsg(activeTab, { role: "assistant", text: "⛔ Cancelado por el usuario." });
    }
    toast("Cancelado", "Operación cancelada", "warn");
  };

  /* =======================================================================================
     ✅✅✅ IMAGES: NO TOCAR FLUJO (CREATE + POLL) ✅✅✅
     ======================================================================================= */

  async function createImageJob({ prompt, n = 1, size = "1024x1024" }) {
    const token = await getIdTokenForce();

    const r = await fetch("/api/images/create-job", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt, n, size }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "create-job failed");

    const jobId =
      data?.jobId ??
      data?.id ??
      data?.job?.id ??
      data?.job?.jobId ??
      data?.data?.jobId ??
      null;

    return { jobId, raw: data };
  }

  async function pollImageJobSafe({ jobId, maxMs = 180000, signal }) {
    const start = Date.now();
    let lastStatus = "";

    while (Date.now() - start < maxMs) {
      if (signal?.aborted) throw new Error("Aborted");

      const token = await getIdTokenForce();
      const url = `/api/images/get-job?jobId=${encodeURIComponent(jobId)}`;

      const r = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const e = data?.error || `get-job failed (${r.status})`;
        throw new Error(e);
      }

      const status = data?.status || data?.state || data?.job?.status || "";
      const imageUrl = data?.imageUrl || data?.url || data?.output?.[0]?.url || data?.job?.imageUrl;

      if (status && status !== lastStatus) {
        lastStatus = status;
        setGenStatus(`Estado: ${status}`);
      }

      if (imageUrl) return { ...data, imageUrl };

      await new Promise((res) => setTimeout(res, 800));
    }

    throw new Error("Timeout waiting for image");
  }

  function normalizeJobId(created) {
    const jobId =
      typeof created?.jobId === "string"
        ? created.jobId
        : typeof created?.raw?.jobId === "string"
        ? created.raw.jobId
        : typeof created?.raw?.id === "string"
        ? created.raw.id
        : typeof created?.raw?.job?.id === "string"
        ? created.raw.job.id
        : typeof created?.jobId?.jobId === "string"
        ? created.jobId.jobId
        : typeof created?.jobId?.id === "string"
        ? created.jobId.id
        : String(created?.jobId || created?.raw?.jobId || created?.raw?.id || "");

    if (!jobId || jobId === "[object Object]") {
      throw new Error("Invalid jobId returned from create-job");
    }
    return jobId;
  }

  async function sendImagePrompt() {
    const prompt = imgPrompt.trim();
    if (!prompt || busy || !activeProject) return;

    setImgPrompt("");
    setBusy(true);
    setGenStatus("Creando job...");

    pushMsg("images", { role: "user", text: prompt });

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const created = await createImageJob({ prompt, n: 1, size: "1024x1024" });
      const jobId = normalizeJobId(created);

      setGenStatus("Generando imagen...");
      const finalData = await pollImageJobSafe({
        jobId,
        signal: ac.signal,
        maxMs: 180000,
      });

      const imageUrl = finalData?.imageUrl;
      if (!imageUrl) throw new Error("No imageUrl returned");

      pushMsg("images", {
        role: "assistant",
        text: "✅ Imagen generada",
        imageUrl,
      });

      setGenStatus("Listo ✅");
      toast("Imagen lista", "Generación completada", "ok");
    } catch (e) {
      const msg = e?.message || "Error generando imagen";
      pushMsg("images", { role: "assistant", text: `⚠️ Error Imagen: ${msg}` });
      setGenStatus("");
      toast("Error imagen", msg, "error", 4200);
    } finally {
      setBusy(false);
    }
  }

  /* ----------------------------- Chat ----------------------------- */

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || busy || !activeProject) return;

    setChatInput("");
    setBusy(true);
    pushMsg("chat", { role: "user", text });

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const token = await getIdTokenForce().catch(() => null);

      let assistantText = "";
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, projectId: activeProjectId }),
        signal: ac.signal,
      }).catch(() => null);

      if (r && r.ok) {
        const data = await r.json().catch(() => ({}));
        assistantText = data?.text || data?.message || "";
      } else if (r && !r.ok) {
        const data = await r.json().catch(() => ({}));
        assistantText = `⚠️ /api/chat error ${r.status}: ${data?.error || "Unknown"}`;
      }

      if (!assistantText) assistantText = "💬 Chat AUREA listo.";

      pushMsg("chat", { role: "assistant", text: assistantText });
    } catch (e) {
      const msg = e?.message || "Error en chat";
      pushMsg("chat", { role: "assistant", text: `⚠️ Chat error: ${msg}` });
      toast("Chat error", msg, "error", 4200);
    } finally {
      setBusy(false);
    }
  }

  /* ----------------------------- Code ----------------------------- */

  async function sendCode() {
    const text = codeInput.trim();
    if (!text || busy || !activeProject) return;

    setCodeInput("");
    setBusy(true);
    pushMsg("code", { role: "user", text });

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const token = await getIdTokenForce().catch(() => null);

      let assistantText = "";
      const r = await fetch("/api/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: text, projectId: activeProjectId }),
        signal: ac.signal,
      }).catch(() => null);

      if (r && r.ok) {
        const data = await r.json().catch(() => ({}));
        assistantText = data?.text || data?.message || "";
      } else if (r && !r.ok) {
        const data = await r.json().catch(() => ({}));
        assistantText = `⚠️ /api/code error ${r.status}: ${data?.error || "Unknown"}`;
      }

      if (!assistantText) assistantText = "🧠 Modo Código listo.";

      pushMsg("code", { role: "assistant", text: assistantText });
    } catch (e) {
      const msg = e?.message || "Error en código";
      pushMsg("code", { role: "assistant", text: `⚠️ Código error: ${msg}` });
      toast("Code error", msg, "error", 4200);
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================================================
     ✅✅✅ EXCEL: CONEXIÓN REAL (WIZARD -> NEXT API -> DOWNLOAD) ✅✅✅
     (NO TOCO IMAGES)
     ======================================================================================= */

 // ✅ CAMBIO CLAVE: ya NO pegamos a 8081 (Flask). Ahora es Next API route.
const EXCEL_ENDPOINT = "/api/excel";

const setExcelMeta = (patch) => {
  updateActiveProject((p) => {
    const tabs = { ...(p.tabs || {}) };
    const excel = { ...(tabs.excel || {}) };
    const meta = { ...(excel.meta || {}) };
    excel.meta = { ...meta, ...patch };
    tabs.excel = excel;
    return { ...p, tabs };
  });
};

/* ----------------------------- Excel helpers ----------------------------- */

// Excel column letter from columns[] + key
function colLetter(columns, key) {
  const idx = columns.findIndex((c) => c.key === key);
  if (idx < 0) return "C";
  const n = idx + 1;
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

// ✅ KPIs dashboard refs reales (Option A: label arriba, valor abajo)
// KPI#0 -> B3, KPI#1 -> B5, KPI#2 -> B7, ... (saltos de 2 filas)
function kpiCellRefByIndex(i, valueCol = "B", firstValueRow = 3) {
  const row = firstValueRow + i * 2;
  return `Dashboard!$${valueCol}$${row}`;
}

function buildExampleRows(columns) {
  const base = {};
  columns.forEach((c) => {
    if (c.type === "date") base[c.key] = new Date().toISOString().slice(0, 10);
    else if (c.type === "currency") base[c.key] = Math.floor(1000 + Math.random() * 5000);
    else if (c.key === "estatus") base[c.key] = "Pendiente";
    else if (c.key === "banco") base[c.key] = "Caja";
    else if (c.key === "categoria") base[c.key] = "General";
    else if (c.key === "pago") base[c.key] = "Transferencia";
    else base[c.key] = "Ejemplo";
  });
  return [base];
}

/* ------------------------ Wizard payload -> spec ------------------------ */

const wizardPayloadToSpec = (payload) => {
  const fileName = payload?.file?.fileName || "AUREA_excel.xlsx";
  const sheetName = payload?.file?.sheetName || "Data";

  const purpose = (payload?.wizard?.purpose || "").toLowerCase();
  const controlType = (
    payload?.context?.controlType ||
    payload?.context?.control ||
    payload?.context?.type ||
    ""
  ).toLowerCase();
  const totals = (payload?.context?.totals_auto || payload?.context?.totals || "").toLowerCase();
  const dashboardTxt = String(payload?.context?.dashboard || "").toLowerCase();

  const wantsDashboard =
    dashboardTxt.includes("sí") ||
    dashboardTxt.includes("si") ||
    dashboardTxt.includes("recomend");

  const wantsRowColTotals = totals.includes("fila") || totals.includes("columna");
  const wantsCharts = !!payload?.preferences?.wantCharts;

  // 🎯 columnas base (Ingresos/Egresos)
  let columns = [
    { header: "Fecha", key: "fecha", type: "date", width: 14 },
    { header: "Concepto", key: "concepto", type: "text", width: 36 },
    { header: "Categoría", key: "categoria", type: "text", width: 20 },
    { header: "Forma de pago", key: "pago", type: "text", width: 16 },
    { header: "Ingreso", key: "ingreso", type: "currency", width: 14 },
    { header: "Egreso", key: "egreso", type: "currency", width: 14 },
  ];

  // ✅ Cuentas por cobrar/pagar
  const isCuentas =
    controlType.includes("cuentas") || purpose.includes("cobrar") || purpose.includes("pagar");

  if (isCuentas) {
    columns = [
      { header: "Fecha", key: "fecha", type: "date", width: 14 },
      { header: "Cliente/Proveedor", key: "tercero", type: "text", width: 26 },
      { header: "Concepto", key: "concepto", type: "text", width: 26 },
      { header: "Vence", key: "vence", type: "date", width: 14 },
      { header: "Estatus", key: "estatus", type: "text", width: 14 },
      { header: "Monto", key: "monto", type: "currency", width: 14 },
      { header: "Abono", key: "abono", type: "currency", width: 14 },
      { header: "Saldo", key: "saldo", type: "currency", width: 14 },
    ];
  }

  // ✅ Flujo de efectivo
  const isFlujo = controlType.includes("flujo") || purpose.includes("efectivo");
  if (isFlujo) {
    columns = [
      { header: "Fecha", key: "fecha", type: "date", width: 14 },
      { header: "Movimiento", key: "mov", type: "text", width: 34 },
      { header: "Banco/Caja", key: "banco", type: "text", width: 18 },
      { header: "Entrada", key: "entrada", type: "currency", width: 14 },
      { header: "Salida", key: "salida", type: "currency", width: 14 },
      { header: "Saldo", key: "saldo", type: "currency", width: 14 },
      { header: "Notas", key: "notas", type: "text", width: 22 },
    ];
  }

  const notes = {
    purpose: payload?.wizard?.purpose || "",
    level: payload?.wizard?.level || "",
    periodicity: payload?.wizard?.periodicity || "",
    industry: payload?.wizard?.industry || "",
    theme: payload?.preferences?.theme || "",
    wantCharts: !!payload?.preferences?.wantCharts,
    wantImages: !!payload?.preferences?.wantImages,
    context: payload?.context || {},
    uiOption: "A", // ✅ dashboard KPI sin merges (label arriba, valor abajo)
    totalsMode: wantsRowColTotals ? "row_col" : "general",
  };

  const sheets = [
    {
      name: sheetName || "Data",
      kind: "data",
      style: {
        header: { bold: true, freeze: true },
        zebra: true,
      },
      data: {
        columns,
        exampleRows: buildExampleRows(columns),
        totals: wantsRowColTotals
          ? {
              mode: "row_col",
              currencyCols: columns.filter((c) => c.type === "currency").map((c) => c.key),
            }
          : { mode: "general" },
      },
    },
  ];

  // ✅ KPIs deterministas, SIN KPI("..."), adaptados por tipo de hoja
  const kpis = [];

  if (isFlujo) {
    const L_in = colLetter(columns, "entrada");
    const L_out = colLetter(columns, "salida");
    kpis.push({ label: "Entradas", formula: `=SUM(${sheetName}!${L_in}:${L_in})`, format: "currency" });
    kpis.push({ label: "Salidas", formula: `=SUM(${sheetName}!${L_out}:${L_out})`, format: "currency" });
    // Balance = KPI0 - KPI1, refs reales Dashboard
    kpis.push({ label: "Balance", formula: `=${kpiCellRefByIndex(0)}-${kpiCellRefByIndex(1)}`, format: "currency" });
    kpis.push({ label: "Saldo total", formula: `=SUM(${sheetName}!${colLetter(columns, "saldo")}:${colLetter(columns, "saldo")})`, format: "currency" });
  } else if (isCuentas) {
    kpis.push({ label: "Monto total", formula: `=SUM(${sheetName}!${colLetter(columns, "monto")}:${colLetter(columns, "monto")})`, format: "currency" });
    kpis.push({ label: "Abonos", formula: `=SUM(${sheetName}!${colLetter(columns, "abono")}:${colLetter(columns, "abono")})`, format: "currency" });
    kpis.push({ label: "Saldo total", formula: `=SUM(${sheetName}!${colLetter(columns, "saldo")}:${colLetter(columns, "saldo")})`, format: "currency" });
    // Por si quieres “pendientes” numérico: COUNTIF en estatus
    kpis.push({ label: "Pendientes", formula: `=COUNTIF(${sheetName}!${colLetter(columns, "estatus")}:${colLetter(columns, "estatus")},"Pendiente")`, format: "number" });
  } else {
    // default Ingresos/Egresos
    const L_in = colLetter(columns, "ingreso");
    const L_out = colLetter(columns, "egreso");
    kpis.push({ label: "Ingresos", formula: `=SUM(${sheetName}!${L_in}:${L_in})`, format: "currency" });
    kpis.push({ label: "Egresos", formula: `=SUM(${sheetName}!${L_out}:${L_out})`, format: "currency" });
    kpis.push({ label: "Balance", formula: `=${kpiCellRefByIndex(0)}-${kpiCellRefByIndex(1)}`, format: "currency" });
  }

  if (wantsDashboard) {
    sheets.push({
      name: "Dashboard",
      kind: "dashboard",
      layout: {
        option: "A",
        kpiCard: { merge: false, labelTop: true },
        spacing: "comfortable",
      },
      charts: wantsCharts ? [{ type: "bar", title: "Resumen", from: sheetName }] : [],
      kpis,
    });
  }

  return {
    version: "1.1",
    workbook: {
      theme: "dark-gold",
      title: fileName.replace(/\.xlsx$/i, ""),
    },
    sheets,
    kpis,
    notes,
  };
};

/* --------------------------- Generate from wizard --------------------------- */

async function generateExcelFromWizard(payload) {
  if (!payload) throw new Error("No payload recibido del wizard");
  if (!activeProject) throw new Error("No hay proyecto activo");

  const fileName = payload?.file?.fileName || "AUREA_excel.xlsx";
  const spec = wizardPayloadToSpec(payload);

  setExcelMeta({
    lastSpec: spec,
    lastFileName: fileName,
    lastError: null,
  });

  if (abortRef.current) abortRef.current.abort();
  const ac = new AbortController();
  abortRef.current = ac;

  setBusy(true);
  setGenStatus("🧾 Generando Excel...");

  try {
    // ✅ opcional token (si tu /api/excel lo usa)
    const token = await getIdTokenForce().catch(() => null);

    const r = await fetch(EXCEL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        mode: "generate",
        engine: "exceljs",
        fileName,
        spec,
        wizard: payload?.wizard || null,
        preferences: payload?.preferences || null,
        context: payload?.context || null,
        file: payload?.file || null,
      }),
      signal: ac.signal,
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(txt || `HTTP ${r.status}`);
    }

    const blob = await r.blob();
    const dispo = r.headers.get("content-disposition");
    const serverName = filenameFromDisposition(dispo, fileName);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = serverName || fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setExcelMeta({
      lastOkAt: uidNow(),
      lastError: null,
      lastFileName: serverName || fileName,
    });

    setGenStatus("✅ Excel descargado");
    toast("Excel descargado ✅", serverName || fileName, "ok");
    return { ok: true, fileName: serverName || fileName };
  } finally {
    setBusy(false);
    setTimeout(() => setGenStatus(""), 900);
  }
}

const onWizardSubmit = async (payload) => {
  try {
    await generateExcelFromWizard(payload);
  } catch (e) {
    const msg = e?.message || "Failed to fetch";
    setExcelMeta({ lastError: msg });
    setGenStatus("");
    toast("Excel error", msg, "error", 4500);
    alert(`⚠️ Excel: ${msg}`);
  }
};

const generateExcelTest = async () => {
  const payload = {
    mode: "excel",
    wizard: {
      purpose: "Contable / Finanzas",
      level: "Profesional",
      periodicity: "Diario",
      industry: "Clínica / salud / consultorio",
    },
    preferences: { theme: "Dark/Gold (Aurea33)", wantCharts: true, wantImages: false },
    context: {
      columns_need: "Fecha, concepto, ingreso, egreso, categoría, forma de pago",
      totals_auto: "Sí, por fila y por columna",
      controlType: "Ingresos/Egresos",
      dashboard: "Sí (recomendado)",
    },
    file: { fileName: "prueba.xlsx", sheetName: "Data" },
  };

  try {
    await generateExcelFromWizard(payload);
  } catch (e) {
    const msg = e?.message || "Failed to fetch";
    setExcelMeta({ lastError: msg });
    toast("Excel error", msg, "error", 4500);
    alert(`⚠️ Excel: ${msg}`);
  }
};

const resetExcelMeta = () => {
  setExcelMeta({ lastSpec: null, lastFileName: null, lastOkAt: null, lastError: null });
  toast("Excel reset", "Meta limpia", "warn");
};

  /* ----------------------------- Sidebar: Projects ----------------------------- */
  const createNewProject = () => {
    const p = makeProject("Nuevo proyecto");
    setProjects((prev) => [p, ...(prev || [])]);
    setActiveProjectId(p.id);
    toast("Proyecto creado", p.title, "ok");
  };

  const renameProject = (id, title) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: title || p.title, updatedAt: uidNow() } : p))
    );
    toast("Renombrado", title, "ok");
  };

  const toggleProjectPin = (id) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned, updatedAt: uidNow() } : p))
    );
    setOpenMenuId(null);
  };

  const deleteProject = (id) => {
    setProjects((prev) => {
      const next = (prev || []).filter((p) => p.id !== id);
      if (activeProjectId === id) {
        const nextActive = next[0]?.id || null;
        setActiveProjectId(nextActive);
      }
      return next;
    });
    setOpenMenuId(null);
    toast("Proyecto eliminado", "", "warn");
  };

  const duplicateProject = (id) => {
    setProjects((prev) => {
      const src = prev.find((p) => p.id === id);
      if (!src) return prev;
      const copy = {
        ...src,
        id: makeId(),
        title: `${src.title} (copia)`,
        pinned: false,
        createdAt: uidNow(),
        updatedAt: uidNow(),
        tabs: safeJsonParse(JSON.stringify(src.tabs || {}), src.tabs || {}),
      };
      return [copy, ...prev];
    });
    setOpenMenuId(null);
    toast("Duplicado", "Proyecto copiado", "ok");
  };

  const exportProject = (id) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    downloadJson(`aurea_project_${p.title.replace(/\s+/g, "_").slice(0, 40)}.json`, p);
    setOpenMenuId(null);
    toast("Export JSON", p.title, "ok");
  };

  const resetProject = (id) => {
  setProjects((prev) =>
    prev.map((p) => {
      if (p.id !== id) return p;
      const tabs = {
        chat: { messages: [] },
        images: { messages: [] },
        code: { messages: [] },
        studio: { meta: { activeDocId: null, lastTemplate: null }, docs: [] },
        excel: { meta: {} },
      };
      return { ...p, tabs, updatedAt: uidNow() };
    })
  );
  setOpenMenuId(null);
  toast("Reset", "Mensajes borrados", "warn");
};

  /* ----------------------------- UX: Quick Actions (local) ----------------------------- */
  const quickForTab = (tabKey, kind) => {
    if (!activeProject) return;
    const msgs = activeProject.tabs?.[tabKey]?.messages || [];
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.text || "";
    if (!lastUser) return;

    if (kind === "improve") {
      if (tabKey === "images") setImgPrompt(`Mejora este prompt y hazlo más específico:\n${lastUser}`);
      if (tabKey === "chat") setChatInput(`Mejora mi mensaje para que sea más claro:\n${lastUser}`);
      if (tabKey === "code") setCodeInput(`Mejora este prompt técnico y sé preciso:\n${lastUser}`);
    }
    if (kind === "continue") {
      if (tabKey === "chat") setChatInput(`Continúa esta idea y profundiza:\n${lastUser}`);
      if (tabKey === "code") setCodeInput(`Continúa y completa el código/solución:\n${lastUser}`);
      if (tabKey === "images") setImgPrompt(`Variación creativa del prompt manteniendo el concepto:\n${lastUser}`);
    }
    if (kind === "summary") {
      if (tabKey === "chat") setChatInput(`Resume nuestra conversación actual en 6 bullets.`);
      if (tabKey === "code") setCodeInput(`Resume la solución propuesta y próximos pasos en bullets.`);
      if (tabKey === "images") setImgPrompt(`Resume en 1 línea el estilo deseado y los elementos clave del prompt.`);
    }

    toast("Quick Action", `${kind} (${tabKey})`, "ok");
  };

  /* ----------------------------- Global click close menus ----------------------------- */
  useEffect(() => {
    const onDoc = () => setOpenMenuId(null);
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  /* ----------------------------- Hotkeys: Ctrl+K / Ctrl+F / Esc ----------------------------- */
  useEffect(() => {
    const onKey = (e) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ----------------------------- Search (projects + messages) ----------------------------- */
  const searchResults = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return { projects: [], messages: [] };

    const projs = sortedProjects
      .filter((p) => (p.title || "").toLowerCase().includes(q))
      .slice(0, 10);

    const msgs = [];
    sortedProjects.forEach((p) => {
      const tabs = ["chat", "images", "code"];
      tabs.forEach((t) => {
        (p.tabs?.[t]?.messages || []).forEach((m) => {
          const txt = (m.text || "").toLowerCase();
          if (txt.includes(q)) {
            msgs.push({
              projectId: p.id,
              projectTitle: p.title,
              tab: t,
              msgId: m.id,
              role: m.role,
              text: m.text || "",
              ts: m.ts,
            });
          }
        });
      });
    });

    return {
      projects: projs,
      messages: msgs.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 18),
    };
  }, [queryText, sortedProjects]);

  const jumpToSearchMessage = (r) => {
    setActiveProjectId(r.projectId);
    setActiveTab(r.tab);
    setSearchOpen(false);
    setTimeout(() => scrollToMessage(r.msgId), 140);
    toast("Jump", `${r.projectTitle} → ${r.tab}`, "ok");
  };

  /* ----------------------------- loader seguro ----------------------------- */
  if (!authReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0b0b0c",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
        }}
      >
        Cargando AUREA…
      </div>
    );
  }

  const modeLabel = `${compact ? "compact" : "ready"} • MULTI`;
  const excelMeta = activeProject?.tabs?.excel?.meta || {};
  const apiExcelStatus = excelMeta?.lastOkAt ? "ok" : excelMeta?.lastError ? "error" : "—";

/* ✅ AQUÍ MISMO, ANTES DEL return */
const SidebarContent = () => (
  <>
    <div style={sidebarHeader()}>
      <div style={{ fontWeight: 900 }}>AUREA CORE</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Proyectos persistentes • Tabs fijos • Historial local
      </div>
    </div>

    <div style={sidebarActions()}>
      <div style={{ fontWeight: 900, opacity: 0.9 }}>PROYECTOS</div>
      <button style={btnGhostSmall()} onClick={createNewProject}>
        + Nuevo
      </button>
    </div>

    {/* Live Metrics */}
    <div style={metricsWrap()}>
      <div style={metricCard()}>
        <div style={metricLabel()}>Mensajes</div>
        <div style={metricValue()}>{totalMessages}</div>
      </div>
      <div style={metricCard()}>
        <div style={metricLabel()}>Palabras</div>
        <div style={metricValue()}>{totalWords}</div>
      </div>
      <div style={metricCardWide()}>
        <div style={metricLabel()}>Último</div>
        <div style={metricValueSmall()}>{new Date(uidNow()).toLocaleString()}</div>
      </div>

      <div style={metricCardWide(activeTab === "chat" ? "ok" : "idle")}>
        <div style={metricLabel()}>API Chat</div>
        <div style={metricValueSmall()}>{activeTab === "chat" ? "ok" : "—"}</div>
      </div>
      <div style={metricCardWide(activeTab === "code" ? "ok" : "idle")}>
        <div style={metricLabel()}>API Code</div>
        <div style={metricValueSmall()}>{activeTab === "code" ? "ok" : "unknown"}</div>
      </div>
      <div
        style={metricCardWide(
          apiExcelStatus === "ok" ? "ok" : apiExcelStatus === "error" ? "err" : "idle"
        )}
      >
        <div style={metricLabel()}>API Excel</div>
        <div style={metricValueSmall()}>{apiExcelStatus}</div>
      </div>
    </div>

    <div style={miniTabsRow()}>
      <span style={miniTabPill(activeTab === "chat")} onClick={() => setActiveTab("chat")}>
        💬 Chat
      </span>
      <span style={miniTabPill(activeTab === "code")} onClick={() => setActiveTab("code")}>
        🧠 Code
      </span>
      <span style={miniTabPill(activeTab === "images")} onClick={() => setActiveTab("images")}>
        🖼️ Images
      </span>
      <span style={miniTabPill(activeTab === "studio")} onClick={() => setActiveTab("studio")}>
        🎛️ Studio
      </span>
      <span style={miniTabPill(activeTab === "excel")} onClick={() => setActiveTab("excel")}>
        📄 Excel
      </span>
    </div>

    <div style={projectList()}>
      {sortedProjects.map((p) => {
        const active = p.id === activeProjectId;
        return (
          <div
            key={p.id}
            style={projectItem(active)}
            onClick={() => setActiveProjectId(p.id)}
            title={p.title}
          >
            <div style={projectTitle()}>
              {p.pinned ? "⭐ " : ""}
              {p.title}
            </div>
            <div style={projectSub()}>
              {new Date(p.updatedAt || p.createdAt).toLocaleString()}
            </div>

            <button
              style={miniPill()}
              onClick={(e) => {
                e.stopPropagation();
                const next = prompt("Renombrar proyecto:", p.title);
                if (next && next.trim()) renameProject(p.id, next.trim());
              }}
              title="Renombrar"
            >
              ✏️
            </button>

            <button
              style={miniPillDots(active)}
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId((v) => (v === p.id ? null : p.id));
              }}
              title="Más acciones"
            >
              ⋯
            </button>

            {openMenuId === p.id && (
              <div style={menuPanel()} onClick={(e) => e.stopPropagation()}>
                <button style={menuItem()} onClick={() => toggleProjectPin(p.id)}>
                  {p.pinned ? "⭐ Desfijar proyecto" : "⭐ Fijar proyecto"}
                </button>

                <button style={menuItem()} onClick={() => duplicateProject(p.id)}>
                  📄 Duplicar
                </button>
                <button style={menuItem()} onClick={() => exportProject(p.id)}>
                  ⬇️ Exportar JSON
                </button>

                <div style={menuSep()} />

                <button
                  style={menuItem()}
                  onClick={() => {
                    setActiveProjectId(p.id);
                    setTimeout(() => exportConversationTxt(activeTab === "excel" ? "chat" : activeTab), 0);
                    setOpenMenuId(null);
                  }}
                >
                  🧾 Exportar TAB a TXT
                </button>

                <button
                  style={menuItem()}
                  onClick={() => {
                    setActiveProjectId(p.id);
                    setTimeout(() => exportConversationPdf(activeTab === "excel" ? "chat" : activeTab), 0);
                    setOpenMenuId(null);
                  }}
                >
                  🖨️ Exportar TAB a PDF
                </button>

                <div style={menuSep()} />

                <button
                  style={menuItem()}
                  onClick={() => {
                    const ok = confirm("¿Resetear mensajes de este proyecto? (no borra el proyecto)");
                    if (ok) resetProject(p.id);
                  }}
                >
                  ↩️ Reset mensajes
                </button>

                <div style={menuSep()} />

                <button
                  style={menuItemDanger()}
                  onClick={() => {
                    const ok = confirm("¿Eliminar este proyecto? Esto no se puede deshacer.");
                    if (ok) deleteProject(p.id);
                  }}
                >
                  🗑️ Eliminar
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ fontSize: 12, opacity: 0.55, marginTop: 8 }}>
        Tip: 1 proyecto = 1 cliente / campaña / tarea
      </div>
    </div>
  </>
);

const MobileSidebarContent = SidebarContent;


  return (
    <>
      <Head>
        <title>AUREA 33 Studio</title>
      </Head>

      <div style={{ ...page(compact), ...themeVars }}>
        <div style={ambientGrid()} />
        <div style={ambientGlow()} />

        {/* Top bar */}
        <div style={topbar()}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={logoCircle()}>A</div>
            <div>
              <div style={{ fontWeight: 900, letterSpacing: 0.5 }}>
                AUREA 33 STUDIO // LIVE
                <span style={{ marginLeft: 10, fontSize: 11, opacity: 0.7 }}>
                  (Ctrl+K palette • Ctrl+F search)
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={chip()}>READY • MULTI • font 12px</span>
                <span style={chipSoft()}>Proyecto: {activeProject?.title || "—"}</span>
                <span style={chipSoft()}>Sesión: {headerUser}</span>
              </div>
            </div>
          </div>
{/* ✅ Mobile Drawer (MENÚ) */}
{safeIsMobile && (
  <>
    {sidebarOpen && (
      <div style={mobileOverlay()} onClick={() => setSidebarOpen(false)} />
    )}

    <div style={mobileDrawer(sidebarOpen)}>
      <div style={drawerHeader()}>
        <div style={{ fontWeight: 900, letterSpacing: 0.4 }}>
          AUREA 33 MENU
        </div>

        <button onClick={() => setSidebarOpen(false)} style={btnGhost()}>
          ✕
        </button>
      </div>

      <div style={drawerBody()}>
        <MobileSidebarContent />
      </div>
    </div>
  </>
)}

          <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  }}
>
  {isMobile && (
    <button
      onClick={() => setSidebarOpen(true)}
      style={btnGhost()}
      title="Menú"
    >
      ☰
    </button>
  )}

  <button onClick={() => setSearchOpen(true)} style={btnGhost()}>
    Buscar (Ctrl+F)
  </button>

  <button onClick={() => setPaletteOpen(true)} style={btnGhost()}>
    Comandos (Ctrl+K)
  </button>

  <button
    onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
    style={btnGhost()}
  >
    {theme === "light" ? "🌞 Light" : "🌙 Dark"}
  </button>

  <button onClick={() => setInspectorOpen((v) => !v)} style={btnGhost()}>
    Inspector
  </button>

            <button onClick={() => setHudOpen((v) => !v)} style={btnGhost()}>
              {hudOpen ? "✓ HUD" : "HUD"}
            </button>
            <button onClick={() => setCompact((v) => !v)} style={btnGhost()}>
              {compact ? "✓ Compact" : "Compact"}
            </button>
            <button onClick={cancelAll} style={btnDanger()} disabled={!busy} title="Cancelar">
              ⛔ Cancelar
            </button>
            <button onClick={() => router.push("/dashboard")} style={btnGhost()}>
              ← Dashboard
            </button>
            <button onClick={onLogout} style={btnPrimary()}>
              Logout
            </button>
          </div>
        </div>

        {/* Main */}
        <div style={layout(compact, hudOpen || inspectorOpen)}>

          {/* Sidebar */}
         <aside style={{ ...sidebar(), ...(isMobile ? { display: "none" } : {}) }}>
  <SidebarContent />
</aside>


          {/* Content */}
          <main style={mainCard()}>
            {/* Tabs */}
            <div style={tabsBar()}>
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={tabBtn(activeTab === t.key)}>
                  {t.title}
                </button>
              ))}

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={statusPill(busy ? "busy" : "idle")}>
                  {busy ? "PROCESSING" : `IDLE • ${activeTab.toUpperCase()}`}
                </span>
                <span style={statusPill("ok")}>Listo ✅</span>
              </div>
            </div>

            {/* Banner */}
            <div style={banner()}>
              {activeTab === "images" && "🖼️ Imágenes listo. Describe y genero. (Images backend intacto)."}
              {activeTab === "chat" && "💬 Chat AUREA conectado. Historial por proyecto."}
              {activeTab === "code" && "🧠 Código conectado. Historial por proyecto."}
              {activeTab === "excel" && "📄 Excel Wizard activo (con descarga conectada + spec PRO)."}
            </div>

            {/* Body */}
            <div style={mainBody()}>
              {/* Pins */}
              {(activeTab === "chat" || activeTab === "images" || activeTab === "code") && pinnedMessagesForTab.length > 0 && (
                <div style={pinsWrap()}>
                  <div style={{ fontWeight: 900, opacity: 0.92 }}>📌 Pines</div>
                  <div style={pinsRow()}>
                    {pinnedMessagesForTab.slice(0, 12).map((m) => (
                      <button key={m.id} style={pinChip()} onClick={() => scrollToMessage(m.id)} title="Ir al mensaje">
                        {m.role === "user" ? "YOU" : "AUREA"}: {(m.text || "…").slice(0, 46)}
                      </button>
                    ))}
                    {pinnedMessagesForTab.length > 12 && (
                      <span style={{ opacity: 0.6 }}>+{pinnedMessagesForTab.length - 12} más</span>
                    )}
                  </div>
                </div>
              )}

              {/* IMAGES */}
              {activeTab === "images" && (
                <>
                  {genStatus ? <div style={statusLine()}>{genStatus}</div> : <div style={statusSpacer()} />}

                  <div ref={imgListRef} style={chatArea(compact)}>
                    {(activeProject?.tabs?.images?.messages || []).map((m) => (
                      <RowMessage
                        key={m.id}
                        m={m}
                        compact={compact}
                        onTogglePin={() => toggleMessagePin("images", m.id)}
                        onCopy={() => {
                          if (copyToClipboard(m.text || "")) toast("Copiado", "Texto copiado", "ok");
                        }}
                      />
                    ))}
                    {busy ? <TypingRow compact={compact} /> : null}
                  </div>

                  <QuickActions
                    onSummary={() => quickForTab("images", "summary")}
                    onImprove={() => quickForTab("images", "improve")}
                    onContinue={() => quickForTab("images", "continue")}
                    onExportTxt={() => exportConversationTxt("images")}
                    onExportPdf={() => exportConversationPdf("images")}
                  />

                  <div style={inputRow()}>
                    <input
                      value={imgPrompt}
                      onChange={(e) => setImgPrompt(e.target.value)}
                      placeholder="Describe la imagen que quieres generar..."
                      style={input()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendImagePrompt();
                      }}
                      disabled={busy}
                    />
                    <button onClick={sendImagePrompt} style={btnPrimary()} disabled={busy}>
                      Enviar
                    </button>
                  </div>
                </>
              )}

              {/* CHAT */}
              {activeTab === "chat" && (
                <>
                  <div ref={chatListRef} style={chatArea(compact)}>
                    {(activeProject?.tabs?.chat?.messages || []).map((m) => (
                      <RowMessage
                        key={m.id}
                        m={m}
                        compact={compact}
                        onTogglePin={() => toggleMessagePin("chat", m.id)}
                        onCopy={() => {
                          if (copyToClipboard(m.text || "")) toast("Copiado", "Texto copiado", "ok");
                        }}
                      />
                    ))}
                    {busy ? <TypingRow compact={compact} /> : null}
                  </div>

                  <QuickActions
                    onSummary={() => quickForTab("chat", "summary")}
                    onImprove={() => quickForTab("chat", "improve")}
                    onContinue={() => quickForTab("chat", "continue")}
                    onExportTxt={() => exportConversationTxt("chat")}
                    onExportPdf={() => exportConversationPdf("chat")}
                  />

                  <div style={inputRow()}>
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Escribe tu mensaje..."
                      style={input()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendChat();
                      }}
                      disabled={busy}
                    />
                    <button onClick={sendChat} style={btnPrimary()} disabled={busy}>
                      Enviar
                    </button>
                  </div>
                </>
              )}

              {/* STUDIO */}
                {activeTab === "studio" && (
                  <div style={{ height: "100%", overflow: "hidden" }}>
                   <StudioCanvas
                   projectId={activeProjectId}
                    studio={activeProject?.tabs?.studio || { meta: {}, docs: [] }}
                    onChange={(nextStudio) => {
                     updateActiveProject((p) => {
                       const tabs = { ...(p.tabs || {}) };
                     tabs.studio = nextStudio;
                         return { ...p, tabs };
                       });
                    }}
                   />
                </div>
               )}



              {/* CODE */}
              {activeTab === "code" && (
                <>
                  <div ref={codeListRef} style={chatArea(compact)}>
                    {(activeProject?.tabs?.code?.messages || []).map((m) => (
                      <RowMessage
                        key={m.id}
                        m={m}
                        compact={compact}
                        onTogglePin={() => toggleMessagePin("code", m.id)}
                        onCopy={() => {
                          if (copyToClipboard(m.text || "")) toast("Copiado", "Texto copiado", "ok");
                        }}
                      />
                    ))}
                    {busy ? <TypingRow compact={compact} /> : null}
                  </div>

                  <QuickActions
                    onSummary={() => quickForTab("code", "summary")}
                    onImprove={() => quickForTab("code", "improve")}
                    onContinue={() => quickForTab("code", "continue")}
                    onExportTxt={() => exportConversationTxt("code")}
                    onExportPdf={() => exportConversationPdf("code")}
                  />

                  <div style={inputRow()}>
                    <input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="Pega código o describe lo que quieres..."
                      style={input()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendCode();
                      }}
                      disabled={busy}
                    />
                    <button onClick={sendCode} style={btnPrimary()} disabled={busy}>
                      Enviar
                    </button>
                  </div>
                </>
              )}

              {/* EXCEL */}
              {activeTab === "excel" && (
                <div style={{ height: "100%", overflow: "auto", paddingRight: 6 }}>
                  <div style={excelTopRow()}>
                    <div style={{ fontWeight: 900, opacity: 0.9 }}>
                      📄 Excel Wizard • {excelMeta?.lastOkAt ? "Listo ✅" : "—"}
                    </div>

                    <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                      <button style={btnGhostSmall()} onClick={resetExcelMeta} disabled={busy}>
                        Reset
                      </button>
                      <button
                        style={btnGhostSmall()}
                        onClick={() => {
                          const spec = excelMeta?.lastSpec || null;
                          if (!spec) {
                            toast("No spec", "Aún no hay spec guardado", "warn");
                            alert("No hay spec guardado aún.");
                            return;
                          }
                          downloadJson("aurea_last_spec.json", spec);
                          toast("Debug Spec", "JSON descargado", "ok");
                        }}
                        disabled={busy}
                      >
                        Debug Spec
                      </button>
                      <button
                        style={btnGhostSmall()}
                        onClick={() => {
                          const spec = excelMeta?.lastSpec || null;
                          if (!spec) return;
                          const ok = copyToClipboard(JSON.stringify(spec, null, 2));
                          if (ok) toast("Copiado", "Spec copiado al portapapeles", "ok");
                        }}
                        disabled={busy}
                      >
                        Copy Spec
                      </button>
                    </div>
                  </div>

                  {excelMeta?.lastError ? (
                    <div style={excelError()}>
                      ⚠️ {excelMeta.lastError}
                      <span style={{ opacity: 0.7 }}> • endpoint: {EXCEL_ENDPOINT}</span>
                    </div>
                  ) : null}

                  {/* ✅ Conexión REAL: props onSubmit + onGenerateExcel */}
                  <ExcelWizardBubbles onSubmit={onWizardSubmit} onGenerateExcel={onWizardSubmit} />

                  <div style={excelHint()}>
                    Tip PRO: este build genera un <b>spec determinista</b> dependiendo de tu wizard (controlType, totales y dashboard opción A).
                    Si “se ve igual”, es porque tu backend de Excel está ignorando partes del spec. Usa “Debug Spec” y compárame.
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={generateExcelTest} style={btnPrimary()} disabled={busy}>
                      Generar Excel (TEST)
                    </button>
                    <button
                      onClick={() => {
                        const spec = excelMeta?.lastSpec;
                        if (!spec) return toast("Sin spec", "Genera uno primero", "warn");
                        const filename = `spec_${(activeProject?.title || "proyecto").replace(/\s+/g, "_")}.json`;
                        downloadJson(filename, spec);
                        toast("Spec exportado", filename, "ok");
                      }}
                      style={btnGhostSmall()}
                      disabled={busy}
                    >
                      Export Spec
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* HUD panel */}
          {hudOpen && (
            <div style={hudPanel()}>
              <div style={hudHeader()}>
                <div style={{ fontWeight: 900 }}>HUD</div>
                <button style={hudClose()} onClick={() => setHudOpen(false)}>
                  ✕
                </button>
              </div>

              <div style={hudCard()}>
                <div style={hudLabel()}>SYSTEM</div>
                <div style={hudText()}>
                  USER: <b>{headerUser}</b>
                </div>
                <div style={hudText()}>
                  PROJECT: <b>{activeProject?.title || "—"}</b>
                </div>
                <div style={hudText()}>
                  MODE: <b>{modeLabel}</b>
                </div>
              </div>

              <div style={hudCard()}>
                <div style={hudLabel()}>STATE</div>
                <div style={hudText()}>
                  TAB: <b>{activeTab}</b>
                </div>
                <div style={hudText()}>
                  BUSY: <b>{busy ? "YES" : "NO"}</b>
                </div>
                <div style={hudText()}>
                  STATUS: <b>{genStatus || "—"}</b>
                </div>
              </div>

              <div style={hudCard()}>
                <div style={hudLabel()}>TOOLS</div>

                <button
                  style={hudBtn()}
                  onClick={() => exportConversationTxt(activeTab === "excel" ? "chat" : activeTab)}
                  disabled={busy}
                >
                  🧾 Export TXT (TAB)
                </button>
                <button
                  style={hudBtn()}
                  onClick={() => exportConversationPdf(activeTab === "excel" ? "chat" : activeTab)}
                  disabled={busy}
                >
                  🖨️ Export PDF (TAB)
                </button>
                <button style={hudBtn()} onClick={generateExcelTest} disabled={busy} title="Valida endpoint y descarga">
                  📄 Generar Excel (TEST)
                </button>

                <button
                  style={hudBtnSoft()}
                  onClick={() => {
                    setSearchOpen(true);
                    toast("Search", "Busca mensajes globalmente", "ok");
                  }}
                  disabled={busy}
                >
                  🔎 Buscar (Ctrl+F)
                </button>
              </div>
            </div>
          )}

          {/* Inspector */}
          {inspectorOpen && (
            <div style={inspectorPanel()}>
              <div style={hudHeader()}>
                <div style={{ fontWeight: 900 }}>Inspector</div>
                <button style={hudClose()} onClick={() => setInspectorOpen(false)}>
                  ✕
                </button>
              </div>
              <div style={hudCard()}>
                <div style={hudLabel()}>DEBUG</div>
                <pre style={inspectorPre()}>
{JSON.stringify(
  {
    activeProjectId,
    activeTab,
    busy,
    genStatus,
    projectsCount: projects?.length || 0,
    pinnedInTab: pinnedMessagesForTab.length,
    excel: {
      endpoint: EXCEL_ENDPOINT,
      lastOkAt: excelMeta?.lastOkAt || null,
      lastError: excelMeta?.lastError || null,
      lastFileName: excelMeta?.lastFileName || null,
      hasSpec: !!excelMeta?.lastSpec,
    },
  },
  null,
  2
)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Toasts */}
        <div style={toastStack()}>
          {toasts.slice(-4).map((t) => (
            <div key={t.id} style={toastCard(t.kind)}>
              <div style={{ fontWeight: 900 }}>{t.title}</div>
              {t.detail ? <div style={{ opacity: 0.85, marginTop: 4 }}>{t.detail}</div> : null}
            </div>
          ))}
        </div>

        {/* Search modal */}
        {searchOpen && (
          <Modal onClose={() => setSearchOpen(false)} title="Buscar (proyectos + mensajes)">
            <div style={{ display: "flex", gap: 10 }}>
              <input
                style={modalInput()}
                placeholder="Busca por palabra clave…"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                autoFocus
              />
              <button style={btnGhostSmall()} onClick={() => setQueryText("")}>
                Limpiar
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900, opacity: 0.85 }}>Proyectos</div>
              <div style={{ display: "grid", gap: 8 }}>
                {searchResults.projects.length ? (
                  searchResults.projects.map((p) => (
                    <button
                      key={p.id}
                      style={searchItem()}
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setSearchOpen(false);
                        toast("Proyecto", p.title, "ok");
                      }}
                    >
                      ⭐ {p.title}
                    </button>
                  ))
                ) : (
                  <div style={{ opacity: 0.6 }}>—</div>
                )}
              </div>

              <div style={{ fontWeight: 900, opacity: 0.85, marginTop: 6 }}>Mensajes</div>
              <div style={{ display: "grid", gap: 8, maxHeight: 260, overflow: "auto" }}>
                {searchResults.messages.length ? (
                  searchResults.messages.map((r) => (
                    <button key={`${r.projectId}-${r.msgId}`} style={searchMsgItem()} onClick={() => jumpToSearchMessage(r)}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900, opacity: 0.9 }}>
                          {r.projectTitle} • {r.tab.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.6 }}>
                          {r.ts ? new Date(r.ts).toLocaleString() : ""}
                        </div>
                      </div>
                      <div style={{ marginTop: 6, opacity: 0.85 }}>
                        <span style={{ fontWeight: 900 }}>{r.role === "user" ? "YOU: " : "AUREA: "}</span>
                        {(r.text || "").slice(0, 140)}
                      </div>
                    </button>
                  ))
                ) : (
                  <div style={{ opacity: 0.6 }}>—</div>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* Command palette */}
        {paletteOpen && (
          <Modal onClose={() => setPaletteOpen(false)} title="Command Palette">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ opacity: 0.75 }}>
                Acciones rápidas. Tip: usa esto como “control central” del producto.
              </div>

              <div style={cmdGrid()}>
                <CmdBtn
                  label="Ir a Chat"
                  hint="Switch tab"
                  onClick={() => {
                    setActiveTab("chat");
                    setPaletteOpen(false);
                    toast("Tab", "Chat", "ok");
                  }}
                />
                <CmdBtn
                  label="Ir a Images"
                  hint="Switch tab"
                  onClick={() => {
                    setActiveTab("images");
                    setPaletteOpen(false);
                    toast("Tab", "Images", "ok");
                  }}
                />
                <CmdBtn
                  label="Ir a Code"
                  hint="Switch tab"
                  onClick={() => {
                    setActiveTab("code");
                    setPaletteOpen(false);
                    toast("Tab", "Code", "ok");
                  }}
                />
                <CmdBtn
                  label="Ir a Excel"
                  hint="Switch tab"
                  onClick={() => {
                    setActiveTab("excel");
                    setPaletteOpen(false);
                    toast("Tab", "Excel", "ok");
                  }}
                />

                <CmdBtn
                  label="Nuevo proyecto"
                  hint="Create"
                  onClick={() => {
                    createNewProject();
                    setPaletteOpen(false);
                  }}
                />
                <CmdBtn
                  label="Buscar"
                  hint="Global search"
                  onClick={() => {
                    setSearchOpen(true);
                    setPaletteOpen(false);
                  }}
                />
                <CmdBtn
                  label="Export TXT (tab)"
                  hint="Export"
                  onClick={() => {
                    exportConversationTxt(activeTab === "excel" ? "chat" : activeTab);
                    setPaletteOpen(false);
                  }}
                />
                <CmdBtn
                  label="Export PDF (tab)"
                  hint="Export"
                  onClick={() => {
                    exportConversationPdf(activeTab === "excel" ? "chat" : activeTab);
                    setPaletteOpen(false);
                  }}
                />
                <CmdBtn
                  label="Cancelar"
                  hint="Abort"
                  danger
                  onClick={() => {
                    cancelAll();
                    setPaletteOpen(false);
                  }}
                />
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}

/* ----------------------------- Components ----------------------------- */

function QuickActions({ onSummary, onImprove, onContinue, onExportTxt, onExportPdf }) {
  return (
    <div style={quickRow()}>
      <button style={quickBtn()} onClick={onSummary}>
        ✨ Resumen
      </button>
      <button style={quickBtn()} onClick={onImprove}>
        🛠️ Mejorar prompt
      </button>
      <button style={quickBtn()} onClick={onContinue}>
        ➜ Continuar
      </button>

      <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        <button style={quickBtn()} onClick={onExportTxt}>
          🧾 TXT
        </button>
        <button style={quickBtn()} onClick={onExportPdf}>
          🖨️ PDF
        </button>
      </div>
    </div>
  );
}

function TypingRow({ compact }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div style={bubble(false, compact)}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={badge("assistant")}>AUREA</span>
          <span style={{ opacity: 0.9 }}>Procesando</span>
          <span style={typingDots()} />
        </div>
      </div>
    </div>
  );
}

function RowMessage({ m, compact, onTogglePin, onCopy }) {
  const isUser = m.role === "user";
  return (
    <div id={`msg-${m.id}`} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={bubble(isUser, compact)}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={badge(isUser ? "user" : "assistant")}>{isUser ? "YOU" : "AUREA"}</span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>{m.ts ? new Date(m.ts).toLocaleTimeString() : ""}</span>
            {m.pinned ? <span style={{ fontSize: 11, opacity: 0.9 }}>📌</span> : null}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={miniIconBtn()} onClick={onCopy} title="Copiar texto">
              ⧉
            </button>
            <button style={pinBtn(m.pinned)} onClick={onTogglePin} title={m.pinned ? "Quitar pin" : "Pin mensaje"}>
              {m.pinned ? "📌" : "📍"}
            </button>
          </div>
        </div>

        {m.text ? <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div> : null}

        {m.imageUrl ? (
          <div style={{ marginTop: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.imageUrl}
              alt="generated"
              style={{
                width: 320,
                height: "auto",
                borderRadius: 12,
                display: "block",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <a href={m.imageUrl} target="_blank" rel="noreferrer" style={btnGhostLink()}>
                Abrir
              </a>
              <a href={m.imageUrl} download style={btnPrimaryLink()}>
                Descargar
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={modalOverlay()} onClick={onClose}>
      <div style={modalCard()} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader()}>
          <div style={{ fontWeight: 900 }}>{title}</div>
          <button style={hudClose()} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={modalBody()}>{children}</div>
      </div>
    </div>
  );
}

function CmdBtn({ label, hint, onClick, danger }) {
  return (
    <button style={cmdBtn(danger)} onClick={onClick}>
      <div style={{ fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{hint}</div>
    </button>
  );
}

/* ----------------------------- Styles (inline) ----------------------------- */
/* (Todo igual que tu archivo; NO toqué nada fuera del bloque EXCEL) */

function page() {
  return {
    height: "100dvh",          // 👈 en vez de minHeight
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 12,
    lineHeight: 1.35,
    letterSpacing: 0.2,
    overflow: "hidden",        // 👈 bloquea scroll global
    display: "flex",           // 👈 CLAVE
    flexDirection: "column",   // 👈 CLAVE
  };
}



function ambientGrid() {
  return {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    opacity: 0.22,
    backgroundImage:
      "linear-gradient(rgba(247,198,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(247,198,0,0.04) 1px, transparent 1px)",
    backgroundSize: "48px 48px",
    filter: "blur(0px)",
    maskImage: "radial-gradient(circle at 50% 25%, black 0%, black 55%, transparent 78%)",
  };
}

function ambientGlow() {
  return {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(800px 400px at 30% 40%, rgba(247,198,0,0.14), transparent 60%), radial-gradient(900px 520px at 70% 30%, rgba(47,107,255,0.14), transparent 60%)",
    opacity: 0.9,
    filter: "blur(8px)",
  };
}

function topbar() {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    position: "sticky",
    top: 0,
    background: "var(--panel2)",
    backdropFilter: "var(--blur)",
    zIndex: 30,
  };
}


function chip() {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(247,198,0,0.25)",
    background: "rgba(247,198,0,0.08)",
    color: "#f7c600",
    fontWeight: 900,
  };
}

function chipSoft() {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--panel)",
    color: "var(--text)",
    fontWeight: 800,
  };
}


function logoCircle() {
  return {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(247,198,0,0.14)",
    border: "1px solid rgba(247,198,0,0.35)",
    fontWeight: 900,
    color: "#f7c600",
    boxShadow: "0 0 22px rgba(247,198,0,0.16)",
  };
}

function layout(compact, rightOpen) {
  const left = compact ? 290 : 320;
  const right = compact ? 320 : 340;

  return {
    display: "grid",
    gridTemplateColumns: rightOpen ? `${left}px 1fr ${right}px` : `${left}px 1fr`,
    gap: 14,
    padding: 14,

    width: "100%",
    flex: 1,            // 👈 CLAVE: ocupa el resto debajo del topbar
    minHeight: 0,       // 👈 CLAVE: permite que los hijos scrolleen bien
    overflow: "hidden", // 👈 sin scroll externo
    alignItems: "stretch",
  };
}



function sidebar() {
  return {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    backdropFilter: "var(--blur)",
  };
}

function sidebarHeader() {
  return {
    padding: 14,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };
}

function sidebarActions() {
  return {
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };
}

function metricsWrap() {
  return {
    padding: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };
}

function metricCard(variant) {
  const base = {
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.28)",
  };
  if (variant === "ok") {
    base.border = "1px solid rgba(60,220,130,0.28)";
    base.background = "rgba(60,220,130,0.10)";
  }
  if (variant === "err") {
    base.border = "1px solid rgba(255,80,80,0.28)";
    base.background = "rgba(255,80,80,0.10)";
  }
  return base;
}

function metricCardWide(variant) {
  const base = metricCard(variant);
  return { ...base, gridColumn: "span 2" };
}

function metricLabel() {
  return { fontSize: 11, opacity: 0.7, fontWeight: 900 };
}
function metricValue() {
  return { fontSize: 18, fontWeight: 900, marginTop: 2 };
}
function metricValueSmall() {
  return { fontSize: 12, fontWeight: 900, marginTop: 4, opacity: 0.92 };
}

function miniTabsRow() {
  return {
    padding: "10px 12px",
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };
}

function miniTabPill(active) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
    border: active ? "1px solid rgba(247,198,0,0.55)" : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(247,198,0,0.10)" : "rgba(255,255,255,0.03)",
    fontWeight: 900,
    fontSize: 12,
    userSelect: "none",
  };
}

function projectList() {
  return {
    padding: 12,
    display: "grid",
    gap: 10,
    overflow: "auto",
    minHeight: 0,
  };
}

function projectItem(active) {
  return {
    position: "relative",
    padding: "10px 10px 10px 12px",
    borderRadius: 14,
    border: active ? "1px solid rgba(247,198,0,0.7)" : "1px solid rgba(255,255,255,0.06)",
    background: active ? "rgba(247,198,0,0.08)" : "rgba(255,255,255,0.02)",
    cursor: "pointer",
    boxShadow: active ? "0 0 26px rgba(247,198,0,0.08)" : "none",
    transition: "transform .12s ease",
  };
}

function projectTitle() {
  return {
    fontWeight: 900,
    fontSize: 12,
    maxWidth: 230,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function projectSub() {
  return {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 3,
  };
}

function miniPill() {
  return {
    position: "absolute",
    top: 8,
    right: 38,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 11,
    padding: "4px 7px",
    opacity: 0.9,
  };
}

function miniPillDots(active) {
  return {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 999,
    border: active ? "1px solid rgba(247,198,0,0.35)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(247,198,0,0.08)" : "transparent",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 14,
    padding: "2px 8px",
    opacity: 0.95,
    lineHeight: "18px",
  };
}

function menuPanel() {
  return {
    position: "absolute",
    top: 34,
    right: 8,
    width: 210,
    zIndex: 50,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,10,12,0.92)",
    backdropFilter: "blur(10px)",
    overflow: "hidden",
    boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
  };
}

function menuItem() {
  return {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    borderBottom: "1px solid var(--border)",
  };
}


function menuItemDanger() {
  return {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    background: "rgba(255,80,80,0.10)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}

function menuSep() {
  return { height: 1, background: "rgba(255,255,255,0.06)" };
}

function mainCard() {
  return {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,

    // ✅ CLAVE para grid layouts
    minWidth: 0,

    backdropFilter: "var(--blur)",
  };
}


function tabsBar() {
  return {
    display: "flex",
    gap: 10,
    padding: 14,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    alignItems: "center",
  };
}

function tabBtn(active) {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: active ? "var(--gold)" : "transparent",
    color: active ? "#111" : "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}


function statusPill(kind) {
  const base = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    fontWeight: 900,
    fontSize: 12,
  };
  if (kind === "busy") {
    base.border = "1px solid rgba(247,198,0,0.25)";
    base.background = "rgba(247,198,0,0.10)";
    base.color = "#f7c600";
  }
  if (kind === "ok") {
    base.border = "1px solid rgba(60,220,130,0.25)";
    base.background = "rgba(60,220,130,0.10)";
    base.color = "#b6ffcf";
  }
  return base;
}

function banner() {
  return {
    padding: "10px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontSize: 12,
    opacity: 0.92,
  };
}

function mainBody() {
  return {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 0,
    height: "100%",

    // ✅ CLAVE
    minWidth: 0,
  };
}


function statusLine() {
  return { fontSize: 12, opacity: 0.95, fontWeight: 900, color: "#f7c600" };
}
function statusSpacer() {
  return { height: 18 };
}

function chatArea(compact) {
  return {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    display: "grid",
    gap: compact ? 10 : 12,
    padding: 8,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.28)",
    boxShadow: "inset 0 0 0 1px rgba(247,198,0,0.03)",
  };
}

function pinsWrap() {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
  };
}

function pinsRow() {
  return { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 };
}

function pinChip() {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(247,198,0,0.22)",
    background: "rgba(247,198,0,0.10)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    maxWidth: 360,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function quickRow() {
  return {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "8px 8px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
  };
}

function quickBtn() {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.20)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}

function inputRow() {
  return { display: "flex", gap: 10, marginTop: 2 };
}

function badge(type) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 11,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  };
  if (type === "assistant") {
    base.border = "1px solid rgba(247,198,0,0.25)";
    base.background = "rgba(247,198,0,0.10)";
    base.color = "#f7c600";
  }
  if (type === "user") {
    base.border = "1px solid rgba(47,107,255,0.25)";
    base.background = "rgba(47,107,255,0.14)";
    base.color = "#cfe1ff";
  }
  return base;
}

function bubble(isUser, compact) {
  return {
    maxWidth: 980,
    padding: compact ? 10 : 12,
    borderRadius: 14,
    background: isUser ? "rgba(47,107,255,0.88)" : "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: isUser ? "0 0 26px rgba(47,107,255,0.18)" : "0 0 22px rgba(247,198,0,0.05)",
    fontSize: 12,
  };
}

function typingDots() {
  return {
    display: "inline-block",
    width: 34,
    height: 10,
    background: "linear-gradient(90deg, rgba(247,198,0,0.0), rgba(247,198,0,0.8), rgba(247,198,0,0.0))",
    borderRadius: 999,
    animation: "aureaPulse 1.1s ease-in-out infinite",
  };
}

function pinBtn(active) {
  return {
    borderRadius: 10,
    border: active ? "1px solid rgba(247,198,0,0.35)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(247,198,0,0.12)" : "rgba(0,0,0,0.20)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    padding: "4px 8px",
  };
}

function miniIconBtn() {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.20)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    padding: "4px 8px",
    opacity: 0.9,
  };
}

function input() {
  return {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--panel2)",
    color: "var(--text)",
    outline: "none",
    fontSize: 12,
  };
}


function btnPrimary() {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#f7c600",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function btnGhost() {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}


function btnDanger() {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,80,80,0.25)",
    background: "rgba(255,80,80,0.12)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}

function btnGhostSmall() {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}


function btnGhostLink() {
  return {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

function btnPrimaryLink() {
  return {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 10,
    background: "#f7c600",
    color: "#111",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

/* ----------------------------- HUD / Inspector Panels ----------------------------- */

function hudPanel() {
  return {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    overflow: "hidden",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    backdropFilter: "blur(10px)",
  };
}

function inspectorPanel() {
  return hudPanel();
}

function hudHeader() {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };
}

function hudClose() {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    borderRadius: 10,
    cursor: "pointer",
    padding: "6px 10px",
    fontWeight: 900,
    fontSize: 12,
  };
}

function hudCard() {
  return {
    margin: 12,
    marginTop: 0,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.22)",
  };
}

function hudLabel() {
  return { fontSize: 11, opacity: 0.7, fontWeight: 900, marginBottom: 6 };
}

function hudText() {
  return { fontSize: 12, opacity: 0.92, marginBottom: 4 };
}

function hudBtn() {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(247,198,0,0.18)",
    background: "rgba(247,198,0,0.08)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    marginTop: 8,
  };
}

function hudBtnSoft() {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    marginTop: 8,
  };
}

function inspectorPre() {
  return {
    margin: 0,
    fontSize: 11,
    opacity: 0.9,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
}

/* ----------------------------- Excel UI helpers ----------------------------- */

function excelTopRow() {
  return {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    marginBottom: 10,
  };
}

function excelError() {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,80,80,0.25)",
    background: "rgba(255,80,80,0.10)",
    fontWeight: 900,
    fontSize: 12,
    marginBottom: 10,
  };
}

function excelHint() {
  return {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.22)",
    fontSize: 12,
    opacity: 0.9,
  };
}

/* ----------------------------- Modal / Palette / Search ----------------------------- */

function modalOverlay() {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
    display: "grid",
    placeItems: "center",
    padding: 18,
  };
}

function modalCard() {
  return {
    width: "min(860px, 100%)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,10,12,0.92)",
    boxShadow: "0 30px 120px rgba(0,0,0,0.65)",
    overflow: "hidden",
  };
}

function modalHeader() {
  return {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };
}

function modalBody() {
  return { padding: 12 };
}

function modalInput() {
  return {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.30)",
    color: "#fff",
    outline: "none",
    fontWeight: 800,
  };
}

function searchItem() {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 900,
  };
}

function searchMsgItem() {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
  };
}

function cmdGrid() {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
}

function cmdBtn(danger) {
  return {
    padding: 12,
    borderRadius: 14,
    border: danger ? "1px solid rgba(255,80,80,0.25)" : "1px solid rgba(255,255,255,0.10)",
    background: danger ? "rgba(255,80,80,0.10)" : "rgba(255,255,255,0.04)",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
  };
}

/* ----------------------------- Toasts ----------------------------- */

function toastStack() {
  return {
    position: "fixed",
    right: 14,
    bottom: 14,
    zIndex: 90,
    display: "grid",
    gap: 10,
    width: 320,
    pointerEvents: "none",
  };
}

function toastCard(kind) {
  const base = {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,10,12,0.92)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
  };
  if (kind === "ok") {
    base.border = "1px solid rgba(60,220,130,0.22)";
  }
  if (kind === "warn") {
    base.border = "1px solid rgba(247,198,0,0.22)";
  }
  if (kind === "error") {
    base.border = "1px solid rgba(255,80,80,0.26)";
  }
  return base;
}
