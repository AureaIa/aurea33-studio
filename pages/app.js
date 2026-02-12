// pages/app.js
import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

import { getAuthToken } from "../lib/getAuthToken";

// ✅ Mantén tu Wizard (NO TOCO SU LÓGICA INTERNA)
// 👇 Solo lo conecto por props: onSubmit / onGenerateExcel
import ExcelWizardBubbles from "../components/ExcelWizardBubbles";

import dynamic from "next/dynamic";

const CanvasEditorClient = dynamic(() => import("../components/studio/CanvasEditor"), {
  ssr: false,
});

const TABS = [
  { key: "chat", title: "Chat AUREA" },
  { key: "images", title: "Imágenes" },
  { key: "code", title: "Código" },
  { key: "studio", title: "AUREA STUDIO 🚀" },
  { key: "excel", title: "Excel" },
];

const [pHover, setPHover] = useState(false);
const [pDown, setPDown] = useState(false);
const [pFocus, setPFocus] = useState(false);

<button
  style={{
    ...btnPrimary(),
    ...(pHover ? btnPrimaryHover() : null),
    ...(pDown ? btnPrimaryActive() : null),
    ...(pFocus ? btnFocusRingGold() : null),
  }}
  onMouseEnter={() => setPHover(true)}
  onMouseLeave={() => { setPHover(false); setPDown(false); }}
  onMouseDown={() => setPDown(true)}
  onMouseUp={() => setPDown(false)}
  onFocus={() => setPFocus(true)}
  onBlur={() => setPFocus(false)}
>
  Guardar
</button>

/* ----------------------------- LocalStorage ----------------------------- */

function lsKey(uid) {
  return `aurea33:v2.1.4:${uid}:projects`;
}

function lsKeyActiveTab(uid) {
  return `aurea33:v2:activeTab:${uid || "anon"}`;
}
function lsKeySidebar(uid) {
  return `aurea33:v2:sidebarCollapsed:${uid || "anon"}`;
}

// ✅ SaaS Pro: persistencia inmediata del canvas por proyecto (refresh instantáneo)
function studioDocKey(uid, projectId) {
  return `aurea33:studioDoc:${uid || "anon"}:${projectId || "no_project"}`;
}

// ✅ SaaS Pro: índice local (mini-book) por usuario
function studioIndexKey(uid) {
  return `aurea33:studioIndex:${uid || "anon"}`;
}

function safeGetLS(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function safeSetLS(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {}
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

    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, [breakpoint]);

  return isMobile;
}

/* ----------------------------- Studio doc helpers ----------------------------- */

function makeStudioDoc(title = "Doc 1") {
  const id = makeId();
  return {
    id,
    title,
    createdAt: uidNow(),
    updatedAt: uidNow(),
    // 👇 ESTE ES EL DOC REAL DEL CANVAS
    doc: {
      meta: { w: 1080, h: 1080, bg: "#0B1220", zoom: 1, panX: 0, panY: 0 },
      selectedId: null,
      nodes: [
        {
          id: "n1",
          type: "rect",
          x: 140,
          y: 140,
          width: 800,
          height: 360,
          fill: "#111827",
          cornerRadius: 28,
          rotation: 0,
        },
        {
          id: "n2",
          type: "text",
          x: 200,
          y: 240,
          text: "AUREA STUDIO",
          fontSize: 72,
          fontFamily: "Inter, system-ui",
          fill: "#F7C600",
          rotation: 0,
        },
        {
          id: "n3",
          type: "text",
          x: 200,
          y: 330,
          text: "Canvas persistente por proyecto ✅",
          fontSize: 28,
          fontFamily: "Inter, system-ui",
          fill: "#E5E7EB",
          rotation: 0,
        },
      ],
    },
  };
}

function ensureStudioHasActiveDoc(studio) {
  const s = studio || { meta: { activeDocId: null, lastTemplate: null }, docs: [] };
  const docs = Array.isArray(s.docs) ? s.docs : [];
  let activeDocId = s.meta?.activeDocId || null;

  if (!docs.length) {
    const first = makeStudioDoc("Mi primer canvas");
    return {
      meta: { ...(s.meta || {}), activeDocId: first.id },
      docs: [first],
    };
  }

  if (!activeDocId || !docs.some((d) => d.id === activeDocId)) {
    activeDocId = docs[0].id;
  }

  return {
    meta: { ...(s.meta || {}), activeDocId },
    docs,
  };
}

// ✅ SaaS Pro: cargar/guardar doc por proyecto (refresh inmediato)
function loadStudioDocLS(uid, projectId) {
  if (typeof window === "undefined") return null;
  const raw = safeGetLS(studioDocKey(uid, projectId), null);
  return raw ? safeJsonParse(raw, null) : null;
}
function saveStudioDocLS(uid, projectId, doc) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(studioDocKey(uid, projectId), JSON.stringify(doc));
  } catch {}
}

// ✅ SaaS Pro: índice local mini-book
function loadStudioIndexLS(uid) {
  if (typeof window === "undefined") return [];
  const raw = safeGetLS(studioIndexKey(uid), "[]");
  const arr = safeJsonParse(raw, []);
  return Array.isArray(arr) ? arr : [];
}
function saveStudioIndexLS(uid, list) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(studioIndexKey(uid), JSON.stringify(list || []));
  } catch {}
}
function upsertStudioIndexEntry(uid, entry) {
  const prev = loadStudioIndexLS(uid);
  const idx = prev.findIndex((x) => x.id === entry.id);
  const next = [...prev];
  if (idx >= 0) next[idx] = { ...next[idx], ...entry, updatedAt: uidNow() };
  else next.unshift({ ...entry, createdAt: uidNow(), updatedAt: uidNow() });
  // orden por updated desc
  next.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  saveStudioIndexLS(uid, next.slice(0, 300));
}

