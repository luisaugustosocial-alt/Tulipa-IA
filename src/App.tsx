import { useEffect, useMemo, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import {
  Bot,
  LogOut,
  Menu,
  Mic,
  Moon,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Save,
  RefreshCw,
  Users,
  BarChart3,
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
  updateProfile,
  verifyBeforeUpdateEmail,
  sendPasswordResetEmail,
  deleteUser,
  type User,
} from "firebase/auth";
import {
  collection,
  addDoc,
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

type PublicConfig = {
  dailyLimit: number;
  betaMessage: string;
  assistantSubtitle: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  showBetaMessage: boolean;
  showDailyCounter: boolean;
  welcomeMessage: string;
  loginSubtitle: string;
  registrationsEnabled: boolean;
};

type AdminUser = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
};

type AdminDashboardData = {
  config: PublicConfig;
  stats: {
    users: number;
    conversations: number;
    messagesToday: number;
  };
  users: AdminUser[];
};

const DEFAULT_DAILY_LIMIT = 20;

const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  dailyLimit: DEFAULT_DAILY_LIMIT,
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

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LoginScreen({
  betaMessage,
  showBetaMessage,
  loginSubtitle,
  registrationsEnabled,
}: {
  betaMessage: string;
  showBetaMessage: boolean;
  loginSubtitle: string;
  registrationsEnabled: boolean;
}) {
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
        if (!registrationsEnabled) {
          throw new Error("Novos cadastros estão temporariamente desativados.");
        }
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
        <div className="brand-mark">
          <img
            src="/brand/tulipa-symbol.png"
            alt="Símbolo da Tulipa.ia"
            className="brand-symbol-image"
          />
        </div>
        <img
          src="/brand/tulipa-logo.png"
          alt="Tulipa.ia"
          className="auth-main-logo"
        />
        <p className="auth-subtitle">{loginSubtitle}</p>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Entrar
          </button>
          {registrationsEnabled && (
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              Criar conta
            </button>
          )}
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

        {showBetaMessage && (
          <p className="test-note">{betaMessage}</p>
        )}
      </section>
    </main>
  );
}

function TulipLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={compact ? "/brand/tulipa-symbol.png" : "/brand/tulipa-logo.png"}
      alt={compact ? "Símbolo da Tulipa.ia" : "Tulipa.ia"}
      className={compact ? "tulip-symbol-image" : "tulip-brand-image"}
    />
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
  const [publicConfig, setPublicConfig] = useState<PublicConfig>(DEFAULT_PUBLIC_CONFIG);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [feedbackType, setFeedbackType] = useState("Sugestão");
  const [feedbackText, setFeedbackText] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
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
    fetch("/api/public-config")
      .then(async (resp) => {
        if (!resp.ok) throw new Error("Configuração indisponível");
        return resp.json();
      })
      .then((data) => {
        const next: PublicConfig = {
          ...DEFAULT_PUBLIC_CONFIG,
          ...data,
        };
        setPublicConfig(next);
        setDailyLimit(next.dailyLimit);
        setRemaining((current) => Math.min(current, next.dailyLimit));
      })
      .catch(() => {
        setPublicConfig(DEFAULT_PUBLIC_CONFIG);
      });
  }, []);

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

  useEffect(() => {
    if (!user) return;
    setDisplayNameInput(user.displayName || "");
    setEmailInput(user.email || "");
  }, [user]);

  async function saveDisplayName() {
    if (!user) return;
    const name = displayNameInput.trim();
    if (!name) {
      setSettingsMessage("Digite um nome válido.");
      return;
    }

    setSettingsBusy(true);
    setSettingsMessage("");
    try {
      await updateProfile(user, { displayName: name });
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: name,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSettingsMessage("Nome atualizado.");
    } catch (error: any) {
      setSettingsMessage(error?.message || "Não foi possível atualizar o nome.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function requestEmailChange() {
    if (!user) return;
    const nextEmail = emailInput.trim();

    if (!nextEmail || nextEmail === user.email) {
      setSettingsMessage("Digite um e-mail diferente do atual.");
      return;
    }

    setSettingsBusy(true);
    setSettingsMessage("");
    try {
      await verifyBeforeUpdateEmail(user, nextEmail);
      setSettingsMessage(
        "Enviamos um link de confirmação para o novo e-mail. Depois de confirmar, entre novamente se necessário."
      );
    } catch (error: any) {
      setSettingsMessage(
        error?.code === "auth/requires-recent-login"
          ? "Por segurança, saia da conta, entre novamente e tente alterar o e-mail."
          : error?.message || "Não foi possível iniciar a alteração do e-mail."
      );
    } finally {
      setSettingsBusy(false);
    }
  }

  async function resetPassword() {
    if (!user?.email) return;

    setSettingsBusy(true);
    setSettingsMessage("");
    try {
      await sendPasswordResetEmail(auth, user.email);
      setSettingsMessage("Enviamos um e-mail para redefinir sua senha.");
    } catch (error: any) {
      setSettingsMessage(error?.message || "Não foi possível enviar o e-mail de redefinição.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function clearConversationHistory() {
    if (!user) return;

    const confirmed = window.confirm(
      "Apagar todo o histórico de conversas? Esta ação não pode ser desfeita."
    );
    if (!confirmed) return;

    setSettingsBusy(true);
    setSettingsMessage("");
    try {
      const snap = await getDocs(
        collection(db, "users", user.uid, "conversations")
      );

      await Promise.all(
        snap.docs.map((item) =>
          deleteDoc(doc(db, "users", user.uid, "conversations", item.id))
        )
      );

      const fresh = buildConversation();
      setConversations([fresh]);
      setActiveId(fresh.id);
      await persistConversation(fresh);
      setSettingsMessage("Histórico apagado.");
    } catch (error: any) {
      setSettingsMessage(error?.message || "Não foi possível apagar o histórico.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function submitFeedback() {
    if (!user) return;
    const message = feedbackText.trim();

    if (!message) {
      setSettingsMessage("Escreva seu feedback antes de enviar.");
      return;
    }

    setSettingsBusy(true);
    setSettingsMessage("");
    try {
      await addDoc(collection(db, "feedback"), {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        type: feedbackType,
        message,
        createdAt: serverTimestamp(),
        status: "novo",
      });

      setFeedbackText("");
      setSettingsMessage("Feedback enviado. Obrigado!");
    } catch (error: any) {
      setSettingsMessage(error?.message || "Não foi possível enviar o feedback.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function deleteMyAccount() {
    if (!user) return;

    const confirmed = window.confirm(
      "Excluir sua conta da Tulipa IA? Seu histórico será apagado e esta ação não poderá ser desfeita."
    );
    if (!confirmed) return;

    setSettingsBusy(true);
    setSettingsMessage("");

    try {
      const snap = await getDocs(
        collection(db, "users", user.uid, "conversations")
      );

      await Promise.all(
        snap.docs.map((item) =>
          deleteDoc(doc(db, "users", user.uid, "conversations", item.id))
        )
      );

      await deleteDoc(doc(db, "users", user.uid)).catch(() => {});
      await deleteUser(user);
    } catch (error: any) {
      setSettingsMessage(
        error?.code === "auth/requires-recent-login"
          ? "Por segurança, saia da conta, entre novamente e tente excluir a conta."
          : error?.message || "Não foi possível excluir sua conta."
      );
    } finally {
      setSettingsBusy(false);
    }
  }

  function buildConversation(): Conversation {
    const now = Date.now();

    return {
      id: makeId("chat"),
      title: "Nova conversa",
      messages: [
        {
          id: makeId("msg"),
          role: "assistant",
          text: publicConfig.welcomeMessage,
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

  async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
    if (!user) throw new Error("Usuário não autenticado.");

    const token = await user.getIdToken(true);
    const resp = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        code: adminCode,
        ...payload,
      }),
    });

    const raw = await resp.text();
    let data: any = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("Resposta inválida do painel administrativo.");
    }

    if (!resp.ok) {
      throw new Error(data?.error || "Acesso administrativo negado.");
    }

    return data;
  }

  async function unlockAdmin(code: string) {
    if (!user) return false;

    setAdminLoading(true);
    try {
      const token = await user.getIdToken(true);
      const resp = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "unlock",
          code,
        }),
      });

      const raw = await resp.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!resp.ok) return false;

      setAdminCode(code);
      setAdminData(data);
      setAdminUnlocked(true);
      setSidebarOpen(false);
      return true;
    } catch {
      return false;
    } finally {
      setAdminLoading(false);
    }
  }

  async function refreshAdmin() {
    setAdminLoading(true);
    try {
      const data = await callAdmin("dashboard");
      setAdminData(data);
    } catch (error: any) {
      alert(error?.message || "Não foi possível atualizar o painel.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function saveAdminConfig() {
    if (!adminData) return;

    setAdminSaving(true);
    try {
      const data = await callAdmin("updateConfig", {
        config: adminData.config,
      });

      setAdminData((prev) =>
        prev
          ? {
              ...prev,
              config: data.config,
            }
          : prev
      );

      setPublicConfig(data.config);
      setDailyLimit(data.config.dailyLimit);
      alert("Configurações salvas.");
    } catch (error: any) {
      alert(error?.message || "Não foi possível salvar.");
    } finally {
      setAdminSaving(false);
    }
  }

  function toggleVoiceInput() {
    if (typeof window === "undefined") return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("O reconhecimento de voz não é compatível com este navegador. Tente usar o Chrome ou Edge.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      recognitionRef.current = recognition;
      setListening(true);
    };
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) setInput(transcript.trim());
    };
    recognition.onerror = (event: any) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        alert("Não foi possível reconhecer sua voz. Verifique a permissão do microfone e tente novamente.");
      }
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.start();
  }

  async function send() {
    const text = input.trim();
    if (!text || !user || sending) return;

    if (text.startsWith("#")) {
      setInput("");
      const unlocked = await unlockAdmin(text);

      if (unlocked) return;

      const baseForNotice = active || buildConversation();
      const notice: Message = {
        id: makeId("msg"),
        role: "assistant",
        text: "🌷 Comando não reconhecido.",
        createdAt: Date.now(),
      };

      const updated: Conversation = {
        ...baseForNotice,
        messages: [...baseForNotice.messages, notice],
        updatedAt: Date.now(),
      };

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === updated.id);
        return exists
          ? prev.map((c) => (c.id === updated.id ? updated : c))
          : [updated, ...prev];
      });

      if (!active) setActiveId(updated.id);
      return;
    }

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
        <LoginScreen
          betaMessage={publicConfig.betaMessage}
          showBetaMessage={publicConfig.showBetaMessage}
          loginSubtitle={publicConfig.loginSubtitle}
          registrationsEnabled={publicConfig.registrationsEnabled}
        />
        <Analytics />
      </>
    );
  }

  if (adminUnlocked && adminData) {
    return (
      <div className="admin-shell">
        <header className="admin-topbar">
          <div className="admin-brand">
            <TulipLogo />
            <div>
              <strong>Painel Administrativo</strong>
              <span>Tulipa IA</span>
            </div>
          </div>

          <div className="admin-actions">
            <button onClick={refreshAdmin} disabled={adminLoading}>
              <RefreshCw size={17} />
              Atualizar
            </button>
            <button
              className="admin-exit"
              onClick={() => {
                setAdminUnlocked(false);
                setAdminCode("");
                setAdminData(null);
              }}
            >
              <X size={17} />
              Voltar ao chat
            </button>
          </div>
        </header>

        <main className="admin-content">
          <section className="admin-hero">
            <div>
              <div className="admin-kicker">
                <ShieldCheck size={17} />
                Acesso verificado
              </div>
              <h1>Controle da Tulipa IA 🌷</h1>
              <p>
                Altere configurações do Beta sem editar o código ou fazer novo deploy.
              </p>
            </div>
          </section>

          <section className="admin-stats-grid">
            <article className="admin-stat-card">
              <Users size={20} />
              <span>Usuários</span>
              <strong>{adminData.stats.users}</strong>
            </article>
            <article className="admin-stat-card">
              <Bot size={20} />
              <span>Conversas</span>
              <strong>{adminData.stats.conversations}</strong>
            </article>
            <article className="admin-stat-card">
              <BarChart3 size={20} />
              <span>Mensagens hoje</span>
              <strong>{adminData.stats.messagesToday}</strong>
            </article>
          </section>

          <section className="admin-panel-card">
            <div className="admin-card-title">
              <div>
                <h2>Configurações do Beta</h2>
                <p>Essas alterações são salvas no Firebase e passam a valer no site.</p>
              </div>
              <button
                className="admin-save"
                onClick={saveAdminConfig}
                disabled={adminSaving}
              >
                <Save size={17} />
                {adminSaving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>

            <div className="admin-form-grid">
              <label>
                Limite diário por usuário
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={adminData.config.dailyLimit}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...prev.config,
                              dailyLimit: Math.max(1, Number(e.target.value || 1)),
                            },
                          }
                        : prev
                    )
                  }
                />
              </label>

              <label>
                Subtítulo da assistente
                <input
                  value={adminData.config.assistantSubtitle}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...prev.config,
                              assistantSubtitle: e.target.value,
                            },
                          }
                        : prev
                    )
                  }
                />
              </label>

              <label className="admin-full-field">
                Mensagem do Beta
                <textarea
                  rows={3}
                  value={adminData.config.betaMessage}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...prev.config,
                              betaMessage: e.target.value,
                            },
                          }
                        : prev
                    )
                  }
                />
              </label>

              <label className="admin-switch-row">
                <input
                  type="checkbox"
                  checked={adminData.config.showBetaMessage}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? { ...prev, config: { ...prev.config, showBetaMessage: e.target.checked } }
                        : prev
                    )
                  }
                />
                <span>
                  <strong>Exibir mensagens de Beta</strong>
                  <small>Desative para remover os avisos de Beta do login e do chat.</small>
                </span>
              </label>

              <label className="admin-switch-row">
                <input
                  type="checkbox"
                  checked={adminData.config.showDailyCounter}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? { ...prev, config: { ...prev.config, showDailyCounter: e.target.checked } }
                        : prev
                    )
                  }
                />
                <span>
                  <strong>Exibir contador diário</strong>
                  <small>Mostra ou esconde o contador de mensagens no topo.</small>
                </span>
              </label>

              <label className="admin-switch-row">
                <input
                  type="checkbox"
                  checked={adminData.config.registrationsEnabled}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? { ...prev, config: { ...prev.config, registrationsEnabled: e.target.checked } }
                        : prev
                    )
                  }
                />
                <span>
                  <strong>Permitir novos cadastros</strong>
                  <small>Desative se quiser fechar temporariamente novas contas.</small>
                </span>
              </label>

              <label className="admin-full-field">
                Mensagem inicial da Tulipa
                <textarea
                  rows={4}
                  value={adminData.config.welcomeMessage}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? { ...prev, config: { ...prev.config, welcomeMessage: e.target.value } }
                        : prev
                    )
                  }
                />
              </label>

              <label className="admin-full-field">
                Texto da tela de login
                <textarea
                  rows={3}
                  value={adminData.config.loginSubtitle}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? { ...prev, config: { ...prev.config, loginSubtitle: e.target.value } }
                        : prev
                    )
                  }
                />
              </label>

              <label className="admin-switch-row">
                <input
                  type="checkbox"
                  checked={adminData.config.maintenanceMode}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...prev.config,
                              maintenanceMode: e.target.checked,
                            },
                          }
                        : prev
                    )
                  }
                />
                <span>
                  <strong>Modo manutenção</strong>
                  <small>Impede temporariamente novas mensagens para a IA.</small>
                </span>
              </label>

              <label className="admin-full-field">
                Mensagem de manutenção
                <textarea
                  rows={2}
                  value={adminData.config.maintenanceMessage}
                  onChange={(e) =>
                    setAdminData((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...prev.config,
                              maintenanceMessage: e.target.value,
                            },
                          }
                        : prev
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="admin-panel-card">
            <div className="admin-card-title">
              <div>
                <h2>Usuários recentes</h2>
                <p>Lista administrativa das contas cadastradas.</p>
              </div>
            </div>

            <div className="admin-user-list">
              {adminData.users.map((item) => (
                <div className="admin-user-row" key={item.uid}>
                  <div className="avatar-fallback">
                    <UserRound size={16} />
                  </div>
                  <div>
                    <strong>{item.displayName || "Sem nome"}</strong>
                    <span>{item.email || "Sem e-mail"}</span>
                  </div>
                  <small>{item.disabled ? "Bloqueado" : "Ativo"}</small>
                  <button
                    className="admin-user-action"
                    onClick={async () => {
                      try {
                        await callAdmin("resetUserUsage", { uid: item.uid });
                        alert("Limite diário desse usuário foi zerado.");
                        await refreshAdmin();
                      } catch (error: any) {
                        alert(error?.message || "Não foi possível zerar o uso.");
                      }
                    }}
                  >
                    Zerar uso
                  </button>
                  <button
                    className="admin-user-action"
                    onClick={async () => {
                      try {
                        await callAdmin("setUserDisabled", {
                          uid: item.uid,
                          disabled: !item.disabled,
                        });
                        await refreshAdmin();
                      } catch (error: any) {
                        alert(error?.message || "Não foi possível alterar o usuário.");
                      }
                    }}
                  >
                    {item.disabled ? "Desbloquear" : "Bloquear"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </main>

        <Analytics />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-brand">
          <TulipLogo compact={!sidebarOpen} />
          {sidebarOpen && (
            <div className="sidebar-brand-text">
              <span>{publicConfig.showBetaMessage ? "Beta" : ""}</span>
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

          <button onClick={() => setSettingsOpen(true)}>
            <Settings size={18} />
            {sidebarOpen && "Configurações"}
          </button>

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

      {settingsOpen && (
        <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <section
            className="settings-modal"
            onClick={(e) => e.stopPropagation()}
            aria-label="Configurações da conta"
          >
            <div className="settings-header">
              <div>
                <strong>Configurações</strong>
                <span>Conta, privacidade e feedback</span>
              </div>
              <button
                className="icon-button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Fechar configurações"
              >
                <X size={18} />
              </button>
            </div>

            <div className="settings-scroll">
              <section className="settings-section">
                <h3>Minha conta</h3>

                <label>
                  Nome
                  <div className="settings-inline">
                    <input
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                    />
                    <button onClick={saveDisplayName} disabled={settingsBusy}>
                      Salvar
                    </button>
                  </div>
                </label>

                <label>
                  E-mail
                  <div className="settings-inline">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                    />
                    <button onClick={requestEmailChange} disabled={settingsBusy}>
                      Alterar
                    </button>
                  </div>
                </label>

                <button
                  className="settings-secondary-button"
                  onClick={resetPassword}
                  disabled={settingsBusy}
                >
                  Redefinir senha
                </button>
              </section>

              <section className="settings-section">
                <h3>Privacidade e dados</h3>
                <p>
                  Apague todas as conversas salvas na sua conta e comece um histórico novo.
                </p>
                <button
                  className="settings-danger-outline"
                  onClick={clearConversationHistory}
                  disabled={settingsBusy}
                >
                  Apagar histórico de conversas
                </button>
              </section>

              <section className="settings-section">
                <h3>Feedback</h3>
                <label>
                  Tipo
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                  >
                    <option>Sugestão</option>
                    <option>Elogio</option>
                    <option>Problema</option>
                    <option>Outro</option>
                  </select>
                </label>

                <label>
                  Mensagem
                  <textarea
                    rows={5}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Conte o que você achou da Tulipa IA..."
                  />
                </label>

                <button
                  className="settings-primary-button"
                  onClick={submitFeedback}
                  disabled={settingsBusy}
                >
                  Enviar feedback
                </button>
              </section>

              <section className="settings-section settings-danger-zone">
                <h3>Zona de perigo</h3>
                <p>
                  Excluir a conta remove o acesso e apaga o histórico de conversas.
                </p>
                <button
                  className="settings-danger-button"
                  onClick={deleteMyAccount}
                  disabled={settingsBusy}
                >
                  Excluir minha conta
                </button>
              </section>

              {settingsMessage && (
                <div className="settings-message">{settingsMessage}</div>
              )}
            </div>
          </section>
        </div>
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
            <span>{publicConfig.assistantSubtitle}</span>
          </div>

          {publicConfig.showDailyCounter && (
            <div className="usage-pill" title="Limite diário de uso">
              🌷 {remaining}/{dailyLimit} hoje
            </div>
          )}
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
              {message.role === "assistant" && (
                <div className="message-avatar">
                  <img
                    src="/brand/tulipa-symbol.png"
                    alt="Tulipa.ia"
                    className="message-logo-image"
                  />
                </div>
              )}
              <div>
                <div className="bubble">{message.text}</div>
                <time>{formatTime(message.createdAt)}</time>
              </div>
            </article>
          ))}

          {sending && (
            <article className="message assistant">
              <div className="message-avatar">
                <img
                  src="/brand/tulipa-symbol.png"
                  alt="Tulipa.ia"
                  className="message-logo-image"
                />
              </div>
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
          {publicConfig.showBetaMessage && (
            <div className="beta-banner">{publicConfig.betaMessage}</div>
          )}
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
              className={`mic-button ${listening ? "listening" : ""}`}
              onClick={toggleVoiceInput}
              disabled={sending}
              type="button"
              aria-label={listening ? "Parar de ouvir" : "Falar com a Tulipa"}
              title={listening ? "Ouvindo... clique para parar" : "Mensagem por voz"}
            >
              <Mic size={18} />
            </button>
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
