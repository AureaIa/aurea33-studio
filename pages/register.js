import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export default function RegisterPage() {
  const router = useRouter();

  const nextPath =
    typeof router.query.next === "string" && router.query.next.startsWith("/")
      ? router.query.next
      : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const goNext = () => router.push(nextPath);

  // ✅ TOP control total
  const goPreview = () => router.push("/index-preview");

  // ✅ sin recarga
  const goLogin = () => router.push(`/login?next=${encodeURIComponent(nextPath)}`);

  const handleRegister = async (e) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    try {
      // ✅ Persistencia según “Recuérdame”
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );

      const result = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Usuario creado:", result.user);

      setSuccess("¡Cuenta creada con éxito!");
      setTimeout(() => goNext(), 700);
    } catch (err) {
      console.error("Register error:", err);
      setError(err?.code || "No se pudo crear la cuenta. Verifica tu correo y contraseña.");
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
      <Head>
        <title>Crear cuenta | AUREA DESIGN</title>
      </Head>

      {/* Video fondo */}
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
        <source src="/intro.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <main className="relative z-10 bg-zinc-900/80 border border-zinc-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* ✅ BOTÓN VOLVER AL PREVIEW */}
        <button
          onClick={goPreview}
          className="mb-4 text-sm text-zinc-400 hover:text-yellow-400 transition"
        >
          ← Volver al preview
        </button>

        <h1 className="text-yellow-400 text-2xl font-bold mb-6 text-center animate-pulse-slow">
          Únete a AUREA33
        </h1>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="email"
            placeholder="tucorreo@aurea.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-md bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />

          <input
            type="password"
            placeholder="Contraseña segura"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-md bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />

          {/* ✅ Recuérdame */}
          <div className="flex items-center text-xs text-zinc-400">
            <label className="select-none">
              <input
                type="checkbox"
                className="mr-2"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Recuérdame
            </label>
          </div>

          {error && <p className="text-red-500 text-sm text-center break-all">{error}</p>}
          {success && <p className="text-green-400 text-sm text-center">{success}</p>}

          <button
            type="submit"
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-3 rounded-full transition"
          >
            Crear cuenta
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          ¿Ya tienes cuenta?{" "}
          <button onClick={goLogin} className="text-yellow-400 hover:underline">
            Inicia sesión
          </button>
        </p>
      </main>
    </div>
  );
}
