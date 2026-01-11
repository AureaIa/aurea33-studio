import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

const categories = [
  { icon: "🖼️", title: "Imagen", desc: "De texto a imagen en alta calidad.", bg: "/intro.mp4" },
  { icon: "🎬", title: "Video", desc: "Convierte ideas en animaciones visuales.", bg: "/intro.mp4" },
  { icon: "✒️", title: "Vector", desc: "Crea ilustraciones precisas con IA.", bg: "/intro.mp4" },
  { icon: "🎧", title: "Audio", desc: "Genera ambientes y voces automáticas.", bg: "/intro.mp4" },
  { icon: "📦", title: "Mockup", desc: "Coloca tu marca en objetos realistas.", bg: "/intro.mp4" },
];

export default function Home() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  const NEXT_AFTER_LOGIN = "/index-free";

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  const goLogin = () => router.push(`/login?next=${encodeURIComponent(NEXT_AFTER_LOGIN)}`);
  const goRegister = () => router.push(`/register?next=${encodeURIComponent(NEXT_AFTER_LOGIN)}`);

  const goFree = () => router.push(NEXT_AFTER_LOGIN);

  const handlePreviewAction = () => {
    // Si hay sesión, directo a /index-free. Si no, a login con next
    if (user) return goFree();
    return goLogin();
  };

  return (
    <div className="relative bg-black min-h-screen text-white font-[Poppins]">
      <Head>
        <title>AUREA DESIGN STUDIO</title>
      </Head>

      {/* LOADING INTRO */}
      {isLoading && (
        <div className="fixed inset-0 bg-black z-[999] flex flex-col items-center justify-center text-yellow-400 text-center animate-fade-in">
          <div className="text-5xl font-bold animate-pulse-slow">AUREA DESIGN</div>
          <div className="mt-4 text-xs text-zinc-500">Loading experiencia visual...</div>
        </div>
      )}

      {/* VIDEO DE PORTADA */}
      <div className="absolute inset-0 z-0">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover">
          <source src="/intro.mp4" type="video/mp4" />
          Tu navegador no soporta videos :(
        </video>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      </div>

      {/* ENCABEZADO FIJO */}
      <header className="fixed top-0 left-0 w-full backdrop-blur-md bg-black/70 border-b border-zinc-800 z-50 flex justify-between items-center px-8 py-5">
        <h1 className="text-yellow-400 text-2xl font-bold tracking-wide drop-shadow">
          AUREA DESIGN
        </h1>

        <div className="space-x-4">
          {user ? (
            <>
              <button
                onClick={goFree}
                className="px-5 py-2 rounded-full border border-yellow-400 text-yellow-300 hover:bg-yellow-400 hover:text-black transition"
              >
                Ir a mi cuenta
              </button>
            </>
          ) : (
            <>
              <button
                onClick={goLogin}
                className="px-5 py-2 rounded-full border border-yellow-400 text-yellow-300 hover:bg-yellow-400 hover:text-black transition"
              >
                Iniciar sesión
              </button>
              <button
                onClick={goRegister}
                className="px-5 py-2 rounded-full bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition"
              >
                Crear cuenta
              </button>
            </>
          )}
        </div>
      </header>

      <main className="pt-40 px-6 pb-28 relative z-10">
        {/* HERO */}
        <section className="text-center mb-24 max-w-5xl mx-auto animate-fade-in">
          <h2 className="text-5xl md:text-6xl font-extrabold text-white drop-shadow-2xl mb-6 leading-tight">
            Explora nuevas formas de crear
          </h2>
          <p className="text-zinc-300 text-lg mb-10">
            Genera imágenes, audio, video y mockups con tecnología avanzada impulsada por IA.
          </p>

          <div className="max-w-3xl mx-auto flex items-center bg-zinc-900/80 border border-zinc-700 rounded-full overflow-hidden shadow-lg">
            <input
              type="text"
              placeholder="Describe lo que quieres generar..."
              className="w-full bg-transparent px-6 py-4 outline-none text-white placeholder-zinc-500"
            />
            <button
              onClick={handlePreviewAction}
              className="bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition"
            >
              Generar
            </button>
          </div>

          <div className="mt-4 text-xs text-zinc-400">
            {user ? (
              <>Sesión detectada ✅ Entrarás directo a tu plan FREE.</>
            ) : (
              <>Preview público 🔒 Al generar te pediremos iniciar sesión.</>
            )}
          </div>
        </section>

        {/* TABS SIMULADAS */}
        <div className="flex justify-center mb-10 flex-wrap gap-4">
          {categories.map((c, i) => (
            <button
              key={i}
              onClick={handlePreviewAction}
              className="px-4 py-2 text-sm rounded-full bg-zinc-800 text-white hover:bg-yellow-500 hover:text-black transition"
            >
              {c.title}
            </button>
          ))}
        </div>

        {/* CATEGORÍAS */}
        <section className="flex flex-wrap justify-center gap-10">
          {categories.map((item, idx) => (
            <div
              key={idx}
              className="w-72 h-96 rounded-3xl shadow-xl overflow-hidden relative group hover:scale-[1.03] transition-all"
            >
              <div className="absolute inset-0">
                <video autoPlay loop muted playsInline className="w-full h-full object-cover">
                  <source src={item.bg} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
              </div>

              <div className="relative z-10 p-6 flex flex-col justify-between h-full">
                <div>
                  <div className="text-5xl mb-4 text-white drop-shadow animate-pulse-slow">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold text-yellow-400 mb-1">{item.title}</h3>
                  <p className="text-sm text-zinc-400">{item.desc}</p>
                </div>

                <button
                  onClick={handlePreviewAction}
                  className="mt-6 px-5 py-3 rounded-full border border-yellow-400 text-yellow-300 hover:bg-yellow-400 hover:text-black transition w-full"
                >
                  Explorar
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="text-center text-zinc-600 text-xs py-10 border-t border-zinc-800 relative z-10">
        © 2025 AUREA DESIGN IA · Todos los derechos reservados · Discord · Instagram · Legal
      </footer>
    </div>
  );
}
