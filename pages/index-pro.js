import Head from 'next/head';

export default function IndexPro() {
  return (
    <div className="min-h-screen bg-black text-white font-[Poppins]">
      <Head>
        <title>AUREA PRO</title>
      </Head>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold text-yellow-400 text-center mb-6">
          Bienvenido al Plan PRO
        </h1>
        <p className="text-center text-zinc-400 max-w-2xl mx-auto mb-10">
          Tienes acceso a <span className="text-yellow-300 font-semibold">100 contenidos al mes</span>, incluyendo herramientas visuales, video y mockups.
        </p>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          <div className="bg-zinc-900 border border-yellow-400 p-6 rounded-2xl shadow-xl">
            <h3 className="text-xl font-bold mb-2">🎨 Generador de Imágenes</h3>
            <p className="text-sm text-green-400">Disponible</p>
          </div>

          <div className="bg-zinc-900 border border-yellow-400 p-6 rounded-2xl shadow-xl">
            <h3 className="text-xl font-bold mb-2">🎬 Creación de Video</h3>
            <p className="text-sm text-green-400">Disponible</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl shadow-xl relative">
            <div className="absolute top-2 right-2 bg-red-600 text-xs px-2 py-1 rounded-full animate-pulse">Bloqueado 🔒</div>
            <h3 className="text-xl font-bold mb-2 opacity-50">🖌️ Herramientas tipo Illustrator</h3>
            <p className="text-sm text-zinc-600">Disponible solo en PLUS CREATOR</p>
          </div>
        </section>

        <div className="mt-16 text-center">
          <p className="text-zinc-400">¿Quieres desbloquear todo el poder creativo?</p>
          <a href="/dashboard" className="mt-3 inline-block bg-yellow-400 text-black font-bold px-6 py-3 rounded-full hover:bg-yellow-500 transition">
            Actualiza a PLUS CREATOR
          </a>
        </div>
      </main>
    </div>
  );
}
