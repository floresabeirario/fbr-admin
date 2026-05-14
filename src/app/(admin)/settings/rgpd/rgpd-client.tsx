"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Search,
  Download,
  FileText,
  Clock,
  AlertTriangle,
  EyeOff,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import HardDeleteDialog from "@/components/hard-delete-dialog";
import type { Order } from "@/types/database";
import type { ClientSearchResult, RetentionStatus } from "@/lib/rgpd";
import {
  anonymizeOrderAction,
  anonymizeVoucherAction,
  hardDeleteOrderForRgpdAction,
} from "./actions";

type RetentionRow = {
  order: Order;
  reference: string;
  deadline: string;
  status: RetentionStatus;
};

type Tab = "exportar" | "retencao";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function euros(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
}

export function RgpdClient({
  query,
  searchResult,
  retentionRows,
}: {
  query: string;
  searchResult: ClientSearchResult;
  retentionRows: RetentionRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(query ? "exportar" : "retencao");
  const [searchInput, setSearchInput] = useState(query);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    router.push(q ? `/settings/rgpd?q=${encodeURIComponent(q)}` : "/settings/rgpd");
    setTab("exportar");
  }

  const hasResults = searchResult.orders.length > 0 || searchResult.vouchers.length > 0;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="font-['TanMemories'] text-3xl text-[#3D2B1F] dark:text-[#E8D5B5] flex items-center gap-2">
          <Shield className="h-7 w-7 text-emerald-600" />
          RGPD
        </h1>
        <p className="text-sm text-[#8B7355] mt-1">
          Exportação de dados pessoais (Art. 15 RGPD) e retenção fiscal de 10 anos.
        </p>
      </div>

      <div className="flex gap-1 border-b border-[#E8E0D5]">
        <TabButton active={tab === "exportar"} onClick={() => setTab("exportar")}>
          <Download className="h-4 w-4 mr-1.5" />
          Exportar dados de um cliente
        </TabButton>
        <TabButton active={tab === "retencao"} onClick={() => setTab("retencao")}>
          <Clock className="h-4 w-4 mr-1.5" />
          Retenção 10 anos
          {retentionRows.length > 0 && (
            <Badge className="ml-2 bg-amber-100 text-amber-800 border-amber-200">
              {retentionRows.length}
            </Badge>
          )}
        </TabButton>
      </div>

      {tab === "exportar" && (
        <ExportSection
          query={query}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onSearch={onSearch}
          searchResult={searchResult}
          hasResults={hasResults}
        />
      )}

      {tab === "retencao" && <RetentionSection rows={retentionRows} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-emerald-600 text-emerald-700"
          : "border-transparent text-[#8B7355] hover:text-[#3D2B1F]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Export Section ────────────────────────────────────────────

function ExportSection({
  query,
  searchInput,
  setSearchInput,
  onSearch,
  searchResult,
  hasResults,
}: {
  query: string;
  searchInput: string;
  setSearchInput: (v: string) => void;
  onSearch: (e: React.FormEvent) => void;
  searchResult: ClientSearchResult;
  hasResults: boolean;
}) {
  const exportUrlJson = query ? `/api/rgpd/export/json?q=${encodeURIComponent(query)}` : null;
  const exportUrlHtml = query ? `/rgpd-print?q=${encodeURIComponent(query)}` : null;
  const exportUrlPdf = query ? `/rgpd-print?q=${encodeURIComponent(query)}&autoprint=1` : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pesquisar por email ou telemóvel do cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B8A99A]" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="cliente@exemplo.com ou 912345678"
              className="pl-9"
            />
          </div>
          <Button type="submit">Pesquisar</Button>
        </form>

        {!query && (
          <p className="text-sm text-[#8B7355]">
            Introduz o email ou telemóvel do cliente e clica em Pesquisar para ver todos os dados
            que temos sobre ele (encomendas + vales-presente).
          </p>
        )}

        {query && !hasResults && (
          <div className="rounded-lg border border-dashed border-[#E8E0D5] bg-[#FAF8F5] px-4 py-6 text-center text-sm text-[#8B7355]">
            Nenhuma encomenda ou vale encontrado para <span className="font-mono">{searchResult.query}</span>.
          </div>
        )}

        {hasResults && (
          <>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Encontrado:{" "}
              <strong>{searchResult.orders.length}</strong> encomenda(s) e{" "}
              <strong>{searchResult.vouchers.length}</strong> vale(s)-presente para{" "}
              <span className="font-mono">{searchResult.query}</span>.
            </div>

            <div className="flex flex-wrap gap-2">
              {exportUrlPdf && (
                <a href={exportUrlPdf} target="_blank" rel="noopener noreferrer">
                  <Button>
                    <Download className="h-4 w-4 mr-1.5" />
                    Descarregar PDF
                  </Button>
                </a>
              )}
              {exportUrlJson && (
                <a href={exportUrlJson} download>
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-1.5" />
                    Exportar JSON
                  </Button>
                </a>
              )}
              {exportUrlHtml && (
                <a href={exportUrlHtml} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Abrir para visualizar
                  </Button>
                </a>
              )}
            </div>
            <p className="text-xs text-[#8B7355]">
              💡 &quot;Descarregar PDF&quot; abre o diálogo de impressão automaticamente — escolhe
              &quot;Guardar como PDF&quot; como destino.
            </p>

            {searchResult.orders.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#3D2B1F] mb-2">Encomendas</h3>
                <ul className="space-y-2">
                  {searchResult.orders.map((o) => (
                    <ResultRow
                      key={o.id}
                      title={o.client_name}
                      subtitle={`${o.order_id} · ${o.email ?? "—"} · ${o.phone ?? "—"}`}
                      meta={`Criada em ${formatDate(o.created_at)} · ${o.status}`}
                      href={`/preservacao/${o.order_id}`}
                    />
                  ))}
                </ul>
              </div>
            )}

            {searchResult.vouchers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#3D2B1F] mb-2">Vales-presente</h3>
                <ul className="space-y-2">
                  {searchResult.vouchers.map((v) => (
                    <ResultRow
                      key={v.id}
                      title={`${v.sender_name} → ${v.recipient_name}`}
                      subtitle={`${v.code} · ${euros(v.amount)} · ${v.sender_email ?? v.sender_phone ?? "—"}`}
                      meta={`Criado em ${formatDate(v.created_at)} · ${v.payment_status}`}
                      href={`/vale-presente/${v.code}`}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ResultRow({
  title,
  subtitle,
  meta,
  href,
}: {
  title: string;
  subtitle: string;
  meta: string;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-lg border border-[#E8E0D5] bg-white px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
      >
        <div className="font-medium text-sm text-[#3D2B1F]">{title}</div>
        <div className="text-xs text-[#8B7355] font-mono">{subtitle}</div>
        <div className="text-[11px] text-[#B8A99A] mt-0.5">{meta}</div>
      </Link>
    </li>
  );
}

// ── Retention Section ─────────────────────────────────────────

function RetentionSection({ rows }: { rows: RetentionRow[] }) {
  const expired = rows.filter((r) => r.status === "expired");
  const dueSoon = rows.filter((r) => r.status === "due_soon");

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Política de retenção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[#8B7355] space-y-2">
          <p>
            Por obrigação fiscal portuguesa, as encomendas concluídas são guardadas durante{" "}
            <strong>10 anos</strong> a partir da data de entrega do quadro. Após esse prazo, o RGPD
            obriga a apagar ou anonimizar os dados pessoais.
          </p>
          <p>
            <strong className="text-[#3D2B1F]">Anonimizar</strong> (recomendado): mantém a linha
            para métricas e relatórios fiscais agregados, mas apaga nome, email, telefone, morada,
            NIF e notas. A operação é definitiva.
          </p>
          <p>
            <strong className="text-[#3D2B1F]">Apagar definitivamente</strong>: remove a linha por
            completo. Usar apenas em pedidos explícitos do titular dos dados (Art. 17 RGPD).
          </p>
        </CardContent>
      </Card>

      {expired.length === 0 && dueSoon.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#E8E0D5] bg-[#FAF8F5] px-4 py-8 text-center text-sm text-[#8B7355]">
          Não há encomendas concluídas a aproximarem-se do prazo de retenção.
        </div>
      ) : (
        <>
          {expired.length > 0 && (
            <RetentionGroup
              title="Prazo já expirado — anonimizar agora"
              tone="red"
              rows={expired}
            />
          )}
          {dueSoon.length > 0 && (
            <RetentionGroup
              title={`A expirar nos próximos meses (${dueSoon.length})`}
              tone="amber"
              rows={dueSoon}
            />
          )}
        </>
      )}
    </div>
  );
}

function RetentionGroup({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "red" | "amber";
  rows: RetentionRow[];
}) {
  const toneClasses =
    tone === "red"
      ? "border-rose-200 bg-rose-50/40"
      : "border-amber-200 bg-amber-50/40";
  const iconClasses = tone === "red" ? "text-rose-600" : "text-amber-600";
  return (
    <Card className={toneClasses}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${iconClasses}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <RetentionRowItem key={r.order.id} row={r} />
        ))}
      </CardContent>
    </Card>
  );
}

function RetentionRowItem({ row }: { row: RetentionRow }) {
  const [pending, startTransition] = useTransition();
  const [confirmAnon, setConfirmAnon] = useState(false);
  const [hardDelete, setHardDelete] = useState(false);

  function onAnonymize() {
    startTransition(async () => {
      try {
        await anonymizeOrderAction(row.order.id);
        toast.success("Encomenda anonimizada.");
        setConfirmAnon(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao anonimizar.");
      }
    });
  }

  async function onHardDelete(justification: string) {
    await hardDeleteOrderForRgpdAction(row.order.id, justification);
    toast.success("Encomenda apagada definitivamente.");
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-[#E8E0D5] bg-white px-3 py-2">
        <div className="flex-1 min-w-0">
          <Link
            href={`/preservacao/${row.order.order_id}`}
            className="block font-medium text-sm text-[#3D2B1F] hover:underline truncate"
          >
            {row.order.client_name} · {row.order.order_id}
          </Link>
          <div className="text-xs text-[#8B7355]">
            Entregue em {formatDate(row.reference)} · prazo {formatDate(row.deadline)}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmAnon(true)}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5 mr-1.5" />}
          Anonimizar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHardDelete(true)}
          className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Apagar
        </Button>
      </div>

      <Dialog open={confirmAnon} onOpenChange={setConfirmAnon}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anonimizar encomenda?</DialogTitle>
            <DialogDescription>
              Vais apagar todos os dados pessoais (nome, email, telefone, NIF, notas, anexos) da
              encomenda <strong>{row.order.client_name} · {row.order.order_id}</strong>. A linha
              fica para métricas agregadas. Esta acção é definitiva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAnon(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={onAnonymize} disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Anonimizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HardDeleteDialog
        open={hardDelete}
        onOpenChange={setHardDelete}
        itemLabel={`encomenda ${row.order.client_name} · ${row.order.order_id}`}
        onConfirm={onHardDelete}
      />
    </>
  );
}

export function VoucherAnonymizeButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function onAnonymize() {
    startTransition(async () => {
      try {
        await anonymizeVoucherAction(id);
        toast.success("Vale anonimizado.");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao anonimizar.");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <EyeOff className="h-3.5 w-3.5 mr-1.5" />
        Anonimizar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anonimizar {label}?</DialogTitle>
            <DialogDescription>
              Apaga todos os dados pessoais. A linha fica para métricas. Acção definitiva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={onAnonymize} disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Anonimizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
