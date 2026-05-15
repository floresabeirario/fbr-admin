import { Globe, ArrowRight, Database, Cloud, Mail, Image as ImageIcon, MessageCircle, Sparkles, ShieldCheck, Calendar, FolderOpen, Server, Lock, Eye, Camera, Users, Truck, Search, Megaphone } from "lucide-react";
import SistemaTopbar from "@/components/sistema-topbar";
import { getCurrentRole } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

// ============================================================
// Aba Ecossistema — visão geral das plataformas e fluxos de dados
// ============================================================
// Esta página é estática (puro JSX) — não vai buscar nada à BD.
// Mostra o "mapa" de tudo o que alimenta e é alimentado pela
// plataforma admin, para a Maria ter referência rápida.
// ============================================================

interface Platform {
  name: string;
  url?: string;
  description: string;
  tone: "primary" | "public" | "external" | "integration";
  icon: React.ComponentType<{ className?: string }>;
}

const TONE_STYLES: Record<Platform["tone"], string> = {
  primary:
    "from-[#3D2B1F] to-[#5C3D26] text-white border-[#3D2B1F] dark:from-[#E8D5B5] dark:to-[#C4A882] dark:text-[#1B1611] dark:border-[#D4C19F]",
  public:
    "from-emerald-50 to-green-100 border-emerald-300 text-emerald-900 dark:from-emerald-950/40 dark:to-emerald-900/30 dark:border-emerald-800 dark:text-emerald-100",
  external:
    "from-sky-50 to-blue-100 border-sky-300 text-sky-900 dark:from-sky-950/40 dark:to-sky-900/30 dark:border-sky-800 dark:text-sky-100",
  integration:
    "from-violet-50 to-purple-100 border-violet-300 text-violet-900 dark:from-violet-950/40 dark:to-violet-900/30 dark:border-violet-800 dark:text-violet-100",
};

const INPUTS_PUBLIC: Platform[] = [
  {
    name: "floresabeirario.pt",
    url: "https://www.floresabeirario.pt/",
    description: "Site oficial. Forms de Reserva e Vale-Presente entram aqui como pré-reservas.",
    tone: "public",
    icon: Globe,
  },
];

// Ferramentas externas usadas no dia-a-dia (sem fluxo automático de dados).
// Agrupadas por área para ser fácil encontrar visualmente.
interface ExternalTool {
  name: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  note?: string;
}

interface ExternalCategory {
  title: string;
  description: string;
  tools: ExternalTool[];
}

const EXTERNAL_CATEGORIES: ExternalCategory[] = [
  {
    title: "Comunicação",
    description: "Onde falamos com clientes e parceiros",
    tools: [
      { name: "Gmail", url: "https://mail.google.com/mail/u/0/?tab=rm&ogbl", icon: Mail, note: "info@floresabeirario.pt" },
      { name: "WhatsApp Web", url: "https://web.whatsapp.com/", icon: MessageCircle },
    ],
  },
  {
    title: "Marketing & redes sociais",
    description: "Presença pública e campanhas pagas",
    tools: [
      { name: "Instagram", url: "https://www.instagram.com/floresabeirario/", icon: Camera },
      { name: "Facebook", url: "https://www.facebook.com/floresabeirario/", icon: Users },
      { name: "Facebook Ads Manager", url: "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=747444631516860&business_id=1899083453715516", icon: Megaphone, note: "Campanhas pagas" },
    ],
  },
  {
    title: "Operações",
    description: "Logística e site público",
    tools: [
      { name: "Portal CTT Empresa", url: "https://appserver.ctt.pt/CompanyPortal/", icon: Truck, note: "Envios e recolhas" },
      { name: "Site FBR (público)", url: "https://www.floresabeirario.pt/", icon: Globe },
    ],
  },
  {
    title: "Infraestrutura web",
    description: "Domínio e SEO",
    tools: [
      { name: "Domínio (Site.pt)", url: "https://clientes.site.pt/index.php?rp=/login", icon: Server, note: "Gestão de DNS e domínio" },
      { name: "Google Search Console", url: "https://search.google.com/search-console?resource_id=sc-domain%3Afloresabeirario.pt", icon: Search, note: "SEO e indexação" },
    ],
  },
];

