"use client";

import { useMemo, useState, useTransition } from "react";
import {
  MessageSquareText,
  Pencil,
  Copy,
  Archive,
  Plus,
  CreditCard,
  MapPin,
  RotateCcw,
  Save,
  X,
  Search,
  Languages,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SistemaTopbar from "@/components/sistema-topbar";
import { STATUS_LABELS, type OrderStatus } from "@/types/database";
import type {
  MessageTemplate,
  MessageTemplateInsert,
  SystemSettingKey,
  SystemSettingsMap,
  TemplateCategory,
  TemplateLanguage,
  TemplateScope,
} from "@/types/message-template";
import {
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_CATEGORY_ORDER,
  TEMPLATE_LANGUAGE_LABELS,
  TEMPLATE_SCOPE_LABELS,
  SYSTEM_SETTING_LABELS,
} from "@/types/message-template";
import { AVAILABLE_VARIABLES } from "@/lib/templates";
import {
  archiveTemplateAction,
  createTemplateAction,
  duplicateTemplateAction,
  restoreTemplateAction,
  updateSystemSettingAction,
  updateTemplateAction,
} from "./actions";

const STATUS_KEYS = Object.keys(STATUS_LABELS) as OrderStatus[];

type TabKey = "templates" | "config";

export default function TemplatesClient({
  initialTemplates,
  initialSettings,
}: {
  initialTemplates: MessageTemplate[];
  initialSettings: SystemSettingsMap;
}) {
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates);
  const [settings, setSettings] = useState<SystemSettingsMap>(initialSettings);
  const [tab, setTab] = useState<TabKey>("templates");

  // Filtros
  const [search, setSearch] = useState("");
  const [filterLang, setFilterLang] = useState<TemplateLanguage | "all">("all");
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | "all">("all");
  const [showArchived, setShowArchived] = useState(false);

  // Dialogo de edição
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates
      .filter((t) => (showArchived ? t.deleted_at !== null : t.deleted_at === null))
      .filter((t) => (filterLang === "all" ? true : t.language === filterLang))
      .filter((t) => (filterCategory === "all" ? true : t.category === filterCategory))
      .filter((t) =>
        q
          ? t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
          : true,
      );
  }, [templates, search, filterLang, filterCategory, showArchived]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<TemplateCategory, MessageTemplate[]>();
    for (const t of filtered) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return map;
  }, [filtered]);

  // Estado optimista: actualiza-se localmente antes do server refresh.
  function patchLocal(id: string, patch: Partial<MessageTemplate>) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  }

  return (
    <>
      <SistemaTopbar />

      <div className="max-w-[1200px] mx-auto p-3 sm:p-6 space-y-5">
        <div>
          <h1 className="font-['TanMemories'] text-3xl text-cocoa-900">
            Templates de mensagens
          </h1>
          <p className="text-sm text-cocoa-700 mt-1">
            Biblioteca de mensagens prontas a usar nas conversas com clientes (WhatsApp/Email).
            Cada template tem variáveis (<code className="text-[11px] font-mono">{`{nome}`}</code>,{" "}
            <code className="text-[11px] font-mono">{`{valor_sinal}`}</code>,{" "}
            <code className="text-[11px] font-mono">{`{dados_pagamento}`}</code>…) que são
            preenchidas automaticamente com os dados da encomenda.
          </p>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-lg border border-cream-200 bg-surface p-1 text-xs">
          <button
            onClick={() => setTab("templates")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              tab === "templates"
                ? "bg-cocoa-900 text-surface"
                : "text-cocoa-700 hover:bg-cream-100"
            }`}
          >
            <MessageSquareText className="inline-block h-3.5 w-3.5 mr-1.5" />
            Templates ({templates.filter((t) => t.deleted_at === null).length})
          </button>
          <button
            onClick={() => setTab("config")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              tab === "config"
                ? "bg-cocoa-900 text-surface"
                : "text-cocoa-700 hover:bg-cream-100"
            }`}
          >
            <CreditCard className="inline-block h-3.5 w-3.5 mr-1.5" />
            Dados de pagamento e morada
          </button>
        </div>

        {tab === "templates" && (
          <>
            {/* Barra de filtros */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
                <Input
                  className="h-9 pl-8 text-xs"
                  placeholder="Pesquisar por nome ou conteúdo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={filterLang} onValueChange={(v) => setFilterLang(v as TemplateLanguage | "all")}>
                <SelectTrigger className="h-9 w-[140px] text-xs">
                  <Languages className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os idiomas</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as TemplateCategory | "all")}>
                <SelectTrigger className="h-9 w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {TEMPLATE_CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      {TEMPLATE_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="inline-flex items-center gap-2 text-xs text-cocoa-700">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="rounded border-cream-300"
                />
                Arquivados
              </label>

              <div className="flex-1" />
              <Button
                onClick={() => setCreating(true)}
                size="sm"
                className="text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Novo template
              </Button>
            </div>

            {/* Lista por categoria */}
            <div className="space-y-5">
              {TEMPLATE_CATEGORY_ORDER.filter((c) => groupedByCategory.has(c)).map((category) => (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      {TEMPLATE_CATEGORY_LABELS[category]}{" "}
                      <span className="text-cocoa-500 font-normal">
                        ({groupedByCategory.get(category)?.length})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {groupedByCategory.get(category)?.map((t) => (
                      <TemplateRow
                        key={t.id}
                        template={t}
                        onEdit={() => setEditing(t)}
                        onDuplicate={async () => {
                          try {
                            await duplicateTemplateAction(t.id);
                            toast.success("Template duplicado.");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erro ao duplicar.");
                          }
                        }}
                        onArchive={async () => {
                          try {
                            await archiveTemplateAction(t.id);
                            patchLocal(t.id, { deleted_at: new Date().toISOString() });
                            toast.success("Template arquivado.");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erro ao arquivar.");
                          }
                        }}
                        onRestore={async () => {
                          try {
                            await restoreTemplateAction(t.id);
                            patchLocal(t.id, { deleted_at: null });
                            toast.success("Template restaurado.");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erro ao restaurar.");
                          }
                        }}
                      />
                    ))}
                  </CardContent>
                </Card>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-12 text-sm text-cocoa-500">
                  Nenhum template encontrado.
                </div>
              )}
            </div>
          </>
        )}

        {tab === "config" && (
          <SystemSettingsTab
            settings={settings}
            onUpdate={(key, value) => setSettings((prev) => ({ ...prev, [key]: value }))}
          />
        )}
      </div>

      {/* Dialog de edição */}
      {(editing || creating) && (
        <TemplateEditorDialog
          template={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={(updated) => {
            if (updated) {
              if (editing) {
                setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
              } else {
                setTemplates((prev) => [...prev, updated]);
              }
            }
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

// ─── Linha individual ───────────────────────────────────────

function TemplateRow({
  template,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
}: {
  template: MessageTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const isArchived = template.deleted_at !== null;
  const preview = template.body.slice(0, 140).replace(/\n+/g, " ");

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      isArchived
        ? "bg-cream-50/50 border-cream-200 opacity-60"
        : "bg-surface border-cream-200 hover:border-cream-300 transition-colors"
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-cocoa-900">{template.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {TEMPLATE_LANGUAGE_LABELS[template.language]}
          </Badge>
          {template.scope !== "order" && (
            <Badge variant="outline" className="text-[10px]">
              {TEMPLATE_SCOPE_LABELS[template.scope]}
            </Badge>
          )}
          {template.is_seed && (
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Pré-populado
            </Badge>
          )}
          {template.suggested_statuses.length > 0 && (
            <span
              className="text-[10px] text-cocoa-500"
              title={template.suggested_statuses
                .map((s) => STATUS_LABELS[s as OrderStatus] ?? s)
                .join(", ")}
            >
              ★ {template.suggested_statuses.length} estado{template.suggested_statuses.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-cocoa-500 mt-1 line-clamp-2">{preview}…</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!isArchived ? (
          <>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-md text-cocoa-600 hover:bg-cream-100 hover:text-cocoa-900 transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDuplicate}
              className="p-1.5 rounded-md text-cocoa-600 hover:bg-cream-100 hover:text-cocoa-900 transition-colors"
              title="Duplicar"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onArchive}
              className="p-1.5 rounded-md text-cocoa-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Arquivar"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={onRestore}
            className="p-1.5 rounded-md text-cocoa-600 hover:bg-cream-100 hover:text-cocoa-900 transition-colors"
            title="Restaurar"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Dialogo de edição ──────────────────────────────────────

function TemplateEditorDialog({
  template,
  onClose,
  onSaved,
}: {
  template: MessageTemplate | null; // null = criar
  onClose: () => void;
  onSaved: (saved: MessageTemplate | null) => void;
}) {
  const isCreating = template === null;
  const [name, setName] = useState(template?.name ?? "");
  const [slug, setSlug] = useState(template?.slug ?? "");
  const [language, setLanguage] = useState<TemplateLanguage>(template?.language ?? "pt");
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? "pre_reserva");
  const [scope, setScope] = useState<TemplateScope>(template?.scope ?? "order");
  const [body, setBody] = useState(template?.body ?? "");
  const [suggestedStatuses, setSuggestedStatuses] = useState<OrderStatus[]>(
    (template?.suggested_statuses ?? []) as OrderStatus[],
  );
  const [pending, startTransition] = useTransition();

  // Auto-gera slug ao escrever o nome (só para novos templates).
  function onNameChange(v: string) {
    setName(v);
    if (isCreating) {
      const auto = v
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60);
      setSlug(auto);
    }
  }

  function toggleStatus(s: OrderStatus) {
    setSuggestedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function insertVariable(varKey: string) {
    setBody((prev) => prev + `{${varKey}}`);
  }

  function handleSave() {
    if (!name.trim() || !body.trim()) {
      toast.error("Nome e corpo são obrigatórios.");
      return;
    }
    if (isCreating && !slug.trim()) {
      toast.error("Slug é obrigatório.");
      return;
    }
    startTransition(async () => {
      try {
        if (isCreating) {
          const input: MessageTemplateInsert = {
            slug: slug.trim(),
            name: name.trim(),
            language,
            category,
            scope,
            body,
            suggested_statuses: suggestedStatuses,
            position: 0,
          };
          await createTemplateAction(input);
          toast.success("Template criado.");
        } else {
          await updateTemplateAction(template!.id, {
            name: name.trim(),
            language,
            category,
            scope,
            body,
            suggested_statuses: suggestedStatuses,
          });
          toast.success("Template guardado.");
        }
        // Server actions revalidam, mas o page só vai refetch ao recarregar.
        // Devolvemos `null` para forçar a Maria a refrescar a página se quiser ver a versão fresca da BD.
        // Para feedback imediato, actualiza o estado local:
        if (template) {
          onSaved({
            ...template,
            name: name.trim(),
            language,
            category,
            scope,
            body,
            suggested_statuses: suggestedStatuses,
          });
        } else {
          onSaved(null);
          onClose();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao guardar template.");
      }
    });
  }

  const variablesForScope = AVAILABLE_VARIABLES.filter(
    (v) => v.scope === "both" || v.scope === (scope === "voucher" ? "voucher" : "order"),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-cocoa-700" />
            {isCreating ? "Novo template" : "Editar template"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="ex: Pré-reserva — tamanho escolhido"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Slug (identificador único){" "}
                {!isCreating && <span className="text-cocoa-500">(não editável)</span>}
              </Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="ex: pre_reserva_tamanho_escolhido_pt"
                className="font-mono text-xs"
                disabled={!isCreating}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Idioma</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as TemplateLanguage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>{TEMPLATE_CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aplica-se a</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as TemplateScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">Só Preservação</SelectItem>
                  <SelectItem value="voucher">Só Vale-Presente</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estados sugeridos */}
          {(scope === "order" || scope === "both") && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Estados sugeridos{" "}
                <span className="text-cocoa-500">
                  (este template aparece destacado no workbench quando a encomenda está num destes estados)
                </span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_KEYS.map((s) => {
                  const active = suggestedStatuses.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                        active
                          ? "bg-cocoa-900 text-surface border-cocoa-900"
                          : "bg-surface text-cocoa-700 border-cream-300 hover:bg-cream-50"
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Corpo + variáveis disponíveis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 space-y-1.5">
              <Label className="text-xs">Corpo da mensagem</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={18}
                className="font-mono text-xs leading-relaxed"
                placeholder="Olá {nome}…"
              />
              <p className="text-[10px] text-cocoa-500">
                Usa variáveis como <code>{`{nome}`}</code>, <code>{`{valor_sinal}`}</code>,{" "}
                <code>{`{dados_pagamento}`}</code>. Clica nas variáveis ao lado para inserir.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Variáveis disponíveis</Label>
              <div className="border border-cream-200 rounded-lg bg-cream-50 p-2 max-h-[420px] overflow-y-auto space-y-1">
                {variablesForScope.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="w-full text-left p-1.5 rounded text-[11px] hover:bg-surface transition-colors"
                    title={v.description}
                  >
                    <code className="font-mono text-cocoa-900">{`{${v.key}}`}</code>
                    <div className="text-[10px] text-cocoa-500 mt-0.5 line-clamp-2">
                      {v.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: dados de pagamento + morada ───────────────────────

function SystemSettingsTab({
  settings,
  onUpdate,
}: {
  settings: SystemSettingsMap;
  onUpdate: (key: SystemSettingKey, value: string) => void;
}) {
  const [drafts, setDrafts] = useState<SystemSettingsMap>(settings);
  const [saving, setSaving] = useState<SystemSettingKey | null>(null);

  async function save(key: SystemSettingKey) {
    setSaving(key);
    try {
      await updateSystemSettingAction(key, drafts[key]);
      onUpdate(key, drafts[key]);
      toast.success("Guardado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setSaving(null);
    }
  }

  function changed(key: SystemSettingKey): boolean {
    return drafts[key] !== settings[key];
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-cocoa-700" />
            Dados de pagamento
          </CardTitle>
          <p className="text-xs text-cocoa-500 mt-1">
            Estes valores são usados pela variável{" "}
            <code className="font-mono">{`{dados_pagamento}`}</code> nos templates.
            Mensagens PT incluem MB Way + IBAN. Mensagens EN incluem Titular + IBAN + BIC + Banco
            (MB Way não funciona internacionalmente).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(["payment_mbway", "payment_iban", "payment_account_holder", "payment_bic", "payment_bank_name"] as SystemSettingKey[]).map(
            (key) => (
              <SettingRow
                key={key}
                label={SYSTEM_SETTING_LABELS[key]}
                value={drafts[key]}
                onChange={(v) => setDrafts((prev) => ({ ...prev, [key]: v }))}
                onSave={() => save(key)}
                isChanged={changed(key)}
                isSaving={saving === key}
                placeholder={
                  key === "payment_mbway" ? "ex: 935 896 353" :
                  key === "payment_iban" ? "ex: PT50 0023 0000 4576 9749 3439 4" :
                  key === "payment_bic" ? "ex: CGDIPTPL" :
                  key === "payment_bank_name" ? "ex: Caixa Geral de Depósitos" :
                  "Nome completo do titular"
                }
              />
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-cocoa-700" />
            Morada do estúdio
          </CardTitle>
          <p className="text-xs text-cocoa-500 mt-1">
            Usada pela variável <code className="font-mono">{`{morada_estudio}`}</code> nos
            templates de confirmação de reserva.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow
            label={SYSTEM_SETTING_LABELS.studio_address_url}
            value={drafts.studio_address_url}
            onChange={(v) => setDrafts((prev) => ({ ...prev, studio_address_url: v }))}
            onSave={() => save("studio_address_url")}
            isChanged={changed("studio_address_url")}
            isSaving={saving === "studio_address_url"}
            placeholder="https://goo.gl/maps/..."
          />
          <SettingRow
            label={SYSTEM_SETTING_LABELS.studio_address_text}
            value={drafts.studio_address_text}
            onChange={(v) => setDrafts((prev) => ({ ...prev, studio_address_text: v }))}
            onSave={() => save("studio_address_text")}
            isChanged={changed("studio_address_text")}
            isSaving={saving === "studio_address_text"}
            placeholder="ex: Estúdio FBR — Coimbra"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  label,
  value,
  onChange,
  onSave,
  isChanged,
  isSaving,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  isChanged: boolean;
  isSaving: boolean;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 items-center">
      <Label className="text-xs text-cocoa-700">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-xs"
      />
      <Button
        size="sm"
        onClick={onSave}
        disabled={!isChanged || isSaving}
        className="text-xs"
      >
        {isSaving ? "A guardar…" : "Guardar"}
      </Button>
    </div>
  );
}

