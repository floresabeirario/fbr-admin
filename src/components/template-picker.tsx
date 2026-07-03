"use client";

import { useMemo, useState } from "react";
import {
  MessageSquareText,
  Copy,
  Check,
  Star,
  Pencil,
  X,
  Languages,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  MessageTemplate,
  SystemSettingKey,
  SystemSettingsMap,
  TemplateLanguage,
} from "@/types/message-template";
import {
  TEMPLATE_LANGUAGE_LABELS,
  SYSTEM_SETTING_KEYS,
} from "@/types/message-template";
import {
  rankTemplatesForStatus,
  rankTemplatesForLead,
  renderOrderTemplate,
  renderVoucherTemplate,
  renderLeadTemplate,
  templateSnippet,
  type VoucherForTemplate,
} from "@/lib/templates";
import type { Order } from "@/types/database";

const SETTING_DEFAULTS: SystemSettingsMap = {
  payment_account_holder: "",
  payment_iban: "",
  payment_bic: "",
  payment_bank_name: "",
  payment_mbway: "",
  studio_address_url: "",
  studio_address_text: "",
  review_link: "",
  claude_persona: "",
  claude_facts: "",
};

type PickerProps =
  | {
      scope: "order";
      order: Order;
      preferredLanguage?: TemplateLanguage;
      voucher?: never;
      contactName?: never;
    }
  | {
      scope: "voucher";
      voucher: VoucherForTemplate;
      preferredLanguage?: TemplateLanguage;
      order?: never;
      contactName?: never;
    }
  | {
      // Lead: conversa de WhatsApp sem encomenda ligada. Só resolve as
      // variáveis genéricas (saudação, nome, morada, pagamento).
      scope: "lead";
      contactName?: string | null;
      preferredLanguage?: TemplateLanguage;
      order?: never;
      voucher?: never;
    };

/**
 * Botão "Inserir template" para o workbench. Abre um dropdown com:
 *   1. Templates sugeridos para o estado actual (destacados ★)
 *   2. Restantes templates ordenados por categoria
 *
 * Ao escolher, abre um dialog com o texto renderizado (variáveis
 * preenchidas) e botões: Copiar / Editar antes de copiar / Fechar.
 */
export default function TemplatePicker(props: PickerProps) {
  const { scope, preferredLanguage } = props;
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);
  const [settings, setSettings] = useState<SystemSettingsMap>(SETTING_DEFAULTS);
  const [chosen, setChosen] = useState<MessageTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Carrega templates + system_settings da BD. Chamado pelo handler do
  // popover (não num useEffect) para evitar set-state-in-effect.
  // [[feedback_react_set_state_in_effect]]
  function loadTemplates() {
    if (templates !== null) return;
    setLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase
        .from("message_templates")
        .select("*")
        .is("deleted_at", null)
        .order("category", { ascending: true })
        .order("position", { ascending: true }),
      supabase.from("system_settings").select("key, value"),
    ])
      .then(([tplRes, setRes]) => {
        if (tplRes.error) {
          toast.error("Não foi possível carregar os templates.");
          setTemplates([]);
          return;
        }
        setTemplates((tplRes.data ?? []) as MessageTemplate[]);
        const map: SystemSettingsMap = { ...SETTING_DEFAULTS };
        for (const row of (setRes.data ?? []) as { key: string; value: string }[]) {
          if (SYSTEM_SETTING_KEYS.includes(row.key as SystemSettingKey)) {
            map[row.key as SystemSettingKey] = row.value;
          }
        }
        setSettings(map);
      })
      .finally(() => setLoading(false));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) loadTemplates();
    else setSearch("");
  }

  const ranked = useMemo(() => {
    if (!templates) return { suggested: [], others: [] };
    if (scope === "lead") {
      return rankTemplatesForLead(templates, preferredLanguage);
    }
    const currentStatus = scope === "order" ? props.order.status : null;
    return rankTemplatesForStatus(templates, {
      scope,
      currentStatus,
      preferredLanguage,
      // Sugestões por campos: "não sei" no envio/tamanho, funeral, etc.
      orderFields: scope === "order" ? props.order : undefined,
    });
  }, [templates, scope, preferredLanguage, props]);

  // Pesquisa: filtra por nome e conteúdo, mantendo a separação
  // sugeridos / restantes.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ranked;
    const matches = (t: MessageTemplate) =>
      t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);
    return {
      suggested: ranked.suggested.filter(matches),
      others: ranked.others.filter(matches),
    };
  }, [ranked, search]);

  function pick(t: MessageTemplate) {
    setOpen(false);
    setChosen(t);
  }

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-cream-200 bg-surface text-xs font-medium text-cocoa-700 hover:bg-cream-50 hover:text-cocoa-900 transition-colors"
          title="Inserir template de mensagem"
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          <span>Inserir template</span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[420px] max-w-[calc(100vw-2rem)] p-0"
        >
          <div className="p-2 border-b border-cream-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome ou conteúdo…"
                className="w-full h-8 pl-8 pr-2 rounded-md border border-cream-200 bg-surface text-xs text-cocoa-900 placeholder:text-cocoa-500 focus:outline-none focus:ring-1 focus:ring-cocoa-300"
              />
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <div className="p-4 text-xs text-cocoa-500 text-center">A carregar…</div>
            )}

            {!loading && visible.suggested.length > 0 && (
              <div className="p-2 border-b border-cream-200">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-amber-700 font-semibold flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {scope === "lead" ? "Típicos de primeiro contacto" : "Sugeridos para esta fase"}
                </div>
                {visible.suggested.map((t) => (
                  <TemplateItem key={t.id} template={t} onPick={pick} highlighted />
                ))}
              </div>
            )}

            {!loading && visible.others.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-cocoa-500 font-semibold">
                  Todos os templates
                </div>
                {visible.others.map((t) => (
                  <TemplateItem key={t.id} template={t} onPick={pick} />
                ))}
              </div>
            )}

            {!loading &&
              templates &&
              templates.length > 0 &&
              visible.suggested.length === 0 &&
              visible.others.length === 0 && (
                <div className="p-4 text-xs text-cocoa-500 text-center">
                  Nenhum template corresponde à pesquisa.
                </div>
              )}

            {!loading && templates && templates.length === 0 && (
              <div className="p-4 text-xs text-cocoa-500 text-center">
                Ainda não há templates. Vai a Sistema → Templates para criar.
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {chosen && (
        <TemplatePreviewDialog
          template={chosen}
          onClose={() => setChosen(null)}
          renderedBody={renderTemplate(chosen, props, settings)}
        />
      )}
    </>
  );
}

