import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/server";
import { searchClientData } from "@/lib/rgpd";
import {
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  HOW_FOUND_FBR_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_LABELS,
  FRAME_BACKGROUND_LABELS,
  FRAME_SIZE_LABELS,
} from "@/types/database";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import { PrintButton } from "./print-button";

type Search = Promise<{ q?: string }>;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = formatDate(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mi}`;
}

function euros(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
}

export default async function RgpdPrintPage({ searchParams }: { searchParams: Search }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect("/");
  }

  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const result = query
    ? await searchClientData(query)
    : { query: "", orders: [], vouchers: [] };

  return (
    <main className="rgpd-print">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body { background: white; }
            .rgpd-print { font-family: 'Google Sans', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #3D2B1F; }
            .rgpd-print h1 { font-family: 'TanMemories', serif; font-size: 28px; margin: 0; }
            .rgpd-print h2 { font-size: 16px; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #E8E0D5; padding-bottom: 4px; }
            .rgpd-print h3 { font-size: 14px; margin-top: 20px; margin-bottom: 6px; }
            .rgpd-print dl { display: grid; grid-template-columns: 200px 1fr; gap: 4px 12px; font-size: 12px; margin: 0; }
            .rgpd-print dt { color: #8B7355; font-weight: 500; }
            .rgpd-print dd { margin: 0; }
            .rgpd-print .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #3D2B1F; padding-bottom: 12px; margin-bottom: 16px; }
            .rgpd-print .meta { font-size: 11px; color: #8B7355; text-align: right; }
            .rgpd-print .legal { background: #FAF8F5; border: 1px solid #E8E0D5; border-radius: 8px; padding: 10px 12px; font-size: 11px; color: #8B7355; margin-bottom: 16px; }
            .rgpd-print .record { border: 1px solid #E8E0D5; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; page-break-inside: avoid; }
            .rgpd-print .record-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; }
            .rgpd-print .empty { color: #8B7355; font-style: italic; font-size: 12px; }
            .rgpd-print .mono { font-family: ui-monospace, SFMono-Regular, monospace; }
            @media print { .no-print { display: none !important; } .rgpd-print { padding: 0; } @page { margin: 1.5cm; } }
          `,
        }}
      />

      <div className="header">
        <h1>Exportação de dados pessoais (RGPD)</h1>
        <div className="meta">
          Gerado em {formatDateTime(new Date().toISOString())}
          <br />
          Flores à Beira Rio · info@floresabeirario.pt
        </div>
      </div>

      <div className="no-print" style={{ marginBottom: 16 }}>
        <PrintButton />
      </div>

      <div className="legal">
        Documento gerado ao abrigo do Art. 15 do RGPD (direito de acesso aos dados pessoais).
        Contém todos os registos associados à pesquisa <strong>{query || "—"}</strong> que existem
        actualmente na plataforma. Encomendas e vales já anonimizados não constam.
      </div>

      <dl>
        <dt>Pesquisa</dt>
        <dd className="mono">{query || "—"}</dd>
        <dt>Encomendas encontradas</dt>
        <dd>{result.orders.length}</dd>
        <dt>Vales-presente encontrados</dt>
        <dd>{result.vouchers.length}</dd>
      </dl>

      <h2>Encomendas de preservação</h2>
      {result.orders.length === 0 ? (
        <div className="empty">Sem encomendas para esta pesquisa.</div>
      ) : (
        result.orders.map((order) => <OrderBlock key={order.id} order={order} />)
      )}

      <h2>Vales-presente</h2>
      {result.vouchers.length === 0 ? (
        <div className="empty">Sem vales-presente para esta pesquisa.</div>
      ) : (
        result.vouchers.map((voucher) => <VoucherBlock key={voucher.id} voucher={voucher} />)
      )}
    </main>
  );
}

