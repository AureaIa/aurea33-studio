import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Head from 'next/head';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleGoToHome = () => {
    router.push('/');
  };

  const handlePreviewPlans = () => {
    router.push('/index-preview');
  };

  const handleSelectPlan = (plan) => {
    if (plan === 'free') {
      router.push('/index-free');
    } else if (plan === 'pro') {
      router.push('/index-pro');
    } else if (plan === 'plus') {
      router.push('/index-plus');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-black via-zinc-900 to-black text-white font-[Poppins]">
      <Head>
        <title>Dashboard | AUREA DESIGN</title>
      </Head>

      {/* ENCABEZADO HUD */}
      <header className="flex items-center justify-between px-10 py-6 border-b border-zinc-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-yellow-400 text-2xl font-bold tracking-wide">AUREA DESIGN STUDIO</h1>
        <div className="flex gap-4">
          <button onClick={handleGoToHome} className="text-sm border border-zinc-500 text-white px-5 py-2 rounded-full hover:bg-white hover:text-black transition">
            Ir al Inicio
          </button>
          <button onClick={handleLogout} className="text-sm bg-yellow-400 text-black px-5 py-2 rounded-full hover:bg-yellow-500 transition">
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* PANEL CENTRAL */}
      <main className="px-8 pt-14 pb-24 max-w-5xl mx-auto animate-fade-in">
        <h2 className="text-4xl font-bold mb-2 drop-shadow text-center">
          Bienvenido, <span className="text-yellow-400">{user?.email}</span>
        </h2>

        <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-zinc-900/80 border border-zinc-700 rounded-3xl p-6">
            <h3 className="text-yellow-400 text-xl font-semibold mb-4">Perfil del Usuario</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Nombre de usuario" className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-white" />
              <input type="email" placeholder="Correo de recuperación" className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-white" />
              <input type="password" placeholder="Nueva contraseña" className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-white" />
              <input type="file" accept="image/*" className="text-sm text-zinc-400" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-700 rounded-3xl p-6">
            <h3 className="text-yellow-400 text-xl font-semibold mb-4">Planes de Suscripción</h3>
            <div className="space-y-4">
              <button onClick={handlePreviewPlans} className="w-full py-3 bg-zinc-800 hover:bg-blue-600 hover:text-white rounded-md transition animate-pulse">
                Ver interfaz antes de elegir plan
              </button>
              <button onClick={() => handleSelectPlan('free')} className="w-full py-3 bg-zinc-800 hover:bg-yellow-400 hover:text-black rounded-md transition">
                FREE TRIAL — 10 generaciones gratis
              </button>
              <button onClick={() => handleSelectPlan('pro')} className="w-full py-3 bg-zinc-800 hover:bg-yellow-400 hover:text-black rounded-md transition">
                PRO — $9.99 USD/mes — 100 generaciones + acceso parcial a herramientas
              </button>
              <button onClick={() => handleSelectPlan('plus')} className="w-full py-3 bg-yellow-500 text-black font-bold hover:bg-yellow-600 rounded-md transition">
                PLUS CREATOR — $24.99 USD/mes — Acceso ILIMITADO a todo, incluyendo herramientas tipo Illustrator y Photoshop IA
              </button>
            </div>
          </div>
        </section>

        <footer className="mt-20 text-center text-zinc-600 text-sm border-t border-zinc-800 pt-6">
          © 2025 AUREA DESIGN STUDIO. Todos los derechos reservados.
        </footer>
      </main>
    </div>
  );
}