// Renderização: route consoante o scope do template e do contexto.
function renderTemplate(
  template: MessageTemplate,
  ctx: PickerProps,
  settings: SystemSettingsMap,
): string {
  if (ctx.scope === "order") {
    return renderOrderTemplate(template, { order: ctx.order, settings });
  }
  if (ctx.scope === "lead") {
    return renderLeadTemplate(template, { contactName: ctx.contactName, settings });
  }
  return renderVoucherTemplate(template, { voucher: ctx.voucher, settings });
}

function TemplateItem({
  template,
  onPick,
  highlighted = false,
}: {
  template: MessageTemplate;
  onPick: (t: MessageTemplate) => void;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(template)}
      className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
        highlighted
          ? "hover:bg-amber-50 hover:text-amber-900"
          : "hover:bg-cream-100 hover:text-cocoa-900"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-cocoa-900 truncate font-medium">{template.name}</span>
        <Badge variant="outline" className="text-[9px] shrink-0">
          <Languages className="h-2.5 w-2.5 mr-0.5" />
          {TEMPLATE_LANGUAGE_LABELS[template.language]}
        </Badge>
      </div>
      <p className="text-[10px] text-cocoa-500 mt-0.5 line-clamp-2">
        {templateSnippet(template.body)}
      </p>
    </button>
  );
}

function TemplatePreviewDialog({
  template,
  renderedBody,
  onClose,
}: {
  template: MessageTemplate;
  renderedBody: string;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(renderedBody);
  const [copied, setCopied] = useState(false);

  const finalText = editing ? edited : renderedBody;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(finalText);
      setCopied(true);
      toast.success("Mensagem copiada. Cola onde precisares 💐");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar. Selecciona o texto e copia manualmente.");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 min-w-0 pr-8">
            <MessageSquareText className="h-5 w-5 text-cocoa-700 shrink-0 mt-0.5" />
            <span className="min-w-0 break-words">{template.name}</span>
            <Badge variant="outline" className="text-[10px] ml-1 shrink-0">
              {TEMPLATE_LANGUAGE_LABELS[template.language]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 min-w-0">
          {editing ? (
            <Textarea
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
              rows={18}
              className="text-sm leading-relaxed"
              autoFocus
            />
          ) : (
            <div className="rounded-lg border border-cream-200 bg-cream-50 p-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-cocoa-900 font-sans">
              {renderedBody}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (editing) {
                  setEditing(false);
                } else {
                  setEdited(renderedBody);
                  setEditing(true);
                }
              }}
              className="text-xs w-full sm:w-auto"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              {editing ? "Cancelar edição" : "Editar antes de copiar"}
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs flex-1 sm:flex-none">
                <X className="h-3.5 w-3.5 mr-1.5" />
                Fechar
              </Button>
              <Button size="sm" onClick={handleCopy} className="text-xs flex-1 sm:flex-none">
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
