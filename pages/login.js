import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth, provider } from "../lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const nextPath =
    typeof router.query.next === "string" && router.query.next.startsWith("/")
      ? router.query.next
      : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");

  const goNext = () => {
    router.push(nextPath);
  };

  // ✅ PRO: sin recargar la página
  const goRegister = () => {
    router.push(`/register?next=${encodeURIComponent(nextPath)}`);
  };

  // ✅ TOP CONTROL TOTAL: regresar siempre al preview
  const goPreview = () => {
    router.push("/index-preview");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );

      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log("Login exitoso:", result.user);

      goNext();
    } catch (err) {
      console.error("Email login error:", err);
      setError(err?.code || "Correo o contraseña inválidos");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );

      const result = await signInWithPopup(auth, provider);
      console.log("Login con Google exitoso:", result.user);

      goNext();
    } catch (err) {
      console.error("Google login error:", err);
      setError(err?.code || err?.message || "Error al iniciar sesión con Google");
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
      <Head>
        <title>Iniciar sesión | AUREA DESIGN</title>
      </Head>

      {/* Video de fondo opcional */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/intro.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <main className="relative z-10 bg-zinc-900/80 border border-zinc-700 rounded-2xl p-8 w-full max-w-md shadow-xl">
        {/* ✅ BOTÓN VOLVER AL PREVIEW */}
        <button
          onClick={goPreview}
          className="mb-4 text-sm text-zinc-400 hover:text-yellow-400 transition"
        >
          ← Volver al preview
        </button>

        <h1 className="text-yellow-400 text-2xl font-bold mb-6 text-center">
          Bienvenido a AUREA
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
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
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-md bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />

          {error && (
            <p className="text-red-500 text-sm text-center break-all">{error}</p>
          )}

          <div className="flex justify-between items-center text-xs text-zinc-400">
            <label className="select-none">
              <input
                type="checkbox"
                className="mr-1"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Recuérdame
            </label>

            <a href="#" className="hover:text-yellow-400">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <button
            type="submit"
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-3 rounded-full transition"
          >
            Iniciar sesión
          </button>
        </form>

        <div className="my-6 text-center text-sm text-zinc-500">— o —</div>

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white hover:bg-zinc-200 text-black font-semibold py-3 rounded-full transition"
        >
          Iniciar sesión con Google
        </button>

        <p className="mt-6 text-center text-sm text-zinc-400">
          ¿No tienes cuenta?{" "}
          <button onClick={goRegister} className="text-yellow-400 hover:underline">
            Crea una
          </button>
        </p>
      </main>
    </div>
  );
}
