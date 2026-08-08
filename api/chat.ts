import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DAILY_LIMIT = 20;

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin não configurado na Vercel.");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
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

  try {
    const app = getAdminApp();
    const adminAuth = getAuth(app);
    const db = getFirestore(app);

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "Entre na sua conta para usar a Tulipa IA." });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({ error: "Digite uma mensagem." });
    }

    const usageRef = db.collection("tulipa_usage").doc(`${uid}_${todayKey()}`);

    const usage = await db.runTransaction(async (tx) => {
      const snap = await tx.get(usageRef);
      const current = snap.exists ? Number(snap.data()?.count || 0) : 0;

      if (current >= DAILY_LIMIT) {
        return { allowed: false, count: current };
      }

      const next = current + 1;
      tx.set(
        usageRef,
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

    if (!usage.allowed) {
      return res.status(429).json({
        code: "DAILY_LIMIT",
        error: "Limite diário de teste atingido.",
        limit: DAILY_LIMIT,
        remaining: 0,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave da Tulipa IA não configurada." });
    }

    const contents = history
      .filter((item: any) =>
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
Você é a Tulipa IA, uma assistente virtual geral, amigável e clara.

Seu nome é sempre Tulipa IA.
Você NÃO é exclusiva para química nem para uma pessoa específica.

Você pode ajudar com:
- estudos e explicações;
- escrita e revisão de textos;
- ideias e organização;
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
      return res.status(502).json({ error: "A Tulipa IA recebeu uma resposta inválida." });
    }

    if (!response.ok) {
      const detail = data?.error?.message || "Erro ao consultar a IA.";
      return res.status(response.status === 429 ? 429 : 502).json({
        error: detail,
        remaining: Math.max(0, DAILY_LIMIT - usage.count),
        limit: DAILY_LIMIT,
      });
    }

    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Não consegui responder agora. Tente novamente.";

    return res.status(200).json({
      answer: clean(answer),
      remaining: Math.max(0, DAILY_LIMIT - usage.count),
      limit: DAILY_LIMIT,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "O jardim da Tulipa IA teve um imprevisto. Tente novamente em alguns instantes.",
    });
  }
}
