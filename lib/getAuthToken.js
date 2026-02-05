// lib/getAuthToken.js
import { auth } from "./firebase";

/**
 * Devuelve un JWT de Firebase o null
 * - user logueado ✅
 * - user null ✅
 * - refresh token si hace falta ✅
 * - SSR safe ✅
 */
export async function getAuthToken(forceRefresh = false) {
  try {
    // ✅ Evita romper en SSR
    if (typeof window === "undefined") return null;

    const user = auth?.currentUser;
    if (!user) return null;

    try {
      const token = await user.getIdToken(!!forceRefresh);
      return typeof token === "string" && token.length > 10 ? token : null;
    } catch {
      // 🔁 fallback: refresh forzado
      try {
        const token2 = await user.getIdToken(true);
        return typeof token2 === "string" && token2.length > 10 ? token2 : null;
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
}
