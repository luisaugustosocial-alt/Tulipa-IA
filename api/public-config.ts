import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DEFAULT_CONFIG = {
  dailyLimit: 20,
  betaMessage: "🧪 Beta: mensagens diárias são limitadas para manter o teste estável.",
  assistantSubtitle: "Assistente geral em fase de testes",
  maintenanceMode: false,
  maintenanceMessage: "🌷 A Tulipa IA está em manutenção. Volte em alguns instantes.",
};

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_ADMIN_MISSING");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const db = getFirestore(getAdminApp());
    const snap = await db.collection("admin_config").doc("global").get();

    return res.status(200).json({
      ...DEFAULT_CONFIG,
      ...(snap.exists ? snap.data() || {} : {}),
    });
  } catch {
    return res.status(200).json(DEFAULT_CONFIG);
  }
}
