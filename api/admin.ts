import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const DEFAULT_CONFIG = {
  dailyLimit: 20,
  betaMessage: "🧪 Beta: mensagens diárias são limitadas para manter o teste estável.",
  assistantSubtitle: "Assistente geral em fase de testes",
  maintenanceMode: false,
  maintenanceMessage: "🌷 A Tulipa IA está em manutenção. Volte em alguns instantes.",
  showBetaMessage: true,
  showDailyCounter: true,
  welcomeMessage: "Oi! Eu sou a Tulipa IA 🌷. Posso ajudar com estudos, textos, ideias, organização, explicações e dúvidas simples do dia a dia. O que vamos fazer?",
  loginSubtitle: "Uma assistente para estudar, organizar ideias, escrever e resolver dúvidas simples do dia a dia.",
  registrationsEnabled: true,
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

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function verifyAdmin(req: VercelRequest) {
  const app = getAdminApp();
  const auth = getAuth(app);

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) throw new Error("ADMIN_DENIED");

  const decoded = await auth.verifyIdToken(token);
  const email = String(decoded.email || "").trim().toLowerCase();
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const code = String(req.body?.code || "");
  const expectedCode = String(process.env.ADMIN_ACCESS_CODE || "");

  if (!adminEmail || !expectedCode) throw new Error("ADMIN_NOT_CONFIGURED");
  if (email !== adminEmail || code !== expectedCode) throw new Error("ADMIN_DENIED");

  return { app, auth, decoded };
}

async function readConfig(db: FirebaseFirestore.Firestore) {
  const snap = await db.collection("admin_config").doc("global").get();

  return {
    ...DEFAULT_CONFIG,
    ...(snap.exists ? snap.data() || {} : {}),
  };
}

