// pages/dashboard.js
import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  updatePassword,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

/**
 * AUREA 33 — Dashboard Next-Gen
 * ✅ Mantiene tu lógica actual (perfil + planes + stripe checkout)
 * ✅ Agrega: Proyectos persistentes, buscador, pin, papelera (soft delete), restaurar, borrar definitivo
 * ✅ Abre /app con projectId en URL: /app?projectId=xxxx
 *
 * Firestore:
 * - usuarios/{uid}   (ya lo usas)
 * - projects/{projectId} con:
 *   { userId, title, subtitle, pinned, createdAt, updatedAt, deletedAt, stats:{ chats, images, excels, codes } }
 */

const PRICE_MAP = {
  free: null,
  pro: "price_1RQSk7PamRkQGgEEOicZ4qLG", // reemplaza con tu real
  plus: "price_1RQSlJPamRkQGgEERnZu8jJq", // reemplaza con tu real
};

export default function Dashboard() {
  const router = useRouter();

  // auth/profile
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [planActual, setPlanActual] = useState("FREE TRIAL");

  // password UI
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // projects
  const [projects, setProjects] = useState([]);
  const [trash, setTrash] = useState([]);
  const [activeMode, setActiveMode] = useState("active"); // 'active' | 'trash'
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // UI modals
  const [confirm, setConfirm] = useState(null);
  // confirm = { title, desc, actionLabel, tone:'danger'|'normal', onConfirm: fn }

  const unsubRef = useRef({ p: null, t: null });

  // ---------- AUTH bootstrap ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);
      setUsername(currentUser.displayName || "");
      setRecoveryEmail(currentUser.email || "");

      // load user doc (plan)
      try {
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (userDoc.exists()) {
          setPlanActual(userDoc.data().plan || "FREE TRIAL");
        }
      } catch (e) {
        console.warn("No se pudo leer usuarios/", e);
      }

      // subscribe projects
      subscribeProjects(currentUser.uid);
    });

    return () => {
      unsubscribe();
      // cleanup listeners
      if (unsubRef.current.p) unsubRef.current.p();
      if (unsubRef.current.t) unsubRef.current.t();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function subscribeProjects(uid) {
    // active
    const qActive = query(
      collection(db, "projects"),
      where("userId", "==", uid),
      where("deletedAt", "==", null),
      orderBy("pinned", "desc"),
      orderBy("updatedAt", "desc")
    );

    // trash
    const qTrash = query(
      collection(db, "projects"),
      where("userId", "==", uid),
      where("deletedAt", "!=", null),
      orderBy("deletedAt", "desc")
    );

    if (unsubRef.current.p) unsubRef.current.p();
    if (unsubRef.current.t) unsubRef.current.t();

    unsubRef.current.p = onSnapshot(
      qActive,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProjects(rows);
      },
      (err) => console.error("projects snapshot error", err)
    );

    unsubRef.current.t = onSnapshot(
      qTrash,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTrash(rows);
      },
      (err) => console.error("trash snapshot error", err)
    );
  }

  // ---------- Actions ----------
  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleGoToHome = () => router.push("/");

  const handlePreviewPlans = () => router.push("/index-preview");

  const handleSelectPlan = async (plan) => {
    if (plan === "free") {
      router.push("/index-free");
      return;
    }

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: PRICE_MAP[plan] }),
      });

      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert("Error al iniciar el proceso de pago.");
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al conectar con Stripe.");
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;

    if (newPassword && newPassword !== confirmPassword) {
      alert("Las contraseñas no coinciden.");
      return;
    }

    try {
      await updateProfile(user, { displayName: username });
      if (newPassword) await updatePassword(user, newPassword);

      await setDoc(
        doc(db, "usuarios", user.uid),
        {
          username,
          email: recoveryEmail,
          plan: planActual,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setNewPassword("");
      setConfirmPassword("");
      alert("Cambios guardados con éxito.");
    } catch (error) {
      console.error("Error al guardar:", error);
      alert(error?.message || "Hubo un error al guardar los datos.");
    }
  };

  const createProject = async () => {
    if (!user || creating) return;
    setCreating(true);

    try {
      const baseTitle = `Proyecto ${new Date().toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
      })} ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;

      const ref = await addDoc(collection(db, "projects"), {
        userId: user.uid,
        title: baseTitle,
        subtitle: "Nuevo proyecto",
        pinned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
        stats: { chats: 0, images: 0, excels: 0, codes: 0 },
      });

      // abre directo el proyecto
      router.push(`/app?projectId=${ref.id}`);
    } catch (e) {
      console.error(e);
      alert(e?.message || "No se pudo crear el proyecto.");
    } finally {
      setCreating(false);
    }
  };

  const openProject = (p) => router.push(`/app?projectId=${p.id}`);

  const renameProject = async (p, newTitle) => {
    if (!newTitle?.trim()) return;
    try {
      await updateDoc(doc(db, "projects", p.id), {
        title: newTitle.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo renombrar.");
    }
  };

  const togglePin = async (p) => {
    try {
      await updateDoc(doc(db, "projects", p.id), {
        pinned: !p.pinned,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo fijar.");
    }
  };

  const softDeleteProject = async (p) => {
    try {
      await updateDoc(doc(db, "projects", p.id), {
        deletedAt: serverTimestamp(),
        pinned: false,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo mover a papelera.");
    }
  };

  const restoreProject = async (p) => {
    try {
      await updateDoc(doc(db, "projects", p.id), {
        deletedAt: null,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo restaurar.");
    }
  };

  const hardDeleteProject = async (p) => {
    try {
      await deleteDoc(doc(db, "projects", p.id));
    } catch (e) {
      console.error(e);
      alert("No se pudo borrar definitivamente.");
    }
  };

  // ---------- Derived UI ----------
  const list = activeMode === "active" ? projects : trash;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return list;

    return list.filter((p) => {
      const t = (p.title || "").toLowerCase();
      const sub = (p.subtitle || "").toLowerCase();
      return t.includes(s) || sub.includes(s) || (p.id || "").toLowerCase().includes(s);
    });
  }, [list, search]);

  const stats = useMemo(() => {
    const allActive = projects || [];
    const sum = (k) =>
      allActive.reduce((acc, p) => acc + (Number(p?.stats?.[k]) || 0), 0);

    return {
      activeProjects: allActive.length,
      trashProjects: (trash || []).length,
      images: sum("images"),
      chats: sum("chats"),
      excels: sum("excels"),
      codes: sum("codes"),
    };
  }, [projects, trash]);

  const planPill = useMemo(() => {
    const label = planActual || "FREE TRIAL";
    const isPlus = String(label).toLowerCase().includes("plus");
    const isPro = String(label).toLowerCase().includes("pro");
    return { label, tone: isPlus ? "plus" : isPro ? "pro" : "free" };
  }, [planActual]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-tr from-black via-zinc-950 to-black text-white font-[Poppins]">
      <Head>
        <title>Dashboard | AUREA 33</title>
      </Head>

      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-zinc-800 bg-black/70 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center">
            <span className="text-yellow-400 font-black tracking-widest">A</span>
          </div>
          <div className="leading-tight">
            <div className="text-yellow-400 text-lg md:text-xl font-black tracking-wide">
              AUREA 33 STUDIO
            </div>
            <div className="text-xs text-zinc-400">
              Dashboard Next-Gen • Sesión:{" "}
              <span className="text-zinc-200">{user.email}</span>
            </div>
          </div>

          <span className={pill(planPill.tone)}>{planPill.label}</span>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={() => router.push("/app")}
            className="text-sm border border-zinc-700 text-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
          >
            Ir a App
          </button>
          <button
            onClick={handleGoToHome}
            className="text-sm border border-zinc-700 text-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
          >
            Inicio
          </button>
          <button
            onClick={handleLogout}
            className="text-sm bg-yellow-400 text-black px-4 py-2 rounded-full hover:bg-yellow-500 transition font-semibold"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="px-4 md:px-8 pt-8 pb-16 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950/90 via-zinc-900/30 to-zinc-950/90 p-6 md:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <h1 className="text-2xl md:text-4xl font-black">
                Bienvenido,{" "}
                <span className="text-yellow-400">{user.email}</span>
              </h1>
              <p className="text-sm md:text-base text-zinc-400 mt-2">
                Control total: perfil, suscripción y proyectos persistentes con papelera.
                Abre cualquier proyecto y continúa donde lo dejaste.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-[280px]">
              <Stat label="Proyectos" value={stats.activeProjects} />
              <Stat label="Papelera" value={stats.trashProjects} />
              <Stat label="Imágenes" value={stats.images} />
              <Stat label="Chats" value={stats.chats} />
            </div>
          </div>

          {/* Actions Row */}
          <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                onClick={createProject}
                disabled={creating}
                className="px-4 py-2 rounded-full bg-yellow-500 text-black font-black hover:bg-yellow-400 transition disabled:opacity-60"
              >
                {creating ? "Creando..." : "+ Nuevo proyecto"}
              </button>

              <button
                onClick={() => setActiveMode("active")}
                className={segBtn(activeMode === "active")}
              >
                Activos
              </button>

              <button
                onClick={() => setActiveMode("trash")}
                className={segBtn(activeMode === "trash")}
              >
                Papelera
              </button>
            </div>

            <div className="flex gap-2 items-center">
              <div className="relative w-full md:w-[360px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proyectos (título, nota, id)..."
                  className="w-full pl-10 pr-3 py-2 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-white outline-none focus:border-yellow-500/60"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  🔎
                </span>
              </div>

              <button
                onClick={handlePreviewPlans}
                className="px-4 py-2 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-blue-500/40 hover:bg-blue-600/15 transition"
                title="Ver UI de planes"
              >
                ✨ UI Planes
              </button>
            </div>
          </div>
        </div>

        {/* Grid: Projects + Profile/Plans */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects Panel */}
          <div className="lg:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg md:text-xl font-black text-yellow-400">
                  {activeMode === "active" ? "Proyectos" : "Papelera"}
                </h2>
                <p className="text-xs md:text-sm text-zinc-400">
                  {activeMode === "active"
                    ? "Click para abrir. Pin para fijar. Bote para mandar a papelera."
                    : "Restaura o borra definitivamente."}
                </p>
              </div>

              <div className="text-xs text-zinc-500">
                {filtered.length} item(s)
              </div>
            </div>

            <div className="mt-4 grid gap-2 max-h-[520px] overflow-auto pr-1 aur-scroll">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-center text-zinc-500">
                  {activeMode === "active"
                    ? "No hay proyectos todavía. Crea uno y empieza a generar 🔥"
                    : "La papelera está vacía."}
                </div>
              ) : (
                filtered.map((p) => (
                  <ProjectRow
                    key={p.id}
                    p={p}
                    mode={activeMode}
                    onOpen={() => openProject(p)}
                    onPin={() => togglePin(p)}
                    onRename={(title) => renameProject(p, title)}
                    onTrash={() =>
                      setConfirm({
                        title: "Mover a papelera",
                        desc: `¿Seguro que quieres mandar "${p.title}" a la papelera?`,
                        actionLabel: "Mover",
                        tone: "danger",
                        onConfirm: async () => softDeleteProject(p),
                      })
                    }
                    onRestore={() =>
                      setConfirm({
                        title: "Restaurar proyecto",
                        desc: `¿Restaurar "${p.title}"?`,
                        actionLabel: "Restaurar",
                        tone: "normal",
                        onConfirm: async () => restoreProject(p),
                      })
                    }
                    onDeleteForever={() =>
                      setConfirm({
                        title: "Borrar definitivamente",
                        desc: `Esto no se puede deshacer. ¿Borrar "${p.title}" para siempre?`,
                        actionLabel: "Borrar",
                        tone: "danger",
                        onConfirm: async () => hardDeleteProject(p),
                      })
                    }
                  />
                ))
              )}
            </div>

            <div className="mt-4 text-xs text-zinc-500">
              Tip: abre un proyecto → te manda a{" "}
              <span className="text-zinc-300">/app?projectId=...</span> para que tu App cargue el historial de ese proyecto.
            </div>
          </div>

          {/* Right Column: Profile + Plans */}
          <div className="grid gap-6">
            {/* Profile */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4 md:p-6">
              <h3 className="text-yellow-400 text-lg font-black mb-3">
                Perfil del Usuario
              </h3>

              <div className="space-y-3">
                <Field
                  label="Nombre de usuario"
                  value={username}
                  onChange={setUsername}
                  placeholder="Nombre de usuario"
                />
                <Field
                  label="Correo"
                  value={recoveryEmail}
                  onChange={setRecoveryEmail}
                  placeholder="Correo"
                  type="email"
                />
                <Field
                  label="Nueva contraseña"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Nueva contraseña"
                  type="password"
                />
                <Field
                  label="Confirmar"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirmar nueva contraseña"
                  type="password"
                />

                <button
                  onClick={handleSaveChanges}
                  className="w-full py-2.5 rounded-2xl bg-yellow-500 hover:bg-yellow-400 transition text-black font-black"
                >
                  Guardar cambios
                </button>

                <div className="text-xs text-zinc-500">
                  Consejo: si te da error de seguridad al cambiar password, Firebase suele pedir “recent login”.
                </div>
              </div>
            </div>

            {/* Plans */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4 md:p-6">
              <h3 className="text-yellow-400 text-lg font-black mb-2">
                Suscripción
              </h3>
              <p className="text-xs text-green-400 mb-4">
                Plan actual: <strong>{planActual}</strong>
              </p>

              <div className="grid gap-3">
                <button
                  onClick={handlePreviewPlans}
                  className="w-full py-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:bg-blue-600/15 hover:border-blue-500/40 transition"
                >
                  Ver interfaz antes de elegir plan ✨
                </button>

                <button
                  onClick={() => handleSelectPlan("free")}
                  className="w-full py-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:bg-yellow-500/15 hover:border-yellow-500/35 transition"
                >
                  FREE TRIAL — 10 generaciones gratis
                </button>

                <button
                  onClick={() => handleSelectPlan("pro")}
                  className="w-full py-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:bg-yellow-500/15 hover:border-yellow-500/35 transition"
                >
                  PRO — $9.99 USD/mes — 100 generaciones
                </button>

                <button
                  onClick={() => handleSelectPlan("plus")}
                  className="w-full py-3 rounded-2xl bg-yellow-500 text-black font-black hover:bg-yellow-400 transition"
                >
                  PLUS CREATOR — $24.99 USD/mes — ILIMITADO
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-12 text-center text-zinc-600 text-sm border-t border-zinc-900 pt-6">
          © 2026 AUREA 33 STUDIO • Next-Gen Dashboard
        </footer>
      </main>

      {/* Confirm Modal */}
      {confirm ? (
        <ConfirmModal
          title={confirm.title}
          desc={confirm.desc}
          actionLabel={confirm.actionLabel}
          tone={confirm.tone}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await confirm.onConfirm?.();
            } finally {
              setConfirm(null);
            }
          }}
        />
      ) : null}

      {/* tiny styles for scroll */}
      <style jsx global>{`
        .aur-scroll::-webkit-scrollbar {
          width: 10px;
        }
        .aur-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          border: 2px solid rgba(0, 0, 0, 0.35);
        }
        .aur-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.25);
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}

