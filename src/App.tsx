import { useEffect, useMemo, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import {
  Bot,
  Paperclip,
  FileText,
  Image as ImageIcon,
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
  getDoc,
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
  attachment?: {
    name: string;
    mimeType: string;
    kind: "pdf" | "image";
  };
};

type PendingAttachment = {
  name: string;
  mimeType: string;
  data: string;
  kind: "pdf" | "image";
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
  lastSeenAt: string;
  lastActiveAt: string;
  online: boolean;
  privacyAccepted: boolean;
  privacyPolicyVersion: string;
};

type AdminFeedback = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
};

type AdminDashboardData = {
  config: PublicConfig;
  stats: {
    users: number;
    conversations: number;
    messagesToday: number;
  };
  users: AdminUser[];
  feedbacks: AdminFeedback[];
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


const PRIVACY_POLICY_VERSION = "1.0";

function PrivacyPolicyContent() {
  return (
    <div className="privacy-policy-text">
      <h2>Política de Privacidade da Tulipa IA</h2>
      <p className="privacy-version">Versão {PRIVACY_POLICY_VERSION}</p>

      <div className="privacy-summary-card">
        <strong>Resumo importante</strong>
        <p>
          A Tulipa IA utiliza dados necessários para manter sua conta, histórico e
          funcionalidades. O administrador pode acessar dados administrativos e
          conversas quando necessário para suporte, segurança e funcionamento da
          plataforma, mas não possui acesso à sua senha.
        </p>
      </div>

      <h3>1. Apresentação</h3>
      <p>
        Esta Política de Privacidade explica como a Tulipa IA coleta, utiliza,
        armazena, protege e trata informações relacionadas aos usuários durante
        a utilização da plataforma. Ao criar uma conta e utilizar a Tulipa IA,
        o usuário declara ter lido e compreendido esta Política.
      </p>

      <h3>2. Dados coletados</h3>
      <p>
        Para possibilitar o funcionamento da conta e dos serviços oferecidos,
        poderão ser tratados dados como nome de usuário, endereço de e-mail,
        identificador interno da conta, fotografia de perfil quando fornecida
        por serviço de autenticação, registros de acesso e utilização, data e
        horário do último acesso, informações técnicas necessárias ao
        funcionamento do sistema, feedbacks enviados pelo usuário e conteúdo
        das conversas realizadas com a Tulipa IA.
      </p>

      <h3>3. Dados de autenticação e senha</h3>
      <p>
        O administrador da Tulipa IA não possui acesso à senha utilizada pelo
        usuário. As credenciais de autenticação são processadas pelos serviços
        responsáveis pela autenticação da conta.
      </p>
      <p>
        O administrador poderá ter acesso aos dados necessários para
        identificação e gerenciamento da conta, incluindo principalmente o
        endereço de e-mail utilizado para login, identificador da conta, nome
        cadastrado, situação da conta e demais metadados administrativos.
      </p>
      <p>
        Esse acesso poderá ser utilizado quando necessário para prestar suporte
        ao usuário, identificar problemas de acesso, bloquear ou desativar
        contas, excluir contas, auxiliar em procedimentos de recuperação de
        acesso ou redefinição de senha e executar outras medidas administrativas
        necessárias ao funcionamento e à segurança da plataforma.
      </p>
      <p>
        A redefinição de senha não significa que o administrador terá
        conhecimento da senha anterior ou da nova senha escolhida pelo usuário.
      </p>

      <h3>4. Conversas realizadas na Tulipa IA</h3>
      <p>
        As conversas poderão ser armazenadas vinculadas à conta do usuário para
        possibilitar histórico, continuidade das conversas, funcionamento
        adequado da plataforma, suporte técnico e demais funcionalidades
        disponibilizadas.
      </p>
      <p>
        O usuário deve estar ciente de que o administrador autorizado da Tulipa
        IA poderá acessar o conteúdo das conversas quando isso for necessário
        para administração do serviço, suporte técnico, investigação de falhas,
        prevenção de abuso, segurança da plataforma, análise de denúncias,
        cumprimento de obrigações legais ou melhoria do funcionamento do
        serviço.
      </p>
      <p>
        Esse acesso administrativo não autoriza o uso indiscriminado das
        conversas para finalidades incompatíveis com a operação da Tulipa IA.
      </p>

      <h3>5. Finalidades do tratamento dos dados</h3>
      <p>
        Os dados poderão ser utilizados para criar e administrar contas;
        autenticar usuários; manter o histórico das conversas; fornecer
        respostas e funcionalidades da Tulipa IA; oferecer suporte; recuperar
        ou administrar contas; detectar erros e abusos; proteger a segurança do
        serviço; realizar manutenção; analisar feedbacks; melhorar
        funcionalidades; cumprir obrigações legais; e exercer direitos
        legítimos relacionados à operação e proteção da plataforma.
      </p>

      <h3>6. Serviços de terceiros</h3>
      <p>
        Para funcionar, a Tulipa IA poderá utilizar serviços tecnológicos de
        terceiros, incluindo serviços de hospedagem, autenticação, banco de
        dados, inteligência artificial, análise de funcionamento e
        infraestrutura.
      </p>
      <p>
        Determinadas informações poderão ser processadas por esses serviços na
        medida necessária à execução das funcionalidades solicitadas pelo
        usuário. O tratamento realizado por terceiros também poderá estar
        sujeito às políticas e condições dos respectivos fornecedores.
      </p>

      <h3>7. Segurança das informações</h3>
      <p>
        A Tulipa IA busca adotar medidas técnicas e administrativas destinadas
        a proteger os dados contra acessos não autorizados, alteração, perda,
        destruição ou divulgação indevida.
      </p>
      <p>
        Entretanto, nenhum sistema conectado à internet é totalmente imune a
        falhas, ataques cibernéticos, invasões, vulnerabilidades ou incidentes
        de segurança. Por esse motivo, a Tulipa IA não garante proteção absoluta
        contra ações ilícitas praticadas por terceiros.
      </p>
      <p>
        Caso seja identificado incidente relevante que possa envolver dados
        pessoais, poderão ser adotadas as medidas técnicas, administrativas e
        legais consideradas necessárias.
      </p>

      <h3>8. Responsabilidade do usuário</h3>
      <p>
        O usuário é responsável pela guarda e confidencialidade de suas
        credenciais de acesso, pela utilização de senhas seguras e por evitar
        compartilhar informações de acesso com terceiros.
      </p>
      <p>
        O usuário também deve evitar inserir nas conversas informações
        extremamente sensíveis ou dados pessoais de terceiros que não sejam
        necessários para a utilização do serviço.
      </p>

      <h3>9. Histórico e exclusão de conversas</h3>
      <p>
        O usuário poderá utilizar as ferramentas disponibilizadas na plataforma
        para apagar o histórico de conversas associado à sua conta.
      </p>
      <p>
        A exclusão poderá remover os registros disponíveis ao usuário nos
        sistemas ativos da plataforma, observadas eventuais necessidades
        técnicas, legais, de segurança ou de preservação temporária de
        registros.
      </p>

      <h3>10. Alteração de dados da conta</h3>
      <p>
        O usuário poderá solicitar ou realizar, conforme as funcionalidades
        disponíveis, alteração de nome, alteração ou verificação de endereço de
        e-mail, redefinição de senha e outras atualizações relacionadas à conta.
      </p>
      <p>
        Algumas alterações poderão exigir nova autenticação ou confirmação de
        identidade por razões de segurança.
      </p>

      <h3>11. Exclusão ou desativação da conta</h3>
      <p>
        O usuário poderá solicitar ou executar a exclusão da própria conta pelas
        ferramentas disponibilizadas.
      </p>
      <p>
        O administrador também poderá desativar, bloquear ou excluir contas
        quando houver solicitação do titular, necessidade técnica, risco à
        segurança, utilização abusiva, violação das regras do serviço,
        determinação legal ou outra justificativa legítima relacionada ao
        funcionamento da plataforma.
      </p>

      <h3>12. Feedbacks</h3>
      <p>
        Sugestões, elogios, críticas ou relatos de problemas enviados pelo
        usuário poderão ser armazenados para análise administrativa e melhoria
        da Tulipa IA.
      </p>
      <p>
        O feedback poderá ficar associado ao nome, e-mail e identificador da
        conta do usuário para possibilitar acompanhamento e resposta quando
        necessário.
      </p>

      <h3>13. Direitos do usuário</h3>
      <p>
        Nos termos da legislação aplicável, o usuário poderá exercer direitos
        relacionados aos seus dados pessoais, inclusive solicitar confirmação
        da existência de tratamento, acesso, correção de informações inexatas e,
        quando aplicável, eliminação ou outras providências previstas na
        legislação.
      </p>

      <h3>14. Registros de utilização</h3>
      <p>
        A plataforma poderá registrar informações como último acesso,
        utilização recente e estado de atividade da conta para fins de
        funcionamento, segurança, administração e suporte.
      </p>
      <p>
        A indicação de que um usuário está “online” poderá ser baseada em
        registros técnicos recentes de atividade e não necessariamente
        representar, com precisão absoluta, que a pessoa esteja olhando para a
        plataforma naquele exato segundo.
      </p>

      <h3>15. Menores de idade</h3>
      <p>
        Caso a Tulipa IA seja disponibilizada para menores de idade, poderão ser
        aplicadas medidas adicionais de proteção, consentimento ou verificação
        conforme a legislação aplicável.
      </p>

      <h3>16. Alterações desta Política</h3>
      <p>
        Esta Política poderá ser atualizada sempre que houver mudanças
        relevantes nas funcionalidades, na legislação, nos serviços utilizados
        ou nas práticas de tratamento de dados.
      </p>
      <p>
        Quando houver alteração relevante, a plataforma poderá solicitar
        novamente a manifestação de ciência ou aceite do usuário.
      </p>

      <h3>17. Aceite</h3>
      <p>
        Ao marcar a opção “Li e aceito a Política de Privacidade”, o usuário
        declara ter tido acesso ao conteúdo desta Política e concorda com o
        tratamento de seus dados nos termos aqui descritos, sem prejuízo dos
        direitos assegurados pela legislação aplicável.
      </p>
      <p>
        O registro do aceite poderá conter data, horário, identificação da conta
        e versão da Política aceita para fins de comprovação e administração do
        serviço.
      </p>
    </div>
  );
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
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  async function handleEmail() {
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        if (!privacyChecked) {
          throw new Error("Você precisa aceitar a Política de Privacidade para criar a conta.");
        }
        if (!registrationsEnabled) {
          throw new Error("Novos cadastros estão temporariamente desativados.");
        }
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(
          doc(db, "users", credential.user.uid),
          {
            privacyAccepted: true,
            privacyAcceptedAt: serverTimestamp(),
            privacyPolicyVersion: PRIVACY_POLICY_VERSION,
          },
          { merge: true }
        );
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

        {mode === "register" && (
          <div className="privacy-register-box">
            <label className="privacy-checkbox">
              <input
                type="checkbox"
                checked={privacyChecked}
                onChange={(e) => setPrivacyChecked(e.target.checked)}
              />
              <span>
                Li e aceito a{" "}
                <button
                  type="button"
                  className="privacy-link-button"
                  onClick={() => setPrivacyOpen(true)}
                >
                  Política de Privacidade
                </button>
              </span>
            </label>
          </div>
        )}

        <button
          className="primary full"
          disabled={busy || (mode === "register" && !privacyChecked)}
          onClick={handleEmail}
        >
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

      {privacyOpen && (
        <div className="privacy-backdrop" onClick={() => setPrivacyOpen(false)}>
          <section className="privacy-modal privacy-modal-register" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-modal-header">
              <div>
                <strong>Política de Privacidade</strong>
                <span>Leia com calma antes de criar sua conta.</span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setPrivacyOpen(false)}
                aria-label="Fechar política"
              >
                <X size={18} />
              </button>
            </div>
            <div className="privacy-modal-scroll">
              <PrivacyPolicyContent />
            </div>
            <div className="privacy-modal-footer">
              <button
                type="button"
                className="privacy-modal-close"
                onClick={() => setPrivacyOpen(false)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setPrivacyChecked(true);
                  setPrivacyOpen(false);
                }}
              >
                Li e aceito
              </button>
            </div>
          </section>
        </div>
      )}
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
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyAccepting, setPrivacyAccepting] = useState(false);
  const [privacyAgreementChecked, setPrivacyAgreementChecked] = useState(false);
  const [privacyViewOpen, setPrivacyViewOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" | "info" } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [feedbackType, setFeedbackType] = useState("Sugestão");
  const [feedbackText, setFeedbackText] = useState("");
  const [listening, setListening] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || conversations[0],
    [conversations, activeId]
  );

  function showToast(message: string, kind: "success" | "error" | "info" = "info") {
    setToast({ message, kind });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4200);
  }

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
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        setPrivacyAccepted(false);
        setPrivacyLoading(false);
        return;
      }

      setPrivacyLoading(true);

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};

        const accepted =
          data?.privacyAccepted === true &&
          data?.privacyPolicyVersion === PRIVACY_POLICY_VERSION;

        setPrivacyAccepted(accepted);

        await setDoc(
          userRef,
          {
            uid: currentUser.uid,
            email: currentUser.email || "",
            displayName: currentUser.displayName || "",
            photoURL: currentUser.photoURL || "",
            lastSeenAt: serverTimestamp(),
            lastActiveAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Não foi possível atualizar o perfil no Firestore:", error);
        setPrivacyAccepted(false);
      } finally {
        setPrivacyLoading(false);
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;

    let stopped = false;

    const heartbeat = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      await setDoc(
        doc(db, "users", user.uid),
        {
          lastActiveAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    };

    heartbeat();
    const interval = window.setInterval(heartbeat, 45000);

    const handleActivity = () => heartbeat();
    window.addEventListener("focus", handleActivity);
    document.addEventListener("visibilitychange", handleActivity);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleActivity);
      document.removeEventListener("visibilitychange", handleActivity);
    };
  }, [user]);

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
      showToast("Digite um nome válido.", "error");
      return;
    }

    setSettingsBusy(true);
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
      showToast("Nome atualizado.", "success");
    } catch (error: any) {
      showToast(error?.message || "Não foi possível atualizar o nome.", "error");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function requestEmailChange() {
    if (!user) return;
    const nextEmail = emailInput.trim();

    if (!nextEmail || nextEmail === user.email) {
      showToast("Digite um e-mail diferente do atual.", "error");
      return;
    }

    setSettingsBusy(true);
    try {
      await verifyBeforeUpdateEmail(user, nextEmail);
      showToast(
        "Enviamos um link de confirmação para o novo e-mail. Depois de confirmar, entre novamente se necessário.",
        "success"
      );
    } catch (error: any) {
      showToast(
        error?.code === "auth/requires-recent-login"
          ? "Por segurança, saia da conta, entre novamente e tente alterar o e-mail."
          : error?.message || "Não foi possível iniciar a alteração do e-mail.",
        "error"
      );
    } finally {
      setSettingsBusy(false);
    }
  }

  async function resetPassword() {
    if (!user?.email) return;

    setSettingsBusy(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast("Enviamos um e-mail para redefinir sua senha.", "success");
    } catch (error: any) {
      showToast(error?.message || "Não foi possível enviar o e-mail de redefinição.", "error");
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
      showToast("Histórico apagado.", "success");
    } catch (error: any) {
      showToast(error?.message || "Não foi possível apagar o histórico.", "error");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function submitFeedback() {
    if (!user) return;
    const message = feedbackText.trim();

    if (!message) {
      showToast("Escreva seu feedback antes de enviar.", "error");
      return;
    }

    setSettingsBusy(true);
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
      showToast("Feedback enviado. Obrigado!", "success");
    } catch (error: any) {
      showToast(error?.message || "Não foi possível enviar o feedback.", "error");
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
      showToast(
        error?.code === "auth/requires-recent-login"
          ? "Por segurança, saia da conta, entre novamente e tente excluir a conta."
          : error?.message || "Não foi possível excluir sua conta.",
        "error"
      );
    } finally {
      setSettingsBusy(false);
    }
  }

  async function acceptPrivacyPolicy() {
    if (!user || !privacyAgreementChecked) return;

    setPrivacyAccepting(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          privacyAccepted: true,
          privacyAcceptedAt: serverTimestamp(),
          privacyPolicyVersion: PRIVACY_POLICY_VERSION,
          lastActiveAt: serverTimestamp(),
        },
        { merge: true }
      );
      setPrivacyAccepted(true);
      showToast("Política de Privacidade aceita.", "success");
    } catch (error: any) {
      showToast(error?.message || "Não foi possível registrar o aceite.", "error");
    } finally {
      setPrivacyAccepting(false);
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
    setAttachment(null);

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

  function chooseAttachment() {
    if (sending) return;
    fileInputRef.current?.click();
  }

  function handleAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      alert("Envie apenas PDF, JPG, JPEG ou PNG.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("O arquivo deve ter no máximo 10 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      if (commaIndex < 0) {
        alert("Não foi possível ler o arquivo.");
        return;
      }

      setAttachment({
        name: file.name,
        mimeType: file.type,
        data: result.slice(commaIndex + 1),
        kind: file.type === "application/pdf" ? "pdf" : "image",
      });
    };
    reader.onerror = () => alert("Não foi possível ler o arquivo.");
    reader.readAsDataURL(file);
  }

  async function send() {
    const text = input.trim();
    const currentAttachment = attachment;
    if ((!text && !currentAttachment) || !user || sending) return;

    if (text.startsWith("#") && !currentAttachment) {
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
    setAttachment(null);
    setSending(true);

    const userMessage: Message = {
      id: makeId("msg"),
      role: "user",
      text: text || (currentAttachment ? `📎 ${currentAttachment.name}` : ""),
      createdAt: Date.now(),
      attachment: currentAttachment
        ? {
            name: currentAttachment.name,
            mimeType: currentAttachment.mimeType,
            kind: currentAttachment.kind,
          }
        : undefined,
    };

    const historyBefore = base.messages;
    const nextTitle =
      base.title === "Nova conversa"
        ? (text || currentAttachment?.name || "Novo anexo").replace(/\s+/g, " ").slice(0, 42)
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
          attachment: currentAttachment
            ? {
                name: currentAttachment.name,
                mimeType: currentAttachment.mimeType,
                data: currentAttachment.data,
              }
            : null,
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

  if (authLoading || (user && privacyLoading)) {
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

  if (user && !privacyAccepted) {
    return (
      <>
        <div className="privacy-gate-shell">
          <section className="privacy-gate-card">
            <div className="privacy-gate-header">
              <img
                src="/brand/tulipa-symbol.png"
                alt="Tulipa.ia"
                className="privacy-gate-logo"
              />
              <div>
                <h1>Política de Privacidade</h1>
                <p>Para continuar usando a Tulipa IA, leia e aceite a versão atual.</p>
              </div>
            </div>

            <div className="privacy-gate-scroll">
              <PrivacyPolicyContent />
            </div>

            <label className="privacy-checkbox privacy-gate-check">
              <input
                type="checkbox"
                checked={privacyAgreementChecked}
                onChange={(e) => setPrivacyAgreementChecked(e.target.checked)}
              />
              <span>Li e aceito a Política de Privacidade da Tulipa IA.</span>
            </label>

            <div className="privacy-gate-actions">
              <button
                className="privacy-logout"
                onClick={() => signOut(auth)}
                disabled={privacyAccepting}
              >
                Sair da conta
              </button>
              <button
                className="primary"
                onClick={acceptPrivacyPolicy}
                disabled={!privacyAgreementChecked || privacyAccepting}
              >
                {privacyAccepting ? "Registrando..." : "Aceitar e continuar"}
              </button>
            </div>
          </section>
        </div>

        {toast && (
          <div className={`app-toast ${toast.kind}`}>
            {toast.message}
          </div>
        )}
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
                  <div className="admin-user-presence">
                    <span className={item.online ? "presence-dot online" : "presence-dot"} />
                    <strong>{item.online ? "Online agora" : "Offline"}</strong>
                    <small>
                      {item.lastSeenAt
                        ? `Último acesso: ${new Date(item.lastSeenAt).toLocaleString("pt-BR")}`
                        : "Último acesso indisponível"}
                    </small>
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

          <section className="admin-panel-card">
            <div className="admin-card-title">
              <div>
                <h2>Feedbacks recebidos</h2>
                <p>Sugestões, elogios e problemas enviados pelos usuários.</p>
              </div>
              <span className="feedback-count">
                {adminData.feedbacks?.length || 0} recebidos
              </span>
            </div>

            <div className="admin-feedback-list">
              {(adminData.feedbacks || []).length === 0 ? (
                <div className="admin-empty-feedback">
                  Nenhum feedback recebido ainda.
                </div>
              ) : (
                adminData.feedbacks.map((feedback) => (
                  <article
                    className={`admin-feedback-card status-${feedback.status || "novo"}`}
                    key={feedback.id}
                  >
                    <div className="admin-feedback-top">
                      <div>
                        <div className="admin-feedback-badges">
                          <span className="feedback-type">{feedback.type || "Feedback"}</span>
                          <span className={`feedback-status ${feedback.status || "novo"}`}>
                            {feedback.status === "lido"
                              ? "Lido"
                              : feedback.status === "arquivado"
                                ? "Arquivado"
                                : "Novo"}
                          </span>
                        </div>
                        <strong>{feedback.displayName || "Usuário"}</strong>
                        <span>{feedback.email || "Sem e-mail"}</span>
                      </div>
                      <time>
                        {feedback.createdAt
                          ? new Date(feedback.createdAt).toLocaleString("pt-BR")
                          : ""}
                      </time>
                    </div>

                    <p className="admin-feedback-message">{feedback.message}</p>

                    <div className="admin-feedback-actions">
                      {feedback.status !== "lido" && (
                        <button
                          onClick={async () => {
                            try {
                              await callAdmin("updateFeedbackStatus", {
                                feedbackId: feedback.id,
                                status: "lido",
                              });
                              await refreshAdmin();
                            } catch (error: any) {
                              alert(error?.message || "Não foi possível marcar como lido.");
                            }
                          }}
                        >
                          Marcar como lido
                        </button>
                      )}

                      {feedback.status !== "arquivado" && (
                        <button
                          onClick={async () => {
                            try {
                              await callAdmin("updateFeedbackStatus", {
                                feedbackId: feedback.id,
                                status: "arquivado",
                              });
                              await refreshAdmin();
                            } catch (error: any) {
                              alert(error?.message || "Não foi possível arquivar.");
                            }
                          }}
                        >
                          Arquivar
                        </button>
                      )}

                      <button
                        className="feedback-delete"
                        onClick={async () => {
                          const confirmed = window.confirm(
                            "Excluir este feedback? Esta ação não pode ser desfeita."
                          );
                          if (!confirmed) return;

                          try {
                            await callAdmin("deleteFeedback", {
                              feedbackId: feedback.id,
                            });
                            await refreshAdmin();
                          } catch (error: any) {
                            alert(error?.message || "Não foi possível excluir o feedback.");
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))
              )}
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

              <section className="settings-section">
                <h3>Política de Privacidade</h3>
                <p>
                  Consulte a política aceita pela sua conta e as informações sobre tratamento de dados.
                </p>
                <button
                  className="settings-secondary-button"
                  onClick={() => setPrivacyViewOpen(true)}
                >
                  Ler Política de Privacidade
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
            </div>
          </section>
        </div>
      )}

      {privacyViewOpen && (
        <div className="privacy-backdrop" onClick={() => setPrivacyViewOpen(false)}>
          <section className="privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-modal-header">
              <div>
                <strong>Política de Privacidade</strong>
                <span>Versão {PRIVACY_POLICY_VERSION}</span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setPrivacyViewOpen(false)}
                aria-label="Fechar política"
              >
                <X size={18} />
              </button>
            </div>
            <div className="privacy-modal-scroll">
              <PrivacyPolicyContent />
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className={`app-toast ${toast.kind}`} role="status">
          {toast.message}
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
                <div className="bubble">
                  {message.attachment && (
                    <div className="message-attachment">
                      {message.attachment.kind === "pdf" ? <FileText size={16} /> : <ImageIcon size={16} />}
                      <span>{message.attachment.name}</span>
                    </div>
                  )}
                  {message.text && <span>{message.text}</span>}
                </div>
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
          {attachment && (
            <div className="attachment-preview">
              <div className="attachment-preview-icon">
                {attachment.kind === "pdf" ? <FileText size={19} /> : <ImageIcon size={19} />}
              </div>
              <div className="attachment-preview-info">
                <strong>{attachment.name}</strong>
                <span>{attachment.kind === "pdf" ? "PDF" : "Imagem"} · pronto para enviar</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Remover anexo"
                title="Remover anexo"
              >
                <X size={17} />
              </button>
            </div>
          )}
          <div className="composer">
            <input
              ref={fileInputRef}
              className="attachment-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleAttachment}
            />
            <button
              className="attach-button"
              onClick={chooseAttachment}
              disabled={sending}
              type="button"
              aria-label="Anexar PDF ou imagem"
              title="Anexar PDF ou imagem"
            >
              <Paperclip size={18} />
            </button>
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
              disabled={sending || remaining <= 0 || (!input.trim() && !attachment)}
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