function OrderBlock({ order }: { order: Order }) {
  return (
    <div className="record">
      <div className="record-title">
        {order.client_name} — #{order.order_id}
      </div>
      <dl>
        <dt>Estado actual</dt>
        <dd>{STATUS_LABELS[order.status]}</dd>
        <dt>Criada em</dt>
        <dd>{formatDateTime(order.created_at)}</dd>
        <dt>Email</dt>
        <dd>{order.email ?? "—"}</dd>
        <dt>Telemóvel</dt>
        <dd>{order.phone ?? "—"}</dd>
        <dt>Tipo de evento</dt>
        <dd>{order.event_type ? EVENT_TYPE_LABELS[order.event_type] : "—"}</dd>
        <dt>Nome dos noivos</dt>
        <dd>{order.couple_names ?? "—"}</dd>
        <dt>Data do evento</dt>
        <dd>{formatDate(order.event_date)}</dd>
        <dt>Localização do evento</dt>
        <dd>{order.event_location ?? "—"}</dd>
        <dt>Recolha — morada</dt>
        <dd>{order.pickup_address ?? "—"}</dd>
        <dt>Envio das flores</dt>
        <dd>{order.flower_delivery_method ? FLOWER_DELIVERY_METHOD_LABELS[order.flower_delivery_method] : "—"}</dd>
        <dt>Tipo de flores</dt>
        <dd>{order.flower_type ?? "—"}</dd>
        <dt>Receção do quadro</dt>
        <dd>{order.frame_delivery_method ? FRAME_DELIVERY_METHOD_LABELS[order.frame_delivery_method] : "—"}</dd>
        <dt>Fundo</dt>
        <dd>{order.frame_background ? FRAME_BACKGROUND_LABELS[order.frame_background] : "—"}</dd>
        <dt>Tamanho</dt>
        <dd>{order.frame_size ? FRAME_SIZE_LABELS[order.frame_size] : "—"}</dd>
        <dt>Como conheceu</dt>
        <dd>
          {order.how_found_fbr ? HOW_FOUND_FBR_LABELS[order.how_found_fbr] : "—"}
          {order.how_found_fbr_other ? ` (${order.how_found_fbr_other})` : ""}
        </dd>
        <dt>Código vale-presente</dt>
        <dd>{order.gift_voucher_code ?? "—"}</dd>
        <dt>Notas adicionais</dt>
        <dd>{order.additional_notes ?? "—"}</dd>
        <dt>Orçamento</dt>
        <dd>{euros(order.budget)}</dd>
        <dt>Estado de pagamento</dt>
        <dd>{PAYMENT_STATUS_LABELS[order.payment_status]}</dd>
        <dt>NIF</dt>
        <dd>{order.nif ?? "—"}</dd>
        <dt>Data prevista de entrega</dt>
        <dd>{formatDate(order.estimated_delivery_date)}</dd>
        <dt>Data efectiva de entrega</dt>
        <dd>{formatDate(order.frame_delivery_date)}</dd>
        <dt>Consentimento</dt>
        <dd>
          {order.consent_at
            ? `${formatDateTime(order.consent_at)} (versão ${order.consent_version ?? "—"})`
            : "—"}
        </dd>
      </dl>
    </div>
  );
}

function VoucherBlock({ voucher }: { voucher: Voucher }) {
  return (
    <div className="record">
      <div className="record-title">
        Vale {voucher.code} — {voucher.sender_name} → {voucher.recipient_name}
      </div>
      <dl>
        <dt>Criado em</dt>
        <dd>{formatDateTime(voucher.created_at)}</dd>
        <dt>Valor</dt>
        <dd>{euros(voucher.amount)}</dd>
        <dt>Validade</dt>
        <dd>{formatDate(voucher.expiry_date)}</dd>
        <dt>Remetente — email</dt>
        <dd>{voucher.sender_email ?? "—"}</dd>
        <dt>Remetente — telefone</dt>
        <dd>{voucher.sender_phone ?? "—"}</dd>
        <dt>Destinatário — contacto</dt>
        <dd>{voucher.recipient_contact ?? "—"}</dd>
        <dt>Destinatário — morada</dt>
        <dd>{voucher.recipient_address ?? "—"}</dd>
        <dt>Mensagem</dt>
        <dd>{voucher.message ?? "—"}</dd>
        <dt>Comentários</dt>
        <dd>{voucher.comments ?? "—"}</dd>
        <dt>Como conheceu</dt>
        <dd>
          {voucher.how_found_fbr ? HOW_FOUND_FBR_LABELS[voucher.how_found_fbr] : "—"}
          {voucher.how_found_fbr_other ? ` (${voucher.how_found_fbr_other})` : ""}
        </dd>
        <dt>Pagamento</dt>
        <dd>{voucher.payment_status === "100_pago" ? "100% pago" : "100% por pagar"}</dd>
        <dt>NIF</dt>
        <dd>{voucher.nif ?? "—"}</dd>
        <dt>Consentimento</dt>
        <dd>
          {voucher.consent_at
            ? `${formatDateTime(voucher.consent_at)} (versão ${voucher.consent_version ?? "—"})`
            : "—"}
        </dd>
      </dl>
    </div>
  );
}