/* ----------------------------- Auth Token (FIX definitivo) ----------------------------- */

// ✅ Backward-compat: tu código usa getIdTokenForce() en muchos lados
const getIdTokenForce = async () => {
  const token = await getAuthToken(true);
  if (!token) throw new Error("No authenticated user token");
  return token;
};

// Helper para headers
const authHeaders = async (forceRefresh = false) => {
  const token = await getAuthToken(forceRefresh);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function AppPage() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // UI
  const [activeTab, setActiveTab] = useState(TABS?.[0]?.key || "chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

        // ✅ Surfaces unificados
        "--surface-1": "rgba(255,255,255,0.04)",
        "--surface-2": "rgba(0,0,0,0.22)",
        "--surface-3": "rgba(0,0,0,0.35)",
        "--stroke-soft": "rgba(255,255,255,0.10)",
        "--stroke-hard": "rgba(255,255,255,0.16)",
        "--shadow-soft": "0 10px 30px rgba(0,0,0,0.35)",
        "--shadow-hard": "0 24px 90px rgba(0,0,0,0.55)",
        "--blue": "rgba(47,107,255,0.92)",
        "--blue-soft": "rgba(47,107,255,0.14)",
        "--green-soft": "rgba(60,220,130,0.12)",
        "--red-soft": "rgba(255,80,80,0.12)",
      };
    }

    // 🌤 Light premium real (sin manchas negras)
    return {
      "--bg": "#F4F5F7",
      "--panel": "#FFFFFF",
      "--panel2": "rgba(255,255,255,0.72)",
      "--border": "rgba(15,23,42,0.12)",
      "--text": "#0F172A",
      "--muted": "rgba(15,23,42,0.65)",
      "--gold": "#C9A227",
      "--shadow": "0 18px 60px rgba(2,6,23,0.10)",
      "--blur": "blur(10px)",

      "--surface-1": "#FFFFFF",
      "--surface-2": "rgba(15,23,42,0.03)",
      "--surface-3": "rgba(15,23,42,0.06)",
      "--stroke-soft": "rgba(15,23,42,0.10)",
      "--stroke-hard": "rgba(15,23,42,0.14)",
      "--shadow-soft": "0 10px 30px rgba(2,6,23,0.08)",
      "--shadow-hard": "0 24px 90px rgba(2,6,23,0.12)",
      "--blue": "rgba(47,107,255,0.88)",
      "--blue-soft": "rgba(47,107,255,0.10)",
      "--green-soft": "rgba(16,185,129,0.10)",
      "--red-soft": "rgba(239,68,68,0.10)",
    };
  }, [theme]);

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

  // ✅ Mobile drawer sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  // Abort
  const abortRef = useRef(null);

  // ✅ SaaS Pro: debounce guardado studio
