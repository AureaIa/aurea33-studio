// lib/firebaseAdmin.js
import admin from "firebase-admin";

export function getAdmin() {
  if (admin.apps.length) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan envs de Firebase Admin (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY).");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return admin;
}

export async function verifyAuth(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("Missing Authorization Bearer token");

  const admin = getAdmin();
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded; // { uid, email, ... }
}
