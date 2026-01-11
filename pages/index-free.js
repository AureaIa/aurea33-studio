import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function IndexFree() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  const NEXT_AFTER_LOGIN = "/index-free";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setCheckingAuth(false);

      // Si no hay sesión, manda a login conservando el "next"
      if (!u) {
        router.replace(`/login?next=${encodeURIComponent(NEXT_AFTER_LOGIN)}`);
      }
    });

    return () => unsub();
  }, [router]);

  // Loader (evita parpadeo)
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-black text-yellow-400 flex items-center justify-center font-[Poppins]">
        <div className="text-center">
          <div className="text-3xl font-bold animate-pulse">AUREA</div>
          <div className="mt-2 text-xs text-zinc-500">Verificando sesión...</div>
        </div>
      </div>
    );
  }

  // Si no hay user, ya redirigió
  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins]">
      <Head>
        <title>AUREA FREE TRIAL</title>
      </Head>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold text-yellow-400 text-center mb-6">
          Bienvenido al Plan FREE TRIAL
        </h1>

        <p className="text-center text-zinc-400 max-w-2xl mx-auto mb-3">
          Hola,{" "}
          <span className="text-yellow-300 font-semibold">
            {user?.email || "usuario"}
          </span>
        </p>

        <p className="text-center text-zinc-400 max-w-2xl mx-auto mb-10">
          Puedes generar hasta{" "}
          <span className="text-yellow-300 font-semibold">10 contenidos gratuitos</span>.
          Explora lo que puedes desbloquear.
        </p>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          <div className="bg-zinc-900 border border-yellow-400 p-6 rounded-2xl shadow-xl">
            <h3 className="text-xl font-bold mb-2">🎨 Generador de Imágenes</h3>
            <p className="text-sm text-green-400">Disponible</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl shadow-xl relative">
            <div className="absolute top-2 right-2 bg-red-600 text-xs px-2 py-1 rounded-full animate-pulse">
              Bloqueado 🔒
            </div>
            <h3 className="text-xl font-bold mb-2 opacity-50">🎬 Creación de Video</h3>
            <p className="text-sm text-zinc-600">Solo disponible en Plan PRO o superior.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl shadow-xl relative">
            <div className="absolute top-2 right-2 bg-red-600 text-xs px-2 py-1 rounded-full animate-pulse">
              Bloqueado 🔒
            </div>
            <h3 className="text-xl font-bold mb-2 opacity-50">
              🖌️ Herramientas tipo Illustrator
            </h3>
            <p className="text-sm text-zinc-600">Disponible solo en PLUS CREATOR.</p>
          </div>
        </section>

        <div className="mt-16 text-center">
          <p className="text-zinc-400">
            ¿Listo para desbloquear tu potencial creativo?
          </p>

          {/* ✅ Botón nuevo: abrir chat */}
          <button
            onClick={() => router.push("/app")}
            className="mt-6 inline-block bg-blue-600 text-white font-bold px-8 py-4 rounded-full hover:bg-blue-700 transition shadow-xl"
          >
            🚀 Abrir Chat AUREA
          </button>

          <div className="mt-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-block bg-yellow-400 text-black font-bold px-6 py-3 rounded-full hover:bg-yellow-500 transition"
            >
              Ver planes disponibles
            </button>
          </div>

          <button
            onClick={() => router.push("/index-preview")}
            className="mt-4 block mx-auto text-sm text-zinc-400 hover:text-yellow-400 transition"
          >
            ← Volver al preview
          </button>
        </div>
      </main>
    </div>
  );
}