const studioSaveTimeoutRef = useRef(null);


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

  // 7) No Scroll crop
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

      if (!u) {
        router.push("/login");
        return;
      }

      // ✅ Tab persistente
      const savedTab = safeGetLS(lsKeyActiveTab(u.uid), null);
      const allowed = new Set((TABS || []).map((t) => t.key));
      const nextTab =
        savedTab && allowed.has(savedTab) ? savedTab : TABS?.[0]?.key || "chat";
      setActiveTab(nextTab);

      // ✅ Sidebar collapsed persistente
      const savedCollapsed = safeGetLS(lsKeySidebar(u.uid), null);
      if (savedCollapsed !== null) setSidebarCollapsed(savedCollapsed === "1");
    });

    return () => unsub();
  }, [router]);

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
            meta: { activeDocId: null, lastTemplate: null },
            docs: [],
          };
        }

        return { ...p, tabs };
      });

      setProjects(patched);
      setActiveProjectId(data.activeProjectId || patched[0]?.id || null);
    } else {
      const seed = [makeProject("gato astronauta"), makeProject("Genera una persona animada...")];
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

  // ✅ Guardado normal por TAB
  const updateProjectTab = (tabKey, nextTabValue) => {
    updateActiveProject((p) => {
      const tabs = { ...(p.tabs || {}) };
      tabs[tabKey] = nextTabValue;
      return { ...p, tabs };
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

  // ✅ Ensure Studio tab has an active doc (solo cuando entras a Studio)
  useEffect(() => {
    if (!activeProjectId) return;
    if (activeTab !== "studio") return;
    if (!activeProject) return;

    const studioRaw = activeProject?.tabs?.studio;
    const studioSafe = ensureStudioHasActiveDoc(studioRaw);

    const changed = JSON.stringify(studioRaw || null) !== JSON.stringify(studioSafe || null);
    if (changed) updateProjectTab("studio", studioSafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, activeTab, activeProject]);

  // ✅ SaaS Pro: al cambiar de proyecto, si existe doc guardado por proyecto, injéctalo como doc activo
  useEffect(() => {
    if (!user?.uid) return;
    if (!activeProjectId) return;
    if (!activeProject) return;

    const studioRaw = ensureStudioHasActiveDoc(activeProject?.tabs?.studio);
    const activeDocEntry = (studioRaw.docs || []).find((d) => d.id === studioRaw.meta.activeDocId);
    const currentDoc = activeDocEntry?.doc || null;

    const savedDoc = loadStudioDocLS(user.uid, activeProjectId);
    if (!savedDoc) return;

    // si el doc guardado es diferente, lo aplicamos al doc activo
    const different =
      JSON.stringify(savedDoc || null) !== JSON.stringify(currentDoc || null);

    if (different && studioRaw.meta?.activeDocId) {
      const nextStudio = {
        ...studioRaw,
        docs: (studioRaw.docs || []).map((d) =>
          d.id === studioRaw.meta.activeDocId ? { ...d, updatedAt: uidNow(), doc: savedDoc } : d
        ),
      };
      updateProjectTab("studio", nextStudio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeProjectId]);

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

  // ✅ Header user label
  const headerUser = useMemo(() => {
    if (!user) return "GUEST";
    return user.displayName || user.email || (user.uid ? `UID:${String(user.uid).slice(0, 6)}…` : "USER");
  }, [user]);

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
      <div class="meta">User: ${escapeHtml(headerUser)} • Export: ${escapeHtml(new Date().toLocaleString())}</div>
      ${htmlMsgs}
    `;

    openPrintWindow({ title: `AUREA Export — ${p.title}`, html });
    toast("Export PDF", `Tab: ${tabKey}`, "ok");
  };

  const onLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (e) {
      console.error(e);
    }
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
    const r = await fetch("/api/images/create-job", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders(true)),
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

      const url = `/api/images/get-job?jobId=${encodeURIComponent(jobId)}`;

      const r = await fetch(url, {
        method: "GET",
        headers: { ...(await authHeaders(false)) },
        signal,
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `get-job failed (${r.status})`);

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
    const text = (chatInput || "").trim();
    if (!text || busy || !activeProject) return;

    setChatInput("");
    setBusy(true);
    pushMsg("chat", { role: "user", text });

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const token = await getAuthToken().catch(() => null);
      let assistantText = "";

      const r = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          projectId: activeProjectId,
        }),
        signal: ac.signal,
      }).catch(() => null);

      if (r && r.ok) {
        const data = await r.json().catch(() => ({}));
        assistantText = data?.text || data?.message || "";
      } else if (r && !r.ok) {
        const data = await r.json().catch(() => ({}));
        const extra = r.status === 401 || r.status === 403 ? " (token inválido o sesión expirada)" : "";
        assistantText = `⚠️ /api/chat error ${r.status}${extra}: ${data?.error || "Unknown"}`;
      }

      if (!assistantText) assistantText = "💬 Chat AUREA listo.";
      pushMsg("chat", { role: "assistant", text: assistantText });
    } catch (e) {
      if (e?.name === "AbortError") {
        pushMsg("chat", { role: "assistant", text: "⏹️ Chat cancelado." });
        return;
      }
      const msg = e?.message || "Error en chat";
      pushMsg("chat", { role: "assistant", text: `⚠️ Chat error: ${msg}` });
      toast("Chat error", msg, "error", 4200);
    } finally {
      setBusy(false);
    }
  }

  /* ----------------------------- Code ----------------------------- */
  async function sendCode() {
    const text = (codeInput || "").trim();
    if (!text || busy || !activeProject) return;

    setCodeInput("");
    setBusy(true);
    pushMsg("code", { role: "user", text });

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const token = await getAuthToken().catch(() => null);
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
        const extra = r.status === 401 || r.status === 403 ? " (token inválido o sesión expirada)" : "";
        assistantText = `⚠️ /api/code error ${r.status}${extra}: ${data?.error || "Unknown"}`;
      }

      if (!assistantText) assistantText = "🧠 Modo Código listo.";
      pushMsg("code", { role: "assistant", text: assistantText });
    } catch (e) {
      if (e?.name === "AbortError") {
        pushMsg("code", { role: "assistant", text: "⏹️ Código cancelado." });
        return;
      }
      const msg = e?.message || "Error en código";
      pushMsg("code", { role: "assistant", text: `⚠️ Código error: ${msg}` });
      toast("Code error", msg, "error", 4200);
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================================================
     ✅✅✅ EXCEL: CONEXIÓN REAL (WIZARD -> NEXT API -> DOWNLOAD) ✅✅✅
     ======================================================================================= */

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
      dashboardTxt.includes("sí") || dashboardTxt.includes("si") || dashboardTxt.includes("recomend");

    const wantsRowColTotals = totals.includes("fila") || totals.includes("columna");
    const wantsCharts = !!payload?.preferences?.wantCharts;

    let columns = [
      { header: "Fecha", key: "fecha", type: "date", width: 14 },
      { header: "Concepto", key: "concepto", type: "text", width: 36 },
      { header: "Categoría", key: "categoria", type: "text", width: 20 },
      { header: "Forma de pago", key: "pago", type: "text", width: 16 },
      { header: "Ingreso", key: "ingreso", type: "currency", width: 14 },
      { header: "Egreso", key: "egreso", type: "currency", width: 14 },
    ];

    const isCuentas = controlType.includes("cuentas") || purpose.includes("cobrar") || purpose.includes("pagar");
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
      uiOption: "A",
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

    const kpis = [];

    if (isFlujo) {
      const L_in = colLetter(columns, "entrada");
      const L_out = colLetter(columns, "salida");
      kpis.push({ label: "Entradas", formula: `=SUM(${sheetName}!${L_in}:${L_in})`, format: "currency" });
      kpis.push({ label: "Salidas", formula: `=SUM(${sheetName}!${L_out}:${L_out})`, format: "currency" });
      kpis.push({ label: "Balance", formula: `=${kpiCellRefByIndex(0)}-${kpiCellRefByIndex(1)}`, format: "currency" });
      kpis.push({
        label: "Saldo total",
        formula: `=SUM(${sheetName}!${colLetter(columns, "saldo")}:${colLetter(columns, "saldo")})`,
        format: "currency",
      });
    } else if (isCuentas) {
      kpis.push({ label: "Monto total", formula: `=SUM(${sheetName}!${colLetter(columns, "monto")}:${colLetter(columns, "monto")})`, format: "currency" });
      kpis.push({ label: "Abonos", formula: `=SUM(${sheetName}!${colLetter(columns, "abono")}:${colLetter(columns, "abono")})`, format: "currency" });
      kpis.push({ label: "Saldo total", formula: `=SUM(${sheetName}!${colLetter(columns, "saldo")}:${colLetter(columns, "saldo")})`, format: "currency" });
      kpis.push({
        label: "Pendientes",
        formula: `=COUNTIF(${sheetName}!${colLetter(columns, "estatus")}:${colLetter(columns, "estatus")},"Pendiente")`,
        format: "number",
      });
    } else {
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
      const token = await getAuthToken().catch(() => null);

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
        let errMsg = "";
        const ct = r.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j = await r.json().catch(() => ({}));
          errMsg = j?.error || j?.message || "";
        } else {
          errMsg = await r.text().catch(() => "");
        }
        throw new Error(errMsg || `HTTP ${r.status}`);
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
    } catch (e) {
      if (e?.name === "AbortError") {
        setGenStatus("⏹️ Excel cancelado");
        toast("Excel cancelado", "Se canceló la generación", "warn", 2500);
        return { ok: false, aborted: true };
      }
      const msg = e?.message || "Failed to fetch";
      setExcelMeta({ lastError: msg });
      setGenStatus("");
      toast("Excel error", msg, "error", 4500);
      alert(`⚠️ Excel: ${msg}`);
      return { ok: false, error: msg };
    } finally {
      setBusy(false);
      setTimeout(() => setGenStatus(""), 900);
    }
  }

  const onWizardSubmit = async (payload) => {
    await generateExcelFromWizard(payload);
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
    await generateExcelFromWizard(payload);
  };

  const resetExcelMeta = () => {
    setExcelMeta({
      lastSpec: null,
      lastFileName: null,
      lastOkAt: null,
      lastError: null,
    });
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

  /* ----------------------------- Inline Presets (Paso 3.5) ----------------------------- */
  const INLINE_PRESETS = {
    images: [
      { label: "IG Post 1080", text: "Post de Instagram 1080x1080, estilo premium, fondo oscuro, tipografía grande, composición moderna, espacio para logo." },
      { label: "Story 9:16", text: "Historia Instagram 1080x1920 (9:16), diseño vertical, título arriba, CTA abajo, estilo Aurea33 dark/gold, alto contraste." },
      { label: "FB Cover", text: "Portada de Facebook 820x312, diseño horizontal, headline grande, elementos visuales equilibrados, estilo futurista." },
      { label: "Producto", text: "Mockup de producto con fondo minimal, iluminación suave, texto corto de beneficio, estilo comercial premium." },
    ],
    chat: [
      { label: "Mejorar texto", text: "Mejora mi texto para que sea más claro, persuasivo y ordenado:\n" },
      { label: "Versión corta", text: "Reescribe esto en versión corta y poderosa:\n" },
      { label: "Versión emocional", text: "Reescribe esto con tono emocional, humano y empático:\n" },
      { label: "Bullet points", text: "Convierte esto en bullets claros y accionables:\n" },
    ],
    code: [
      { label: "Fix bug", text: "Encuentra el bug y dame el fix exacto con explicación breve:\n" },
      { label: "Refactor PRO", text: "Refactoriza este código a nivel PRO (limpio, escalable, sin romper nada):\n" },
      { label: "Optimizar", text: "Optimiza rendimiento y estructura sin cambiar funcionalidad:\n" },
      { label: "TypeScript", text: "Pásalo a TypeScript y agrega types correctos:\n" },
    ],
  };

  const applyInlinePreset = (tabKey, presetText) => {
    if (busy) return;

    if (tabKey === "images") {
      setImgPrompt((prev) => (prev?.trim() ? `${prev}\n\n${presetText}` : presetText));
      toast("Preset", "Aplicado a Images", "ok");
      return;
    }
    if (tabKey === "chat") {
      const last = (activeProject?.tabs?.chat?.messages || []).slice(-1)[0]?.text || "";
      setChatInput((prev) => {
        const base = presetText;
        if (base.endsWith("\n") && !prev?.trim() && last) return `${base}${last}`;
        return prev?.trim() ? `${prev}\n\n${base}` : base;
      });
      toast("Preset", "Aplicado a Chat", "ok");
      return;
    }
    if (tabKey === "code") {
      const last = (activeProject?.tabs?.code?.messages || []).slice(-1)[0]?.text || "";
      setCodeInput((prev) => {
        const base = presetText;
        if (base.endsWith("\n") && !prev?.trim() && last) return `${base}${last}`;
        return prev?.trim() ? `${prev}\n\n${base}` : base;
      });
      toast("Preset", "Aplicado a Code", "ok");
      return;
    }
  };

  const InlineChips = ({ tabKey }) => {
    const items = INLINE_PRESETS?.[tabKey] || [];
    if (!items.length) return null;

    return (
      <div style={inlineChipsRow()}>
        {items.map((x) => (
          <button
            key={x.label}
            style={inlineChipBtn()}
            onClick={() => applyInlinePreset(tabKey, x.text)}
            disabled={busy}
            title={x.text}
          >
            {x.label}
          </button>
        ))}
      </div>
    );
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

    const projs = sortedProjects.filter((p) => (p.title || "").toLowerCase().includes(q)).slice(0, 10);

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
    setTab(r.tab);
    setSearchOpen(false);
    setTimeout(() => scrollToMessage(r.msgId), 140);
    toast("Jump", `${r.projectTitle} → ${r.tab}`, "ok");
  };

  const setTab = (key) => {
    setActiveTab(key);
    if (user?.uid) safeSetLS(lsKeyActiveTab(user.uid), key);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (user?.uid) safeSetLS(lsKeySidebar(user.uid), next ? "1" : "0");
      return next;
    });
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

  /* ✅ Sidebar content */
  const SidebarContent = () => (
    <>
      <div style={sidebarHeader()}>
        <div style={{ fontWeight: 900 }}>AUREA CORE</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Proyectos persistentes • Tabs fijos • Historial local</div>
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
        <div style={metricCardWide(apiExcelStatus === "ok" ? "ok" : apiExcelStatus === "error" ? "err" : "idle")}>
          <div style={metricLabel()}>API Excel</div>
          <div style={metricValueSmall()}>{apiExcelStatus}</div>
        </div>
      </div>

      <div style={miniTabsRow()}>
        <span style={miniTabPill(activeTab === "chat")} onClick={() => setTab("chat")}>
          💬 Chat
        </span>
        <span style={miniTabPill(activeTab === "code")} onClick={() => setTab("code")}>
          🧠 Code
        </span>
        <span style={miniTabPill(activeTab === "images")} onClick={() => setTab("images")}>
          🖼️ Images
        </span>
        <span style={miniTabPill(activeTab === "studio")} onClick={() => setTab("studio")}>
          🎛️ Studio
        </span>
        <span style={miniTabPill(activeTab === "excel")} onClick={() => setTab("excel")}>
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
              <div style={projectSub()}>{new Date(p.updatedAt || p.createdAt).toLocaleString()}</div>

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

        <div style={{ fontSize: 12, opacity: 0.55, marginTop: 8 }}>Tip: 1 proyecto = 1 cliente / campaña / tarea</div>
      </div>
    </>
  );

  const MobileSidebarContent = SidebarContent;

  return (
    <>
      <Head>
        <title>AUREA 33 Studio</title>
      </Head>

      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
        }
        * {
          box-sizing: border-box;
        }

        @keyframes aureaPulse {
          0% {
            transform: translateX(0);
            opacity: 0.35;
            filter: blur(0px);
          }
          50% {
            transform: translateX(8px);
            opacity: 1;
            filter: blur(0.2px);
          }
          100% {
            transform: translateX(0);
            opacity: 0.35;
            filter: blur(0px);
          }
        }

        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(247, 198, 0, 0.18);
          border: 2px solid transparent;
          background-clip: padding-box;
          border-radius: 999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(247, 198, 0, 0.3);
        }

        ::selection {
          background: rgba(247, 198, 0, 0.22);
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      <div style={{ ...page(), ...themeVars }}>
        <div style={ambientGrid()} />
        <div style={ambientGlow()} />

        {/* Top bar */}
        <div style={topbar()}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={logoCircle()}>A</div>
            <div>
              <div style={{ fontWeight: 900, letterSpacing: 0.5 }}>
                AUREA 33 STUDIO // LIVE
                <span style={{ marginLeft: 10, fontSize: 11, opacity: 0.7 }}>(Ctrl+K palette • Ctrl+F search)</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={chip()}>READY • MULTI • font 12px</span>
                <span style={chipSoft()}>Proyecto: {activeProject?.title || "—"}</span>
                <span style={chipSoft()}>Sesión: {headerUser}</span>
              </div>
            </div>
          </div>

          {/* ✅ Mobile Drawer */}
          {safeIsMobile && (
            <>
              {sidebarOpen && <div style={mobileOverlay()} onClick={() => setSidebarOpen(false)} />}

              <div style={mobileDrawer(sidebarOpen)}>
                <div style={drawerHeader()}>
                  <div style={{ fontWeight: 900, letterSpacing: 0.4 }}>AUREA 33 MENU</div>
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

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {safeIsMobile && (
              <button onClick={() => setSidebarOpen(true)} style={btnGhost()} title="Menú">
                ☰
              </button>
            )}

            <button onClick={() => setSearchOpen(true)} style={btnGhost()}>
              Buscar (Ctrl+F)
            </button>

            <button onClick={() => setPaletteOpen(true)} style={btnGhost()}>
              Comandos (Ctrl+K)
            </button>

            <button onClick={toggleTheme} style={btnGhost()}>
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
          <aside style={{ ...sidebar(), ...(safeIsMobile ? { display: "none" } : {}) }}>
            <SidebarContent />
          </aside>

          {/* Content */}
          <main style={mainCard()}>
            {/* Tabs */}
            <div style={tabsBar()}>
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} style={tabBtn(activeTab === t.key)}>
                  {t.title}
                </button>
              ))}

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={statusPill(busy ? "busy" : "idle")}>{busy ? "PROCESSING" : `IDLE • ${activeTab.toUpperCase()}`}</span>
                <span style={statusPill("ok")}>Listo ✅</span>
              </div>
            </div>

            {/* Banner */}
            <div style={banner()}>
              {activeTab === "images" && "🖼️ Imágenes listo. Describe y genero. (Images backend intacto)."}
              {activeTab === "chat" && "💬 Chat AUREA conectado. Historial por proyecto."}
              {activeTab === "code" && "🧠 Código conectado. Historial por proyecto."}
              {activeTab === "excel" && "📄 Excel Wizard activo (con descarga conectada + spec PRO)."}
              {activeTab === "studio" && "🎛️ AUREA STUDIO activo. Canvas persistente por proyecto."}
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
                    {pinnedMessagesForTab.length > 12 && <span style={{ opacity: 0.6 }}>+{pinnedMessagesForTab.length - 12} más</span>}
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

                  <InlineChips tabKey="images" />

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

                  <InlineChips tabKey="chat" />

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

              {/* STUDIO (LIMPIO) */}
              {activeTab === "studio" &&
                (() => {
                  const studioSafe = ensureStudioHasActiveDoc(activeProject?.tabs?.studio);
                  const activeDocEntry = (studioSafe.docs || []).find((d) => d.id === studioSafe.meta.activeDocId);
                  const canvasDoc = activeDocEntry?.doc;

                  const setCanvasDoc = (nextDoc) => {
  const nextStudio = {
    ...studioSafe,
    docs: (studioSafe.docs || []).map((d) =>
      d.id === studioSafe.meta.activeDocId
        ? { ...d, updatedAt: uidNow(), doc: nextDoc }
        : d
    ),
  };

  // ✅ Actualiza proyecto inmediatamente (estado React)
  updateProjectTab("studio", nextStudio);

  // ✅ Debounce guardado localStorage (700ms)
  if (user?.uid && activeProjectId) {
    if (studioSaveTimeoutRef.current) {
      clearTimeout(studioSaveTimeoutRef.current);
    }

    studioSaveTimeoutRef.current = setTimeout(() => {
      saveStudioDocLS(user.uid, activeProjectId, nextDoc);

      upsertStudioIndexEntry(user.uid, {
        id: `${activeProjectId}:${studioSafe.meta.activeDocId}`,
        projectId: activeProjectId,
        docId: studioSafe.meta.activeDocId,
        title: activeProject?.title || "Proyecto",
        meta: nextDoc?.meta || null,
        thumb: null,
      });
    }, 700);
  }
};


                  return (
                    <div style={studioCleanWrap()}>
                      <CanvasEditorClient
                        studio={{ id: studioSafe.meta.activeDocId, doc: canvasDoc }}
                        onChange={(nextStudioLike) => {
                          if (nextStudioLike?.doc) setCanvasDoc(nextStudioLike.doc);
                        }}
                        compact={compact}
                      />
                    </div>
                  );
                })()}

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

                  <InlineChips tabKey="code" />

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
                    <div style={{ fontWeight: 900, opacity: 0.9 }}>📄 Excel Wizard • {excelMeta?.lastOkAt ? "Listo ✅" : "—"}</div>

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

                  <ExcelWizardBubbles onSubmit={onWizardSubmit} onGenerateExcel={onWizardSubmit} />

                  <div style={excelHint()}>
                    Tip PRO: este build genera un <b>spec determinista</b> dependiendo de tu wizard (controlType, totales y dashboard opción A). Si “se ve igual”, es porque tu backend de Excel está ignorando partes del spec. Usa “Debug Spec” y compárame.
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

          {/* HUD */}
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
                        <div style={{ fontSize: 11, opacity: 0.6 }}>{r.ts ? new Date(r.ts).toLocaleString() : ""}</div>
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
              <div style={{ opacity: 0.75 }}>Acciones rápidas. Tip: usa esto como “control central” del producto.</div>

              <div style={cmdGrid()}>
                <CmdBtn
                  label="Ir a Chat"
                  hint="Switch tab"
                  onClick={() => {
                    setTab("chat");
                    setPaletteOpen(false);
                    toast("Tab", "Chat", "ok");
                  }}
                />
                <CmdBtn
                  label="Ir a Images"
                  hint="Switch tab"
                  onClick={() => {
                    setTab("images");
                    setPaletteOpen(false);
                    toast("Tab", "Images", "ok");
                  }}
                />
                <CmdBtn
                  label="Ir a Code"
                  hint="Switch tab"
                  onClick={() => {
                    setTab("code");
                    setPaletteOpen(false);
                    toast("Tab", "Code", "ok");
                  }}
                />
                <CmdBtn
                  label="Ir a Studio"
                  hint="Switch tab"
                  onClick={() => {
                    setTab("studio");
                    setPaletteOpen(false);
                    toast("Tab", "Studio", "ok");
                  }}
                />
                <CmdBtn
                  label="Ir a Excel"
                  hint="Switch tab"
                  onClick={() => {
                    setTab("excel");
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

function inlineChipsRow() {
  return { display: "flex", gap: 8, flexWrap: "wrap", padding: "8px 2px 2px", marginTop: 6 };
}
function inlineChipBtn() {
  return {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-3)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    opacity: 0.95,
  };
}

function page() {
  return {
    height: "100dvh",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 12,
    lineHeight: 1.35,
    letterSpacing: 0.2,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
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
    boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
  };
}

function logoCircle() {
  return {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    letterSpacing: 0.6,
    border: "1px solid rgba(247,198,0,0.30)",
    background: "rgba(247,198,0,0.10)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
    color: "var(--gold)",
    userSelect: "none",
  };
}

// ✅ alias por si en algún lado quedó el typo:
function logCircle() {
  return logoCircle();
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
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    color: "var(--text)",
    fontWeight: 900,
    opacity: 0.92,
  };
}

/* ----------------------------- Layout styles ----------------------------- */

function layout(compact, rightPanelsOpen) {
  return {
    flex: 1,
    display: "grid",
    gridTemplateColumns: rightPanelsOpen
      ? "300px 1fr 320px"
      : "300px 1fr",
    gap: 14,
    padding: compact ? 12 : 16,
    alignItems: "stretch",
    minHeight: 0,
  };
}

function sidebar() {
  return {
    border: "1px solid var(--border)",
    background: "var(--panel)",
    borderRadius: 18,
    boxShadow: "var(--shadow-soft)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  };
}

function sidebarHeader() {
  return {
    padding: "14px 14px 10px",
    borderBottom: "1px solid var(--border)",
    background:
      "linear-gradient(180deg, var(--surface-2), transparent)",
  };
}

function sidebarActions() {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
  };
}

function metricsWrap() {
  return {
    padding: "10px 14px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    borderBottom: "1px solid var(--border)",
  };
}

function metricCard(kind) {
  const ok = kind === "ok";
  const err = kind === "err";
  return {
    border: "1px solid var(--stroke-soft)",
    background: ok
      ? "linear-gradient(180deg, var(--green-soft), var(--surface-2))"
      : err
      ? "linear-gradient(180deg, var(--red-soft), var(--surface-2))"
      : "var(--surface-2)",
    borderRadius: 14,
    padding: 10,
    boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
  };
}
function metricCardWide(kind) {
  return {
    gridColumn: "1 / -1",
    ...metricCard(kind),
  };
}
function metricLabel() {
  return { fontSize: 11, opacity: 0.72, fontWeight: 900 };
}
function metricValue() {
  return { fontSize: 18, fontWeight: 900, marginTop: 4 };
}
function metricValueSmall() {
  return { fontSize: 12, fontWeight: 900, marginTop: 6, opacity: 0.85 };
}

function miniTabsRow() {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
  };
}
function miniTabPill(active) {
  return {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid var(--stroke-soft)",
    background: active ? "rgba(247,198,0,0.10)" : "var(--surface-2)",
    color: active ? "var(--gold)" : "var(--text)",
    fontWeight: 900,
    cursor: "pointer",
    userSelect: "none",
  };
}

function projectList() {
  return {
    padding: "10px 12px 14px",
    overflow: "auto",
    minHeight: 0,
  };
}
function projectItem(active) {
  return {
    position: "relative",
    border: `1px solid ${active ? "rgba(247,198,0,0.26)" : "var(--stroke-soft)"}`,
    background: active
      ? "linear-gradient(180deg, rgba(247,198,0,0.10), var(--surface-2))"
      : "var(--surface-2)",
    borderRadius: 14,
    padding: "10px 10px",
    marginBottom: 10,
    cursor: "pointer",
    boxShadow: active ? "0 14px 40px rgba(0,0,0,0.25)" : "0 10px 26px rgba(0,0,0,0.18)",
  };
}
function projectTitle() {
  return { fontWeight: 900, opacity: 0.95, paddingRight: 76 };
}
function projectSub() {
  return { fontSize: 11, opacity: 0.65, marginTop: 4, paddingRight: 76 };
}
function miniPill() {
  return {
    position: "absolute",
    top: 10,
    right: 44,
    width: 30,
    height: 28,
    borderRadius: 10,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-3)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
  };
}
function miniPillDots(active) {
  return {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 28,
    borderRadius: 10,
    border: `1px solid ${active ? "rgba(247,198,0,0.26)" : "var(--stroke-soft)"}`,
    background: active ? "rgba(247,198,0,0.10)" : "var(--surface-3)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
  };
}

function menuPanel() {
  return {
    position: "absolute",
    top: 42,
    right: 10,
    width: 220,
    borderRadius: 14,
    border: "1px solid var(--stroke-hard)",
    background: "var(--panel)",
    boxShadow: "var(--shadow-hard)",
    overflow: "hidden",
    zIndex: 20,
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
    opacity: 0.92,
  };
}
function menuItemDanger() {
  return { ...menuItem(), color: "#ff6b6b" };
}
function menuSep() {
  return { height: 1, background: "var(--border)" };
}

function mainCard() {
  return {
    border: "1px solid var(--border)",
    background: "var(--panel)",
    borderRadius: 18,
    boxShadow: "var(--shadow-soft)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  };
}

function tabsBar() {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    background:
      "linear-gradient(180deg, var(--surface-2), transparent)",
  };
}
function tabBtn(active) {
  return {
    padding: "9px 12px",
    borderRadius: 12,
    border: `1px solid ${active ? "rgba(247,198,0,0.26)" : "var(--stroke-soft)"}`,
    background: active ? "rgba(247,198,0,0.12)" : "var(--surface-2)",
    color: active ? "var(--gold)" : "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    opacity: active ? 1 : 0.9,
  };
}

function statusPill(kind) {
  const base = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--stroke-soft)",
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: 0.4,
  };
  if (kind === "busy") return { ...base, background: "rgba(47,107,255,0.12)", color: "var(--text)" };
  if (kind === "ok") return { ...base, background: "rgba(16,185,129,0.10)", color: "var(--text)" };
  return { ...base, background: "var(--surface-2)", color: "var(--text)", opacity: 0.9 };
}

function banner() {
  return {
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--surface-2)",
    opacity: 0.92,
    fontWeight: 900,
  };
}

function mainBody() {
  return {
    flex: 1,
    minHeight: 0,
    padding: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

/* ----------------------------- Pins ----------------------------- */
function pinsWrap() {
  return {
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    borderRadius: 16,
    padding: 10,
  };
}
function pinsRow() {
  return { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 };
}
function pinChip() {
  return {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-3)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    maxWidth: 340,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

/* ----------------------------- Chat area + Inputs ----------------------------- */
function chatArea(compact) {
  return {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    padding: compact ? 8 : 10,
    border: "1px solid var(--stroke-soft)",
    borderRadius: 16,
    background: "var(--surface-2)",
    display: "grid",
    gap: 10,
  };
}
function inputRow() {
  return { display: "flex", gap: 10, alignItems: "center" };
}
function input() {
  return {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-3)",
    color: "var(--text)",
    outline: "none",
    fontWeight: 700,
  };
}
function statusLine() {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid var(--stroke-soft)",
    background: "rgba(47,107,255,0.08)",
    fontWeight: 900,
  };
}
function statusSpacer() {
  return { height: 0 };
}

/* ----------------------------- Studio wrapper ----------------------------- */
function studioCleanWrap() {
  return {
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    border: "1px solid var(--stroke-soft)",
    borderRadius: 16,
    background: "var(--surface-2)",
  };
}

/* ----------------------------- Excel ----------------------------- */
function excelTopRow() {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    borderRadius: 16,
    padding: "10px 12px",
  };
}
function excelError() {
  return {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.10)",
    fontWeight: 900,
  };
}
function excelHint() {
  return {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    opacity: 0.9,
  };
}

/* ----------------------------- HUD / Inspector ----------------------------- */
function hudPanel() {
  return {
    border: "1px solid var(--border)",
    background: "var(--panel)",
    borderRadius: 18,
    boxShadow: "var(--shadow-soft)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
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
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--surface-2)",
  };
}
function hudClose() {
  return {
    padding: "7px 10px",
    borderRadius: 12,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-3)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
  };
}
function hudCard() {
  return {
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
  };
}
function hudLabel() {
  return { fontSize: 11, opacity: 0.6, fontWeight: 900, letterSpacing: 0.6 };
}
function hudText() {
  return { marginTop: 6, opacity: 0.9 };
}
function hudBtn() {
  return {
    width: "100%",
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(247,198,0,0.26)",
    background: "rgba(247,198,0,0.10)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    textAlign: "left",
  };
}
function hudBtnSoft() {
  return {
    ...hudBtn(),
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
  };
}
function inspectorPre() {
  return {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    overflow: "auto",
    maxHeight: 420,
    fontSize: 11,
  };
}

/* ----------------------------- Toasts ----------------------------- */
function toastStack() {
  return {
    position: "fixed",
    right: 16,
    bottom: 16,
    display: "grid",
    gap: 10,
    zIndex: 80,
    pointerEvents: "none",
  };
}
function toastCard(kind) {
  const base = {
    width: 320,
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid var(--stroke-soft)",
    background: "var(--panel)",
    boxShadow: "var(--shadow-soft)",
    pointerEvents: "auto",
  };
  if (kind === "error") return { ...base, border: "1px solid rgba(239,68,68,0.35)" };
  if (kind === "warn") return { ...base, border: "1px solid rgba(247,198,0,0.35)" };
  return base;
}

/* ----------------------------- Modals ----------------------------- */
function modalOverlay() {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.62)",
    backdropFilter: "blur(10px)",
    zIndex: 70,
    display: "grid",
    placeItems: "center",
    padding: 14,
  };
}
function modalCard() {
  return {
    width: "min(900px, 96vw)",
    maxHeight: "86vh",
    borderRadius: 18,
    border: "1px solid var(--stroke-hard)",
    background: "var(--panel)",
    boxShadow: "var(--shadow-hard)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };
}
function modalHeader() {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--surface-2)",
  };
}
function modalBody() {
  return { padding: 12, overflow: "auto" };
}
function modalInput() {
  return {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-3)",
    color: "var(--text)",
    outline: "none",
    fontWeight: 800,
  };
}

function searchItem() {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    textAlign: "left",
  };
}
function searchMsgItem() {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    color: "var(--text)",
    cursor: "pointer",
    textAlign: "left",
  };
}

/* ----------------------------- Command palette ----------------------------- */
function cmdGrid() {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}
function cmdBtn(danger) {
  return {
    padding: "12px 12px",
    borderRadius: 16,
    border: `1px solid ${danger ? "rgba(239,68,68,0.35)" : "var(--stroke-soft)"}`,
    background: danger ? "rgba(239,68,68,0.10)" : "var(--surface-2)",
    color: "var(--text)",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 900,
  };
}

/* ----------------------------- QuickActions ----------------------------- */
function quickRow() {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    padding: "6px 2px 2px",
    alignItems: "center",
  };
}
function quickBtn() {
  return {
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    opacity: 0.95,
  };
}

/* ----------------------------- Message bubble ----------------------------- */
function badge(kind) {
  const base = {
    fontSize: 10,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid var(--stroke-soft)",
  };
  if (kind === "assistant") return { ...base, background: "rgba(47,107,255,0.10)" };
  return { ...base, background: "rgba(247,198,0,0.10)", color: "var(--gold)" };
}
function bubble(isUser, compact) {
  return {
    width: "min(860px, 92%)",
    borderRadius: 18,
    border: "1px solid var(--stroke-soft)",
    background: isUser ? "rgba(247,198,0,0.10)" : "var(--surface-3)",
    padding: compact ? "10px 10px" : "12px 12px",
    boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
  };
}
function typingDots() {
  return {
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "rgba(247,198,0,0.18)",
    animation: "aureaPulse 1.1s infinite ease-in-out",
    display: "inline-block",
  };
}
function miniIconBtn() {
  return {
    width: 28,
    height: 26,
    borderRadius: 10,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
  };
}
function pinBtn(pinned) {
  return {
    ...miniIconBtn(),
    border: pinned ? "1px solid rgba(247,198,0,0.35)" : "1px solid var(--stroke-soft)",
    background: pinned ? "rgba(247,198,0,0.10)" : "var(--surface-2)",
  };
}

/* ----------------------------- Buttons ----------------------------- */
function btnGhost() {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid var(--stroke-soft)",
    background: "var(--surface-2)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    opacity: 0.95,
  };
}
function btnGhostSmall() {
  return { ...btnGhost(), padding: "8px 10px", borderRadius: 12, fontSize: 12 };
}
function btnPrimary() {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(247,198,0,0.42)",
    background:
      "linear-gradient(180deg, rgba(247,198,0,0.22) 0%, rgba(247,198,0,0.10) 100%)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: "0.2px",
    boxShadow:
      "0 10px 30px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease",
    userSelect: "none",
  };
}
function btnPrimaryHover() {
  return {
    transform: "translateY(-1px)",
    border: "1px solid rgba(247,198,0,0.62)",
    background:
      "linear-gradient(180deg, rgba(247,198,0,0.30) 0%, rgba(247,198,0,0.14) 100%)",
    boxShadow:
      "0 14px 40px rgba(0,0,0,0.35), 0 0 0 3px rgba(247,198,0,0.10), inset 0 1px 0 rgba(255,255,255,0.12)",
  };
}

function btnPrimaryActive() {
  return {
    transform: "translateY(0px) scale(0.99)",
    boxShadow:
      "0 8px 22px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
  };
}

function btnFocusRingGold() {
  return {
    outline: "none",
    boxShadow:
      "0 0 0 3px rgba(247,198,0,0.18), 0 14px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
  };
}

function btnDanger() {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.12)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 900,
  };
}
function btnGhostLink() {
  return {
    ...btnGhostSmall(),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
  };
}
function btnPrimaryLink() {
  return {
    ...btnPrimary(),
    padding: "8px 10px",
    borderRadius: 12,
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
  };
}
