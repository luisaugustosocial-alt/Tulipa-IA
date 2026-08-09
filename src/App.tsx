import { useEffect, useMemo, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import {
  Bot,
  LogOut,
  Menu,
  Moon,
  Plus,
  Send,
  Settings,
  Sun,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const DEFAULT_DAILY_LIMIT = 20;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleEmail() {
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err?.message || "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err?.message || "Não foi possível entrar com o Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />

      <section className="auth-card">
        <div className="brand-mark">🌷</div>
        <h1>Tulipa IA</h1>
        <p className="auth-subtitle">
          Uma assistente para estudar, organizar ideias, escrever, pesquisar conceitos
          e resolver dúvidas simples do dia a dia.
        </p>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Entrar
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Criar conta
          </button>
        </div>

        <label>
          E-mail
          <input
            type="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEmail()}
          />
        </label>

        <button className="primary full" disabled={busy} onClick={handleEmail}>
          {busy ? "Aguarde..." : mode === "register" ? "Criar minha conta" : "Entrar"}
        </button>

        <div className="separator"><span>ou</span></div>

        <button className="google full" disabled={busy} onClick={handleGoogle}>
          <span className="google-g">G</span>
          Continuar com Google
        </button>

        {error && <p className="error-text">{error}</p>}

        <p className="test-note">
          🧪 Fase de testes: cada conta possui um limite diário de mensagens.
        </p>
      </section>
    </main>
  );
}

function TulipLogo() {
  return (
    <div className="tulip-logo" aria-hidden="true">
      <span>🌷</span>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dark, setDark] = useState(() => localStorage.getItem("tulipa-dark") === "1");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth > 760;
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState(DEFAULT_DAILY_LIMIT);
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT);
  const [chatLoading, setChatLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || conversations[0],
    [conversations, activeId]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("tulipa-dark", dark ? "1" : "0");
  }, [dark]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 760) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        setDoc(
          doc(db, "users", currentUser.uid),
          {
            uid: currentUser.uid,
            email: currentUser.email || "",
            displayName: currentUser.displayName || "",
            photoURL: currentUser.photoURL || "",
            lastSeenAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((error) => {
          console.error("Não foi possível atualizar o perfil no Firestore:", error);
        });
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setConversations([]);
      setActiveId("");
      setChatLoading(false);
      return;
    }

    setChatLoading(true);

    (async () => {
      try {
        const q = query(
          collection(db, "users", user.uid, "conversations"),
          orderBy("updatedAt", "desc")
        );
        const snap = await getDocs(q);

        if (cancelled) return;

        const items: Conversation[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title || "Conversa",
            messages: Array.isArray(data.messages) ? data.messages : [],
            updatedAt: data.updatedAt || Date.now(),
          };
        });

        if (items.length) {
          setConversations(items);
          setActiveId(items[0].id);
        } else {
          const fresh = buildConversation();
          setConversations([fresh]);
          setActiveId(fresh.id);
          persistConversation(fresh).catch(() => {});
        }
      } catch (error) {
        console.error("Falha ao carregar conversas:", error);

        if (!cancelled) {
          const fresh = buildConversation();
          setConversations([fresh]);
          setActiveId(fresh.id);
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, sending]);

  function buildConversation(): Conversation {
    const now = Date.now();

    return {
      id: makeId("chat"),
      title: "Nova conversa",
      messages: [
        {
          id: makeId("msg"),
          role: "assistant",
          text:
            "Oi! Eu sou a Tulipa IA 🌷. Posso ajudar com estudos, textos, ideias, organização, explicações e dúvidas simples do dia a dia. O que vamos fazer?",
          createdAt: now,
        },
      ],
      updatedAt: now,
    };
  }

  function createConversation() {
    if (typeof window !== "undefined" && window.innerWidth <= 760) {
      setSidebarOpen(false);
    }

    const fresh = buildConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setInput("");

    persistConversation(fresh).catch((error) => {
      console.error("Falha ao salvar a nova conversa:", error);
    });
  }

  async function persistConversation(conv: Conversation) {
    if (!user) return;
    await setDoc(
      doc(db, "users", user.uid, "conversations", conv.id),
      conv,
      { merge: true }
    );
  }

  async function removeConversation(id: string) {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "conversations", id));
    const next = conversations.filter((c) => c.id !== id);

    if (next.length === 0) {
      setConversations([]);
      setActiveId("");
      setTimeout(createConversation, 0);
    } else {
      setConversations(next);
      if (activeId === id) setActiveId(next[0].id);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || !user || sending) return;

    let base = active;

    if (!base) {
      base = buildConversation();
      setConversations([base]);
      setActiveId(base.id);
    }

    setInput("");
    setSending(true);

    const userMessage: Message = {
      id: makeId("msg"),
      role: "user",
      text,
      createdAt: Date.now(),
    };

    const historyBefore = base.messages;
    const nextTitle =
      base.title === "Nova conversa"
        ? text.replace(/\s+/g, " ").slice(0, 42)
        : base.title;

    const withUser: Conversation = {
      ...base,
      title: nextTitle,
      messages: [...base.messages, userMessage],
      updatedAt: Date.now(),
    };

    setConversations((prev) => {
      const exists = prev.some((c) => c.id === base!.id);
      return exists
        ? prev.map((c) => (c.id === base!.id ? withUser : c))
        : [withUser, ...prev];
    });

    try {
      const token = await user.getIdToken(true);
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          history: historyBefore
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-18)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const raw = await resp.text();
      let data: any = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          "🌷 A Tulipa IA recebeu uma resposta inesperada do servidor. Atualize a página e tente novamente."
        );
      }

      if (!resp.ok) {
        if (resp.status === 429 && data?.code === "DAILY_LIMIT") {
          setRemaining(0);
          throw new Error(
            "🌷 O jardim da Tulipa IA já recebeu todas as mensagens de teste de hoje. Volte amanhã para continuarmos florescendo ideias juntos."
          );
        }

        if (resp.status === 429) {
          throw new Error(
            "🌷 O jardim da Tulipa IA ficou congestionado por alguns instantes. Aguarde um pouco, atualize o site e tente novamente."
          );
        }

        if (data?.code === "FIRESTORE_NOT_READY") {
          throw new Error(
            "🌷 O jardim da Tulipa IA ainda está sendo preparado. Tente novamente em alguns instantes."
          );
        }

        throw new Error(
          data?.error ||
            "🌷 A Tulipa IA teve um pequeno imprevisto. Atualize o site e tente novamente."
        );
      }

      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (typeof data.limit === "number") setDailyLimit(data.limit);

      const aiMessage: Message = {
        id: makeId("msg"),
        role: "assistant",
        text: data.answer,
        createdAt: Date.now(),
      };

      const complete: Conversation = {
        ...withUser,
        messages: [...withUser.messages, aiMessage],
        updatedAt: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) => (c.id === base!.id ? complete : c))
      );

      persistConversation(complete).catch((error) => {
        console.error("Falha ao salvar a conversa:", error);
      });
    } catch (err: any) {
      const aiMessage: Message = {
        id: makeId("msg"),
        role: "assistant",
        text:
          err?.message ||
          "🌷 O jardim da Tulipa IA ficou congestionado. Atualize o site e tente novamente em alguns instantes.",
        createdAt: Date.now(),
      };

      const complete: Conversation = {
        ...withUser,
        messages: [...withUser.messages, aiMessage],
        updatedAt: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) => (c.id === base!.id ? complete : c))
      );

      persistConversation(complete).catch(() => {});
    } finally {
      setSending(false);
    }
  }

  if (authLoading) {
    return <div className="loading-screen"><TulipLogo /><p>Carregando Tulipa IA...</p></div>;
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <Analytics />
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-brand">
          <TulipLogo />
          {sidebarOpen && (
            <div className="sidebar-brand-text">
              <strong>Tulipa IA</strong>
              <span>Beta</span>
            </div>
          )}

          <button
            className="mobile-close-sidebar"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            title="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <button className="new-chat" onClick={createConversation}>
          <Plus size={18} />
          {sidebarOpen && "Nova conversa"}
        </button>

        {sidebarOpen && (
          <div className="conversation-list">
            <p className="section-label">Conversas</p>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-row ${conv.id === activeId ? "active" : ""}`}
              >
                <button onClick={() => {
                  setActiveId(conv.id);
                  if (typeof window !== "undefined" && window.innerWidth <= 760) {
                    setSidebarOpen(false);
                  }
                }}>
                  <Bot size={15} />
                  <span>{conv.title}</span>
                </button>
                <button
                  className="delete-chat"
                  title="Excluir conversa"
                  onClick={() => removeConversation(conv.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-bottom">
          {sidebarOpen && (
            <div className="profile-mini">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                <div className="avatar-fallback"><UserRound size={17} /></div>
              )}
              <div>
                <strong>{user.displayName || "Minha conta"}</strong>
                <span>{user.email}</span>
              </div>
            </div>
          )}

          <button onClick={() => setDark((v) => !v)}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {sidebarOpen && (dark ? "Modo claro" : "Modo escuro")}
          </button>

          <button onClick={() => signOut(auth)}>
            <LogOut size={18} />
            {sidebarOpen && "Sair da conta"}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="mobile-sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="chat-area">
        <header className="topbar">
          <button
            className="icon-button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Abrir ou fechar menu"
          >
            {sidebarOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          <div className="topbar-title">
            <strong>{active?.title || "Tulipa IA"}</strong>
            <span>Assistente geral em fase de testes</span>
          </div>

          <div className="usage-pill" title="Limite diário de teste">
            🌷 {remaining}/{dailyLimit} hoje
          </div>
        </header>

        <section className="messages">
          {chatLoading && (
            <div className="chat-loading">🌷 Preparando seu jardim de conversas...</div>
          )}

          {!chatLoading && active?.messages.map((message) => (
            <article
              key={message.id}
              className={`message ${message.role === "user" ? "user" : "assistant"}`}
            >
              {message.role === "assistant" && <div className="message-avatar">🌷</div>}
              <div>
                <div className="bubble">{message.text}</div>
                <time>{formatTime(message.createdAt)}</time>
              </div>
            </article>
          ))}

          {sending && (
            <article className="message assistant">
              <div className="message-avatar">🌷</div>
              <div className="typing-bubble">
                <span />
                <span />
                <span />
              </div>
            </article>
          )}
          <div ref={bottomRef} />
        </section>

        <section className="composer-wrap">
          <div className="beta-banner">
            🧪 Beta: mensagens diárias são limitadas para manter o teste estável.
          </div>
          <div className="composer">
            <textarea
              value={input}
              placeholder="Converse com a Tulipa IA..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
            />
            <button
              className="send-button"
              onClick={send}
              disabled={sending || remaining <= 0}
              title={remaining <= 0 ? "Limite diário atingido" : "Enviar"}
            >
              <Send size={18} />
            </button>
          </div>
          <p className="privacy-hint">
            As conversas ficam vinculadas à sua conta para permitir histórico e continuidade.
          </p>
        </section>
      </main>

      <Analytics />
    </div>
  );
}
