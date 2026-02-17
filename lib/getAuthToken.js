// lib/getAuthToken.js
import { getAuth } from "firebase/auth";

/**
 * Devuelve un JWT de Firebase o null
 * - user logueado ✅
 * - user null ✅
 * - refresh token si hace falta ✅
 * - SSR safe ✅
 * - evita circular imports ✅
 */
export async function getAuthToken(forceRefresh = false) {
  try {
    // ✅ SSR safe
    if (typeof window === "undefined") return null;

    const auth = getAuth(); // 👈 NO importes { auth } desde ./firebase
    const user = auth?.currentUser;
    if (!user) return null;

    // 1) intento normal
    try {
      const token = await user.getIdToken(!!forceRefresh);
      return typeof token === "string" && token.length > 10 ? token : null;
    } catch {
      // 2) fallback: refresh forzado
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
