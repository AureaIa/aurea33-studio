// pages/app.js
import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// ✅ IMPORT CORRECTO (components está en raíz)
import ExcelWizardBubbles from "../components/ExcelWizardBubbles";

const TABS = [
  { key: "chat", title: "Chat AUREA" },
  { key: "images", title: "Imágenes" },
  { key: "code", title: "Código" },
  { key: "excel", title: "Excel" },
];

const TAB_SYSTEM = {
  chat: `Eres AUREA 33. Responde útil, directo y con tono profesional-amigable.`,
  images: `MODO IMÁGENES: Entrega SOLO prompts listos para generador de imágenes. No digas "no puedo".`,
  code: `MODO CÓDIGO: Devuelve código listo para copiar/pegar. Si puedes, incluye pasos mínimos.`,
  excel: `MODO EXCEL: Piensa como analista. Estructura columnas, fórmulas, validaciones y estilo pro.`,
};

const TAB_TIP = {
  chat: `Tip: “Ayúdame a planear una campaña con 3 anuncios y CTA.”`,
  images: `Tip: “Genera una persona animada sonriendo, estilo Pixar, 3 variaciones + negative.”`,
  code: `Tip: “Crea un componente React para dashboard con cards y tabla.”`,
  excel: `Tip: Usa el wizard para generar un .xlsx profesional (con dashboard).`,
};

const PLACEHOLDER = {
  chat: "Escribe tu mensaje… (Enter para enviar, Shift+Enter salto)",
  images: "Describe la imagen que quieres generar…",
  code: "Describe el código que necesitas…",
  excel: "Describe el Excel que necesitas…",
};

function safeTitleFromText(text) {
  const t = (text || "").trim();
  if (!t) return "Nuevo proyecto";
  return t.length > 44 ? t.slice(0, 44) + "…" : t;
}

function welcomeFor(tabKey) {
  const map = {
    chat: "Hola 👋 Soy AUREA 33. ¿Qué hacemos hoy?",
    images: "🖼️ Tab Imágenes listo. Describe lo que quieres y te genero la imagen.",
    code: "💻 Tab Código listo. Pídeme el código y te lo doy limpio.",
    excel: "📊 Tab Excel listo. Usa el wizard para generar un .xlsx descargable.",
  };
  return { role: "assistant", content: map[tabKey] || map.chat, type: "text" };
}