const ADMIN_CORE: Platform = {
  name: "admin.floresabeirario.pt",
  description: "Esta plataforma. Painel da Maria, António, MJ, Ana. Substituiu o Monday.",
  tone: "primary",
  icon: Database,
};

const OUTPUTS_PUBLIC: Platform[] = [
  {
    name: "status.floresabeirario.pt",
    url: "https://status.floresabeirario.pt",
    description: "Página pública de acompanhamento por encomenda. Alimentada por orders (campo público filtrado).",
    tone: "public",
    icon: Eye,
  },
  {
    name: "voucher.floresabeirario.pt",
    url: "https://voucher.floresabeirario.pt",
    description: "Vale digital — destinatário vê código, mensagem e valor. Alimentado por vouchers pagos.",
    tone: "public",
    icon: ImageIcon,
  },
];

const INTEGRATIONS: Array<Platform & { status: "active" | "pending"; statusNote: string }> = [
  {
    name: "Supabase",
    description: "BD + Auth + RLS. Toda a persistência.",
    tone: "integration",
    icon: Server,
    status: "active",
    statusNote: "Ligado",
  },
  {
    name: "Vercel",
    description: "Hosting + deploys automáticos.",
    tone: "integration",
    icon: Cloud,
    status: "active",
    statusNote: "Ligado",
  },
  {
    name: "Google Drive",
    description: "Pasta automática por cliente ao 1º pagamento (8 subpastas).",
    tone: "integration",
    icon: FolderOpen,
    status: "active",
    statusNote: "Ligado",
  },
  {
    name: "Google Calendar",
    description: "Evento criado no calendário 'Preservação de Flores' ao 1º pagamento.",
    tone: "integration",
    icon: Calendar,
    status: "active",
    statusNote: "Ligado",
  },
  {
    name: "Gmail",
    description: "Histórico de emails por encomenda no workbench.",
    tone: "integration",
    icon: Mail,
    status: "pending",
    statusNote: "Por integrar no workbench",
  },
  {
    name: "WhatsApp",
    description: "Conversas com clientes registadas no workbench (screenshot ou texto colado).",
    tone: "integration",
    icon: MessageCircle,
    status: "pending",
    statusNote: "Registo manual — WhatsApp não tem API pública",
  },
  {
    name: "Anthropic Claude",
    description: "Assistente de resposta no workbench (sugestões em PT/EN).",
    tone: "integration",
    icon: Sparkles,
    status: "pending",
    statusNote: "Por integrar",
  },
  {
    name: "Cloudflare Turnstile",
    description: "Anti-spam nos forms públicos do site.",
    tone: "integration",
    icon: ShieldCheck,
    status: "pending",
    statusNote: "Por configurar",
  },
];