async function buildDashboard() {
  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const [config, authUsers, todayUsage, feedbackSnap, profileSnap] = await Promise.all([
    readConfig(db),
    auth.listUsers(100),
    db.collection("tulipa_usage").where("date", "==", todayKey()).get(),
    db.collection("feedback").orderBy("createdAt", "desc").limit(100).get(),
    db.collection("users").limit(500).get(),
  ]);

  let conversations = 0;
  try {
    const aggregate = await db.collectionGroup("conversations").count().get();
    conversations = Number(aggregate.data().count || 0);
  } catch {
    conversations = 0;
  }

  const messagesToday = todayUsage.docs.reduce(
    (total, item) => total + Number(item.data()?.count || 0),
    0
  );

  const profiles = new Map(
    profileSnap.docs.map((item) => [item.id, item.data() || {}])
  );
  const now = Date.now();

  return {
    config,
    stats: {
      users: authUsers.users.length,
      conversations,
      messagesToday,
    },
    users: authUsers.users.map((item) => {
      const profile: any = profiles.get(item.uid) || {};
      const lastSeenDate = profile.lastSeenAt?.toDate
        ? profile.lastSeenAt.toDate()
        : null;
      const lastActiveDate = profile.lastActiveAt?.toDate
        ? profile.lastActiveAt.toDate()
        : lastSeenDate;
      const lastActiveMs = lastActiveDate ? lastActiveDate.getTime() : 0;

      return {
        uid: item.uid,
        email: item.email || "",
        displayName: item.displayName || "",
        disabled: item.disabled,
        lastSeenAt: lastSeenDate ? lastSeenDate.toISOString() : "",
        lastActiveAt: lastActiveDate ? lastActiveDate.toISOString() : "",
        online: Boolean(lastActiveMs && now - lastActiveMs <= 120000),
        privacyAccepted: profile.privacyAccepted === true,
        privacyPolicyVersion: String(profile.privacyPolicyVersion || ""),
      };
    }),
    feedbacks: feedbackSnap.docs.map((item) => {
      const data = item.data() || {};
      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : "";

      return {
        id: item.id,
        uid: String(data.uid || ""),
        email: String(data.email || ""),
        displayName: String(data.displayName || ""),
        type: String(data.type || "Feedback"),
        message: String(data.message || ""),
        status: String(data.status || "novo"),
        createdAt,
      };
    }),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    await verifyAdmin(req);

    const action = String(req.body?.action || "unlock");
    const db = getFirestore(getAdminApp());

    if (action === "unlock" || action === "dashboard") {
      const dashboard = await buildDashboard();
      return res.status(200).json(dashboard);
    }

    if (action === "updateConfig") {
      const raw = req.body?.config || {};

      const config = {
        dailyLimit: Math.min(1000, Math.max(1, Number(raw.dailyLimit || 20))),
        betaMessage:
          typeof raw.betaMessage === "string"
            ? raw.betaMessage.slice(0, 500)
            : DEFAULT_CONFIG.betaMessage,
        assistantSubtitle:
          typeof raw.assistantSubtitle === "string"
            ? raw.assistantSubtitle.slice(0, 120)
            : DEFAULT_CONFIG.assistantSubtitle,
        maintenanceMode: Boolean(raw.maintenanceMode),
        maintenanceMessage:
          typeof raw.maintenanceMessage === "string"
            ? raw.maintenanceMessage.slice(0, 500)
            : DEFAULT_CONFIG.maintenanceMessage,
        showBetaMessage:
          typeof raw.showBetaMessage === "boolean"
            ? raw.showBetaMessage
            : DEFAULT_CONFIG.showBetaMessage,
        showDailyCounter:
          typeof raw.showDailyCounter === "boolean"
            ? raw.showDailyCounter
            : DEFAULT_CONFIG.showDailyCounter,
        welcomeMessage:
          typeof raw.welcomeMessage === "string"
            ? raw.welcomeMessage.slice(0, 1000)
            : DEFAULT_CONFIG.welcomeMessage,
        loginSubtitle:
          typeof raw.loginSubtitle === "string"
            ? raw.loginSubtitle.slice(0, 500)
            : DEFAULT_CONFIG.loginSubtitle,
        registrationsEnabled:
          typeof raw.registrationsEnabled === "boolean"
            ? raw.registrationsEnabled
            : DEFAULT_CONFIG.registrationsEnabled,
        updatedAt: new Date().toISOString(),
      };

      await db.collection("admin_config").doc("global").set(config, { merge: true });

      return res.status(200).json({
        ok: true,
        config,
      });
    }

    if (action === "setUserDisabled") {
      const uid = String(req.body?.uid || "");
      const disabled = Boolean(req.body?.disabled);

      if (!uid) return res.status(400).json({ error: "UID inválido." });

      await getAuth(getAdminApp()).updateUser(uid, { disabled });
      return res.status(200).json({ ok: true });
    }

    if (action === "resetUserUsage") {
      const uid = String(req.body?.uid || "");
      if (!uid) return res.status(400).json({ error: "UID inválido." });

      const db = getFirestore(getAdminApp());
      await db.collection("tulipa_usage").doc(`${uid}_${todayKey()}`).delete().catch(() => {});
      return res.status(200).json({ ok: true });
    }

    if (action === "updateFeedbackStatus") {
      const feedbackId = String(req.body?.feedbackId || "");
      const status = String(req.body?.status || "");

      if (!feedbackId || !["novo", "lido", "arquivado"].includes(status)) {
        return res.status(400).json({ error: "Dados do feedback inválidos." });
      }

      await db.collection("feedback").doc(feedbackId).set(
        {
          status,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return res.status(200).json({ ok: true });
    }

    if (action === "deleteFeedback") {
      const feedbackId = String(req.body?.feedbackId || "");

      if (!feedbackId) {
        return res.status(400).json({ error: "Feedback inválido." });
      }

      await db.collection("feedback").doc(feedbackId).delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Ação administrativa inválida." });
  } catch (error: any) {
    console.error("Admin API error:", error);

    if (error?.message === "ADMIN_NOT_CONFIGURED") {
      return res.status(503).json({
        error: "O acesso administrativo ainda não foi configurado na Vercel.",
      });
    }

    return res.status(403).json({
      error: "Acesso administrativo negado.",
    });
  }
}