/* ---------------- UI components ---------------- */

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-xl font-black text-zinc-100">{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-white outline-none focus:border-yellow-500/60"
      />
    </div>
  );
}

function ProjectRow({
  p,
  mode,
  onOpen,
  onPin,
  onRename,
  onTrash,
  onRestore,
  onDeleteForever,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.title || "");
  const isTrash = mode === "trash";

  const subtitle = p.subtitle || "";
  const pinned = !!p.pinned;

  const statsLine = [
    `🖼️ ${Number(p?.stats?.images || 0)}`,
    `💬 ${Number(p?.stats?.chats || 0)}`,
    `📊 ${Number(p?.stats?.excels || 0)}`,
    `<> ${Number(p?.stats?.codes || 0)}`,
  ].join("   ");

  return (
    <div className="group rounded-2xl border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900/25 transition p-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          {pinned && !isTrash ? <span className="text-yellow-400">📌</span> : null}

          {!editing ? (
            <button
              onClick={onOpen}
              className="text-left font-bold truncate hover:text-yellow-300 transition"
              title={p.title}
            >
              {p.title || "(sin título)"}
            </button>
          ) : (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-black/40 border border-zinc-700 outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setEditing(false);
                  onRename?.(draft);
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(p.title || "");
                }
              }}
            />
          )}

          {!editing ? (
            <span className="text-[11px] text-zinc-600 truncate">
              {subtitle}
            </span>
          ) : null}
        </div>

        <div className="text-[11px] text-zinc-500 mt-1 truncate">
          {statsLine}
          <span className="ml-2 text-zinc-700">•</span>
          <span className="ml-2 text-zinc-600 truncate">id: {p.id}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isTrash ? (
          <>
            <IconBtn
              title={pinned ? "Quitar pin" : "Fijar"}
              onClick={onPin}
              label="📌"
            />
            <IconBtn
              title="Renombrar"
              onClick={() => {
                setEditing((v) => !v);
                setDraft(p.title || "");
              }}
              label="✏️"
            />
            <IconBtn title="Abrir" onClick={onOpen} label="↗️" />
            <IconBtn
              title="Papelera"
              onClick={onTrash}
              label="🗑️"
              danger
            />
          </>
        ) : (
          <>
            <IconBtn title="Restaurar" onClick={onRestore} label="♻️" />
            <IconBtn
              title="Borrar definitivo"
              onClick={onDeleteForever}
              label="🔥"
              danger
            />
          </>
        )}
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, label, danger = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        "h-10 w-10 rounded-2xl border transition flex items-center justify-center",
        danger
          ? "border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
          : "border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900/30",
      ].join(" ")}
    >
      <span className="text-sm">{label}</span>
    </button>
  );
}

function ConfirmModal({ title, desc, actionLabel, tone, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="text-lg font-black">{title}</div>
        <div className="text-sm text-zinc-400 mt-2">{desc}</div>

        <div className="mt-5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={[
              "px-4 py-2 rounded-2xl font-black transition",
              tone === "danger"
                ? "bg-red-500 hover:bg-red-400 text-black"
                : "bg-yellow-500 hover:bg-yellow-400 text-black",
            ].join(" ")}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function pill(tone) {
  const base =
    "hidden md:inline-flex items-center px-3 py-1 rounded-full text-xs font-black border";
  if (tone === "plus")
    return `${base} bg-yellow-500/15 text-yellow-300 border-yellow-500/25`;
  if (tone === "pro")
    return `${base} bg-blue-500/10 text-blue-200 border-blue-500/25`;
  return `${base} bg-zinc-900/60 text-zinc-200 border-zinc-800`;
}

function segBtn(active) {
  return [
    "px-4 py-2 rounded-full text-sm border transition font-bold",
    active
      ? "bg-yellow-500/15 border-yellow-500/35 text-yellow-200"
      : "bg-zinc-950/40 border-zinc-800 text-zinc-200 hover:bg-zinc-900/30",
  ].join(" ");
}