export default async function EcossistemaPage() {
  const role = await getCurrentRole();
  return (
    <>
    <SistemaTopbar isAdmin={role === "admin"} />
    <div className="p-3 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 shadow-sm flex items-center justify-center">
          <Globe className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-cocoa-900">
            Ecossistema
          </h1>
          <p className="text-sm text-cocoa-700">
            Mapa das plataformas e integrações que alimentam ou são alimentadas pelo admin
          </p>
        </div>
      </div>

      {/* Fluxo: input público → admin → output público */}
      <div className="rounded-3xl border border-cream-200 bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cocoa-700 mb-4">
          Fluxo principal
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4">
          {/* Inputs */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-cocoa-700 text-center">
              Entrada
            </div>
            {INPUTS_PUBLIC.map((p) => (
              <PlatformCard key={p.name} platform={p} />
            ))}
          </div>

          {/* Seta */}
          <FlowArrow />

          {/* Admin */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-cocoa-700 text-center">
              Núcleo
            </div>
            <PlatformCard platform={ADMIN_CORE} />
          </div>

          {/* Seta */}
          <FlowArrow />

          {/* Outputs */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-cocoa-700 text-center">
              Saída pública
            </div>
            {OUTPUTS_PUBLIC.map((p) => (
              <PlatformCard key={p.name} platform={p} />
            ))}
          </div>
        </div>
      </div>

      {/* Ferramentas externas */}
      <div className="rounded-3xl border border-cream-200 bg-surface p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cocoa-700">
            Ferramentas externas
          </h2>
          <p className="text-xs text-cocoa-500 mt-1">
            Plataformas que usamos no dia-a-dia — clica para abrir
          </p>
        </div>
        <div className="space-y-5">
          {EXTERNAL_CATEGORIES.map((cat) => (
            <ExternalCategoryBlock key={cat.title} category={cat} />
          ))}
        </div>
      </div>

      {/* Integrações */}
      <div className="rounded-3xl border border-cream-200 bg-surface p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cocoa-700">
            Integrações
          </h2>
          <p className="text-xs text-cocoa-500 mt-1">
            Serviços que trocam dados directamente com a plataforma
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {INTEGRATIONS.map((i) => (
            <IntegrationCard key={i.name} integration={i} />
          ))}
        </div>
      </div>

      {/* Nota sobre privacidade */}
      <div className="rounded-2xl border border-cream-200 bg-cream-50 p-4 flex gap-3">
        <Lock className="h-5 w-5 text-cocoa-700 shrink-0 mt-0.5" />
        <p className="text-sm text-cocoa-700 leading-relaxed">
          Dados sensíveis (PII, NIF, anexos) <strong>nunca</strong> deixam o
          Supabase. As integrações externas só recebem o estritamente necessário
          (datas de eventos para o Calendar, ficheiros que a Maria upload-ar
          para a Drive). Anonimização e direito ao esquecimento em{" "}
          <a className="underline" href="/settings/rgpd">/settings/rgpd</a>.
        </p>
      </div>
    </div>
    </>
  );
}

function PlatformCard({ platform }: { platform: Platform }) {
  const Icon = platform.icon;
  const Wrapper = platform.url ? "a" : "div";
  const wrapperProps = platform.url
    ? { href: platform.url, target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <Wrapper
      {...wrapperProps}
      className={`block rounded-2xl border bg-gradient-to-br p-4 transition-shadow ${platform.url ? "hover:shadow-md cursor-pointer" : ""} ${TONE_STYLES[platform.tone]}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-5 w-5 shrink-0" />
        <div className="text-sm font-semibold truncate">{platform.name}</div>
      </div>
      <p className="text-xs leading-relaxed opacity-90">{platform.description}</p>
    </Wrapper>
  );
}

function FlowArrow() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center text-cocoa-500">
      <ArrowRight className="h-8 w-8" />
    </div>
  );
}

function ExternalCategoryBlock({ category }: { category: ExternalCategory }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-cocoa-900">
          {category.title}
        </h3>
        <p className="text-[11px] text-cocoa-500 truncate">{category.description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {category.tools.map((tool) => (
          <ExternalToolCard key={tool.name} tool={tool} />
        ))}
      </div>
    </div>
  );
}

function ExternalToolCard({ tool }: { tool: ExternalTool }) {
  const Icon = tool.icon;
  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-cream-200 bg-cream-50 dark:bg-[#241D17] px-3 py-2.5 hover:border-cocoa-400 hover:shadow-sm transition-all"
    >
      <div className="h-8 w-8 rounded-lg bg-white dark:bg-[#1B1611] border border-cream-200 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-cocoa-700" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-cocoa-900 truncate group-hover:underline">
          {tool.name}
        </div>
        {tool.note && (
          <div className="text-[11px] text-cocoa-500 truncate">{tool.note}</div>
        )}
      </div>
    </a>
  );
}

function IntegrationCard({
  integration,
}: {
  integration: Platform & { status: "active" | "pending"; statusNote: string };
}) {
  const Icon = integration.icon;
  return (
    <div className="rounded-2xl border border-cream-200 p-4 space-y-2 bg-surface">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold text-cocoa-900">
            {integration.name}
          </span>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 font-bold ${
            integration.status === "active"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {integration.status === "active" ? "Activo" : "Pendente"}
        </span>
      </div>
      <p className="text-xs text-cocoa-700 leading-relaxed">
        {integration.description}
      </p>
      <p className="text-[11px] italic text-cocoa-500 dark:text-[#6E6E6E]">
        {integration.statusNote}
      </p>
    </div>
  );
}
