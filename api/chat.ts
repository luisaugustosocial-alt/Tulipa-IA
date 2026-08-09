import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DEFAULT_DAILY_LIMIT = 20;

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

function clean(text: string) {
  return text
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\mathrm\{([^}]+)\}/g, "$1")
    .replace(/\\mathbf\{([^}]+)\}/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  let usageRef: FirebaseFirestore.DocumentReference | null = null;
  let usageCount = 0;

  try {
    const app = getAdminApp();
    const adminAuth = getAuth(app);
    const db = getFirestore(app);

    const configSnap = await db.collection("admin_config").doc("global").get();
    const configData = configSnap.exists ? configSnap.data() || {} : {};
    const dailyLimit = Math.max(
      1,
      Number(configData.dailyLimit || DEFAULT_DAILY_LIMIT)
    );
    const maintenanceMode = Boolean(configData.maintenanceMode);
    const maintenanceMessage =
      typeof configData.maintenanceMessage === "string" && configData.maintenanceMessage.trim()
        ? configData.maintenanceMessage.trim()
        : "🌷 A Tulipa IA está em manutenção. Volte em alguns instantes.";

    if (maintenanceMode) {
      return res.status(503).json({
        code: "MAINTENANCE",
        error: maintenanceMessage,
        limit: dailyLimit,
        remaining: 0,
      });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({
        error: "Entre novamente na sua conta para usar a Tulipa IA.",
      });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const message =
      typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({ error: "Digite uma mensagem." });
    }

    usageRef = db.collection("tulipa_usage").doc(`${uid}_${todayKey()}`);

    let usage;
    try {
      usage = await db.runTransaction(async (tx) => {
        const snap = await tx.get(usageRef!);
        const current = snap.exists ? Number(snap.data()?.count || 0) : 0;

        if (current >= dailyLimit) {
          return { allowed: false, count: current };
        }

        const next = current + 1;
        tx.set(
          usageRef!,
          {
            uid,
            date: todayKey(),
            count: next,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return { allowed: true, count: next };
      });
    } catch (error) {
      console.error("Firestore usage error:", error);
      return res.status(503).json({
        code: "FIRESTORE_NOT_READY",
        error: "O armazenamento da Tulipa IA ainda não está disponível.",
      });
    }

    usageCount = usage.count;

    if (!usage.allowed) {
      return res.status(429).json({
        code: "DAILY_LIMIT",
        error: "Limite diário de teste atingido.",
        limit: dailyLimit,
        remaining: 0,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return res.status(500).json({
        error: "A chave da Tulipa IA não está configurada no servidor.",
      });
    }

    const contents = history
      .filter(
        (item: any) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.text === "string"
      )
      .slice(-18)
      .map((item: any) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.text }],
      }));

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `
Você é a Tulipa IA, uma assistente virtual geral, amigável, clara e didática.

Seu nome é sempre Tulipa IA.
Você não é exclusiva para química nem para uma pessoa específica.

Você pode ajudar com:
- estudos e explicações;
- escrita, revisão e organização de textos;
- ideias e planejamento;
- cálculos simples;
- dúvidas gerais do cotidiano;
- trabalhos e tarefas de baixa complexidade.

Quando o assunto exigir informação profissional, médica, jurídica, financeira ou muito atual, deixe claro quando houver limites e não invente fatos.

Estilo:
- responda em português do Brasil por padrão;
- seja acolhedora, objetiva e didática;
- use emojis com moderação;
- não use LaTeX;
- não use comandos como \\text{} ou símbolos $;
- escreva fórmulas diretamente quando necessário;
- mantenha o contexto da conversa atual.
`,
              },
            ],
          },
          contents,
        }),
      }
    );

    const raw = await response.text();
    let data: any = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("GEMINI_INVALID_RESPONSE");
    }

    if (!response.ok) {
      // A mensagem não deve consumir a cota quando o Gemini falhar.
      if (usageRef) {
        await usageRef.set(
          {
            count: Math.max(0, usageCount - 1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }

      const detail = data?.error?.message || "Erro ao consultar a IA.";

      return res.status(response.status === 429 ? 429 : 502).json({
        error: detail,
        remaining: Math.max(0, dailyLimit - (usageCount - 1)),
        limit: dailyLimit,
      });
    }

    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Não consegui responder agora. Tente novamente.";

    return res.status(200).json({
      answer: clean(answer),
      remaining: Math.max(0, dailyLimit - usageCount),
      limit: dailyLimit,
    });
  } catch (error: any) {
    console.error("Tulipa API error:", error);

    if (usageRef && usageCount > 0) {
      await usageRef.set(
        {
          count: Math.max(0, usageCount - 1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    }

    if (error?.message === "FIREBASE_ADMIN_MISSING") {
      return res.status(500).json({
        error: "A conexão segura da Tulipa IA ainda não foi configurada.",
      });
    }

    return res.status(500).json({
      error: "O jardim da Tulipa IA teve um imprevisto. Tente novamente em alguns instantes.",
    });
  }
}