async function ensureFixedTabs(user, projectId) {
  const threadsRef = collection(db, "users", user.uid, "projects", projectId, "threads");
  const existing = await getDocs(query(threadsRef, limit(1)));
  if (!existing.empty) return;

  const batch = writeBatch(db);

  for (const t of TABS) {
    const threadDocRef = doc(threadsRef);
    batch.set(threadDocRef, {
      mode: t.key,
      title: t.title,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const msgRef = doc(
      collection(db, "users", user.uid, "projects", projectId, "threads", threadDocRef.id, "messages")
    );

    batch.set(msgRef, {
      ...welcomeFor(t.key),
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export default function AppPage() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // UI
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Projects
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Threads (tabs fijos)
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [activeTabKey, setActiveTabKey] = useState("chat");

  // Messages
  const [messages, setMessages] = useState([welcomeFor("chat")]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const chatScrollRef = useRef(null);

  // --- Auth gate ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setAuthLoading(false);
      if (!u) router.push(`/login?next=${encodeURIComponent("/app")}`);
    });
    return () => unsub();
  }, [router]);

  // --- Projects snapshot ---
  useEffect(() => {
    if (!user) return;

    const projectsRef = collection(db, "users", user.uid, "projects");
    const q = query(projectsRef, orderBy("updatedAt", "desc"), limit(80));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProjects(list);

        if (!activeProjectId && list.length) {
          setActiveProjectId(list[0].id);
        }
      },
      (err) => console.error("Projects snapshot error:", err)
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- Threads snapshot (ensure tabs fixed) ---
  useEffect(() => {
    if (!user || !activeProjectId) return;

    let unsub = null;

    (async () => {
      await ensureFixedTabs(user, activeProjectId);

      const threadsRef = collection(db, "users", user.uid, "projects", activeProjectId, "threads");
      const q = query(threadsRef, orderBy("createdAt", "asc"), limit(10));

      unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setThreads(list);

          if (!activeThreadId && list.length) {
            setActiveThreadId(list[0].id);
            setActiveTabKey(list[0].mode || "chat");
          }
        },
        (err) => console.error("Threads snapshot error:", err)
      );
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [user, activeProjectId, activeThreadId]);

  // --- Messages snapshot for active thread ---
  useEffect(() => {
    if (!user || !activeProjectId || !activeThreadId) return;

    const msgsRef = collection(
      db,
      "users",
      user.uid,
      "projects",
      activeProjectId,
      "threads",
      activeThreadId,
      "messages"
    );

    const q = query(msgsRef, orderBy("createdAt", "asc"), limit(500));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data());
        setMessages(list.length ? list : [welcomeFor(activeTabKey)]);
      },
      (err) => console.error("Messages snapshot error:", err)
    );

    return () => unsub();
  }, [user, activeProjectId, activeThreadId, activeTabKey]);

  // Auto scroll (solo para tabs que usan chat)
  useEffect(() => {
    if (activeTabKey === "excel") return;
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages.length, activeTabKey]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const getMsgsRef = () => {
    if (!user || !activeProjectId || !activeThreadId) return null;
    return collection(
      db,
      "users",
      user.uid,
      "projects",
      activeProjectId,
      "threads",
      activeThreadId,
      "messages"
    );
  };

  // --- Create new project + fixed tabs ---
  const createProject = async () => {
    if (!user) return null;

    const projectsRef = collection(db, "users", user.uid, "projects");
    const pDoc = await addDoc(projectsRef, {
      title: "Nuevo proyecto",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: "",
    });

    const projectId = pDoc.id;
    await ensureFixedTabs(user, projectId);

    setActiveProjectId(projectId);
    setActiveThreadId(null);
    setActiveTabKey("chat");

    return projectId;
  };

  const selectProject = async (p) => {
    setActiveProjectId(p.id);
    setActiveThreadId(null);
    setActiveTabKey("chat");
    await ensureFixedTabs(user, p.id);
  };

  const selectTab = (tabKey) => {
    const t = threads.find((x) => x.mode === tabKey);
    if (!t) return;
    setActiveThreadId(t.id);
    setActiveTabKey(tabKey);
  };

  // --- Helper: save assistant/user messages ---
  const addAssistantMessage = async (msgsRef, payload) => {
    await addDoc(msgsRef, {
      role: "assistant",
      createdAt: serverTimestamp(),
      ...payload,
    });
  };

  const addUserMessage = async (msgsRef, text) => {
    await addDoc(msgsRef, {
      role: "user",
      type: "text",
      content: text,
      createdAt: serverTimestamp(),
    });
  };

  // ✅ FileReader → DataURL (para logo opcional)
  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  // ✅ Wizard Excel submit → /api/excel
  const handleExcelWizardSubmit = async (payload, images) => {
    const msgsRef = getMsgsRef();
    if (!msgsRef) return;

    try {
      setSending(true);

      const summary = `🧾 Excel Wizard:
- Para qué: ${payload?.wizard?.purpose || "—"}
- Nivel: ${payload?.wizard?.level || "—"}
- Periodicidad: ${payload?.wizard?.periodicity || "—"}
- Giro: ${payload?.wizard?.industry || "—"}
- Tema: ${payload?.preferences?.theme || "—"}
- Gráficas: ${payload?.preferences?.wantCharts ? "Sí" : "No"}
- Imágenes: ${payload?.preferences?.wantImages ? "Sí" : "No"}
`;
      await addUserMessage(msgsRef, summary);

      let logoDataUrl = null;
      if (images?.length) {
        try {
          logoDataUrl = await fileToDataUrl(images[0]);
        } catch {
          logoDataUrl = null;
        }
      }

      const prompt = `Genera un Excel PRO basado en este wizard.
Quiero que sea usable, con columnas bien pensadas, validaciones, totales y dashboard si aplica.
Si el nivel es Directivo: KPIs arriba + resumen y gráfica.`;

      const res = await fetch("/api/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          wizard: payload.wizard,
          preferences: payload.preferences,
          context: payload.context,
          file: payload.file,
          logoDataUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        await addAssistantMessage(msgsRef, {
          type: "text",
          content: `⚠️ Error Excel: ${err?.error || "No se pudo generar el archivo."}`,
        });
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload?.file?.fileName || "AUREA_excel.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      await addAssistantMessage(msgsRef, {
        type: "text",
        content:
          "✅ Excel PRO generado y descargado.\nSi quieres lo mejoro: (1) validaciones por listas, (2) más KPIs, (3) columnas exactas, (4) moneda, (5) 2 gráficas extra.",
      });

      const pRef = doc(db, "users", user.uid, "projects", activeProjectId);
      await updateDoc(pRef, {
        lastMessage: "✅ Excel generado y descargado",
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      await addAssistantMessage(msgsRef, {
        type: "text",
        content: "⚠️ Error de red / servidor. Intenta de nuevo.",
      });
    } finally {
      setSending(false);
    }
  };

  // ✅ IMAGES SaaS PRO: create job + listen firestore until done
  const generateImageJob = async (promptText) => {
    const u = auth.currentUser;
    if (!u) throw new Error("No hay sesión");

    const token = await u.getIdToken();

    const r = await fetch("/api/images/create-job", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt: promptText, size: "1024x1024" }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Error creando job");

    const jobId = data?.jobId;
    if (!jobId) throw new Error("No llegó jobId");

    return new Promise((resolve, reject) => {
      const jobRef = doc(db, "imageJobs", jobId);

      const unsub = onSnapshot(
        jobRef,
        (snap) => {
          const job = snap.data();
          if (!job) return;

          if (job.status === "done" && job.imageUrl) {
            unsub();
            resolve({ jobId, imageUrl: job.imageUrl });
          }

          if (job.status === "error") {
            unsub();
            reject(new Error(job.error || "Error generando imagen"));
          }
        },
        (err) => {
          unsub();
          reject(err);
        }
      );
    });
  };

  // --- Send message (textarea) ---
  const send = async () => {
    const text = input.trim();
    if (!text || sending || !user) return;
    if (!activeProjectId || !activeThreadId) return;

    // ❌ En Excel no usamos textarea
    if (activeTabKey === "excel") return;

    setSending(true);
    setInput("");

    const msgsRef = getMsgsRef();
    if (!msgsRef) {
      setSending(false);
      return;
    }

    await addDoc(msgsRef, {
      role: "user",
      type: "text",
      content: text,
      createdAt: serverTimestamp(),
    });

    const pRef = doc(db, "users", user.uid, "projects", activeProjectId);
    const newTitle =
      !activeProject?.title || activeProject?.title === "Nuevo proyecto"
        ? safeTitleFromText(text)
        : activeProject?.title;

    await updateDoc(pRef, {
      title: newTitle,
      lastMessage: text.slice(0, 120),
      updatedAt: serverTimestamp(),
    });

    const thRef = doc(db, "users", user.uid, "projects", activeProjectId, "threads", activeThreadId);
    await updateDoc(thRef, { updatedAt: serverTimestamp() });

    try {
      // ✅ IMAGES PRO FLOW
      if (activeTabKey === "images") {
        // mensaje placeholder mientras se procesa (se actualiza después)
        const loadingRef = await addDoc(msgsRef, {
          role: "assistant",
          type: "text",
          content: "⏳ Generando imagen… (job en cola)",
          createdAt: serverTimestamp(),
        });

        try {
          const { imageUrl } = await generateImageJob(text);

          await updateDoc(loadingRef, {
            type: "image",
            content: "🖼️ Imagen generada",
            imageUrl,
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          await updateDoc(loadingRef, {
            type: "text",
            content: `⚠️ Error Imagen: ${e?.message || "No se pudo generar la imagen."}`,
            updatedAt: serverTimestamp(),
          });
        }

        return;
      }

      // --- Chat / Code normal ---
      const context = [...messages, { role: "user", content: text }]
        .filter((m) => m?.role && (m?.content || m?.b64 || m?.imageUrl))
        .filter((m) => m.role !== "system")
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const sys = { role: "system", content: TAB_SYSTEM[activeTabKey] || TAB_SYSTEM.chat };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeTabKey,
          messages: [sys, ...context],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await addAssistantMessage(msgsRef, {
          type: "text",
          content: `⚠️ ${data?.error || "Error al generar respuesta."}`,
        });
      } else {
        await addAssistantMessage(msgsRef, {
          type: "text",
          content: data?.reply || "Listo ✅",
        });

        await updateDoc(pRef, {
          lastMessage: (data?.reply || "").slice(0, 120),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error(e);
      await addAssistantMessage(msgsRef, {
        type: "text",
        content: "⚠️ Error de red / servidor. Intenta de nuevo.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (activeTabKey === "excel") return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const goBack = () => router.push("/index-free");

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center center">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins]">
      <Head>
        <title>AUREA CHAT</title>
      </Head>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-black/60 backdrop-blur-md">
        <div className="max-w-[1650px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition"
              title="Mostrar/ocultar sidebar"
            >
              ☰
            </button>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="text-yellow-400 font-extrabold tracking-wide text-lg md:text-xl">
                  AUREA CHAT
                </div>
                <div className="px-2.5 py-1 rounded-full text-[11px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                  ● ONLINE
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-1">
                <div className="px-2.5 py-1 rounded-full text-[11px] border border-zinc-700 bg-zinc-900 text-zinc-200">
                  Proyecto: <span className="text-yellow-300">{activeProject?.title || "—"}</span>
                </div>

                <div className="px-2.5 py-1 rounded-full text-[11px] border border-yellow-500/40 bg-yellow-500/10 text-yellow-200">
                  Tab: <span className="font-semibold">{activeTabKey}</span>
                </div>

                {activeTabKey === "excel" ? (
                  <div className="px-2.5 py-1 rounded-full text-[11px] border border-cyan-500/40 bg-cyan-500/10 text-cyan-200">
                    Wizard activo
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden md:block text-xs text-zinc-400">
              Sesión: <span className="text-yellow-300">{user?.email}</span>
            </div>

            <button
              onClick={goBack}
              className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 hover:border-zinc-500 transition text-sm"
            >
              ← Volver
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-full bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition text-sm"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Layout */}
      <main className="max-w-[1650px] mx-auto px-4 md:px-6 py-5">
        <div className="flex gap-5">
          {/* Sidebar */}
          {sidebarOpen && (
            <aside className="w-[330px] shrink-0">
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 relative overflow-hidden">
                <div className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 rounded-full bg-yellow-400/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -right-20 w-64 h-64 rounded-full bg-yellow-400/10 blur-3xl" />

                {/* Brand card */}
                <div className="relative rounded-2xl border border-zinc-800 bg-black/60 p-4 mb-4">
                  <div className="text-xs text-zinc-400">Aurea33 · Studio</div>
                  <div className="text-lg font-bold text-white leading-tight">AUREA 33</div>
                  <div className="text-[11px] text-zinc-500 mt-2">
                    Proyectos persistentes · Tabs fijos
                  </div>
                </div>

                {/* Projects */}
                <div className="flex items-center justify-between mb-2 relative">
                  <div className="text-xs uppercase tracking-widest text-zinc-500">Proyectos</div>
                  <button
                    onClick={createProject}
                    className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs transition"
                  >
                    + Nuevo
                  </button>
                </div>

                <div className="space-y-2 max-h-[55vh] overflow-auto pr-1 relative">
                  {projects.length === 0 && (
                    <div className="text-sm text-zinc-500 py-3">
                      No hay proyectos aún. Crea uno con <b>+ Nuevo</b>.
                    </div>
                  )}

                  {projects.map((p) => {
                    const active = p.id === activeProjectId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => selectProject(p)}
                        className={`w-full text-left p-3 rounded-2xl border transition ${
                          active
                            ? "bg-yellow-500/10 border-yellow-400"
                            : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                        }`}
                      >
                        <div className="text-sm font-semibold text-white">{p.title || "Proyecto"}</div>
                        {p.lastMessage ? (
                          <div className="text-xs text-zinc-500 mt-2 line-clamp-2">{p.lastMessage}</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 text-[11px] text-zinc-600 relative">
                  Tip: 1 proyecto = 1 cliente / campaña / tarea
                </div>
              </div>
            </aside>
          )}

          {/* Main */}
          <section className="flex-1 min-w-0">
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl overflow-hidden relative">
              <div className="pointer-events-none absolute -top-24 left-1/3 w-72 h-72 rounded-full bg-yellow-400/6 blur-3xl" />

              {/* Tabs */}
              <div className="flex gap-2 p-3 border-b border-zinc-800 bg-black/40">
                {TABS.map((t) => {
                  const active = activeTabKey === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => selectTab(t.key)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${
                        active
                          ? "bg-yellow-400 text-black border-yellow-400 font-semibold"
                          : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                      }`}
                    >
                      {t.title}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              <div className="p-4 md:p-6">
                {activeTabKey === "excel" ? (
                  <div className="space-y-4">
                    <ExcelWizardBubbles onSubmit={handleExcelWizardSubmit} />
                    <div className="text-xs text-zinc-500">
                      {sending ? "Generando Excel…" : "Listo. Genera cuantas veces quieras."} ·{" "}
                      {TAB_TIP.excel}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Messages */}
                    <div ref={chatScrollRef} className="h-[68vh] overflow-auto space-y-4 relative">
                      {messages.map((m, idx) => {
                        const isUser = m.role === "user";
                        const isImage = m.type === "image" && (m.b64 || m.imageUrl);

                        return (
                          <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[92%] md:max-w-[78%] rounded-2xl px-5 py-4 border whitespace-pre-wrap leading-relaxed ${
                                isUser
                                  ? "bg-blue-600 text-white border-blue-500"
                                  : "bg-zinc-900 text-white border-zinc-800"
                              }`}
                            >
                              {isImage ? (
                                <div className="space-y-3">
                                  <div className="text-sm text-zinc-200">{m.content || "Imagen"}</div>
                                  <img
                                    src={m.imageUrl ? m.imageUrl : `data:image/png;base64,${m.b64}`}
                                    alt="AUREA generated"
                                    className="rounded-xl border border-zinc-700 max-w-full"
                                  />
                                </div>
                              ) : (
                                m.content
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Composer */}
                    <div className="border-t border-zinc-800 mt-4 pt-4 bg-black/10">
                      <div className="flex gap-3">
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={PLACEHOLDER[activeTabKey] || PLACEHOLDER.chat}
                          className="flex-1 min-h-[56px] max-h-[180px] resize-none rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                        />
                        <button
                          onClick={send}
                          disabled={sending}
                          className={`px-6 rounded-2xl font-semibold transition ${
                            sending
                              ? "bg-zinc-700 text-zinc-300 cursor-not-allowed"
                              : "bg-zinc-800 hover:bg-zinc-700 text-white"
                          }`}
                        >
                          {sending ? "Enviando…" : "Enviar"}
                        </button>
                      </div>

                      <div className="text-xs text-zinc-500 mt-2">
                        {TAB_TIP[activeTabKey] || TAB_TIP.chat}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

