"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  MessageCircle,
  Send,
  Inbox,
  Upload,
  Trash2,
  Pencil,
  X,
  Save,
  ImageIcon,
  AlertTriangle,
  Image as ImageLucide,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { WhatsAppEntry, WhatsAppDirection } from "@/types/whatsapp";
import {
  addWhatsAppEntryAction,
  clearWhatsAppLogAction,
  deleteWhatsAppEntryAction,
  importWhatsAppExportAction,
  updateWhatsAppEntryAction,
} from "@/app/(admin)/preservacao/whatsapp-actions";

function uuidLite(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function WhatsAppLog({
  orderId,
  initialEntries,
  canEdit,
}: {
  orderId: string;
  initialEntries: WhatsAppEntry[];
  canEdit: boolean;
}) {
  const [entries, setEntries] = useState<WhatsAppEntry[]>(initialEntries);
  const [importOpen, setImportOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    [entries],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sorted.length]);

  return (
    <div className="space-y-3">
      {/* Header com acções */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-cocoa-500">
          {sorted.length === 0
            ? "Sem mensagens registadas"
            : `${sorted.length} mensagem${sorted.length === 1 ? "" : "s"}`}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-cream-200 bg-surface text-[11px] text-cocoa-700 hover:bg-cream-50"
              title="Importar conversa exportada do WhatsApp"
            >
              <Upload className="h-3 w-3" />
              Importar
            </button>
            {sorted.length > 0 && (
              <button
                type="button"
                onClick={() => setClearOpen(true)}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-red-200 bg-surface text-[11px] text-red-700 hover:bg-red-50"
                title="Apagar todas as mensagens (irreversível)"
              >
                <Trash2 className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista de mensagens */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-cream-200 bg-cream-50 p-4 text-center text-[12px] text-cocoa-500">
          Sem registos. Adiciona manualmente abaixo, ou importa uma conversa exportada do
          WhatsApp Web (menu da conversa → Mais → Exportar conversa → Sem multimédia).
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[420px] overflow-y-auto rounded-lg border border-cream-200 bg-cream-50 p-3 space-y-2">
          {sorted.map((entry, idx) => {
            const prev = idx > 0 ? sorted[idx - 1] : null;
            const showDate =
              !prev || dayKey(entry.timestamp) !== dayKey(prev.timestamp);
            return (
              <div key={entry.id}>
                {showDate && (
                  <div className="flex justify-center my-2">
                    <span className="text-[10px] uppercase tracking-wider text-cocoa-500 bg-surface px-2 py-0.5 rounded-full border border-cream-200">
                      {format(parseISO(entry.timestamp), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}
                    </span>
                  </div>
                )}
                <Bubble
                  entry={entry}
                  canEdit={canEdit}
                  onEdit={() => setEditing(entry)}
                  onDelete={async () => {
                    if (!confirm("Apagar esta mensagem?")) return;
                    try {
                      const next = await deleteWhatsAppEntryAction(orderId, entry.id);
                      setEntries(next);
                      toast.success("Mensagem apagada.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erro ao apagar.");
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      {canEdit && (
        <Composer
          orderId={orderId}
          onAdded={(next) => setEntries(next)}
        />
      )}

      {/* Dialog importar */}
      {importOpen && (
        <ImportDialog
          orderId={orderId}
          onClose={() => setImportOpen(false)}
          onImported={(next) => {
            setEntries(next);
            setImportOpen(false);
          }}
        />
      )}

      {/* Dialog editar */}
      {editing && (
        <EditDialog
          orderId={orderId}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setEntries(next);
            setEditing(null);
          }}
        />
      )}

      {/* Confirmar limpar */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar tudo?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais apagar <strong>{sorted.length}</strong> mensagem{sorted.length === 1 ? "" : "s"} desta encomenda.
              Esta acção não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await clearWhatsAppLogAction(orderId);
                  setEntries([]);
                  toast.success("Registo limpo.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro ao limpar.");
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // yyyy-MM-dd
}

// ─── Bubble ─────────────────────────────────────────────────

function Bubble({
  entry,
  canEdit,
  onEdit,
  onDelete,
}: {
  entry: WhatsAppEntry;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isSent = entry.direction === "sent";
  return (
    <div className={`group flex ${isSent ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed shadow-sm ${
          isSent
            ? "bg-green-100 text-cocoa-900 rounded-tr-sm"
            : "bg-surface text-cocoa-900 rounded-tl-sm border border-cream-200"
        }`}
      >
        {entry.content && (
          <div className="whitespace-pre-wrap break-words">{entry.content}</div>
        )}
        {entry.screenshot_urls && entry.screenshot_urls.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {entry.screenshot_urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-blue-700 hover:underline"
              >
                <ImageIcon className="h-3 w-3" />
                Anexo {i + 1}
              </a>
            ))}
          </div>
        )}
        <div className="text-[10px] text-cocoa-500 mt-1 flex items-center gap-1.5 justify-end">
          {format(parseISO(entry.timestamp), "HH:mm")}
        </div>

        {canEdit && (
          <div
            className={`absolute top-1 ${isSent ? "left-1" : "right-1"} flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity`}
          >
            <button
              type="button"
              onClick={onEdit}
              className="p-0.5 rounded text-cocoa-500 hover:bg-cream-100 hover:text-cocoa-900"
              title="Editar"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-0.5 rounded text-cocoa-500 hover:bg-red-100 hover:text-red-700"
              title="Apagar"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composer ───────────────────────────────────────────────

function Composer({
  orderId,
  onAdded,
}: {
  orderId: string;
  onAdded: (next: WhatsAppEntry[]) => void;
}) {
  const [content, setContent] = useState("");
  const [direction, setDirection] = useState<WhatsAppDirection>("sent");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setContent("");
    setScreenshotUrl("");
    setShowScreenshot(false);
  }

  function handleSubmit() {
    const trimmed = content.trim();
    const url = screenshotUrl.trim();
    if (!trimmed && !url) {
      toast.error("Escreve uma mensagem ou cola um link de screenshot.");
      return;
    }
    startTransition(async () => {
      try {
        const entry: WhatsAppEntry = {
          id: uuidLite(),
          timestamp: new Date().toISOString(),
          direction,
          content: trimmed,
          screenshot_urls: url ? [url] : undefined,
        };
        const next = await addWhatsAppEntryAction(orderId, entry);
        onAdded(next);
        reset();
        toast.success("Mensagem registada.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao registar.");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setDirection("sent")}
          className={`px-2 py-0.5 rounded ${
            direction === "sent"
              ? "bg-green-100 text-green-800 font-medium"
              : "text-cocoa-500 hover:text-cocoa-700"
          }`}
        >
          <Send className="inline-block h-3 w-3 mr-1" />
          Enviámos
        </button>
        <button
          type="button"
          onClick={() => setDirection("received")}
          className={`px-2 py-0.5 rounded ${
            direction === "received"
              ? "bg-blue-100 text-blue-800 font-medium"
              : "text-cocoa-500 hover:text-cocoa-700"
          }`}
        >
          <Inbox className="inline-block h-3 w-3 mr-1" />
          Recebemos
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setShowScreenshot((v) => !v)}
          className="px-2 py-0.5 rounded text-cocoa-500 hover:text-cocoa-700"
          title="Adicionar link de screenshot (Drive)"
        >
          <ImageLucide className="inline-block h-3 w-3 mr-1" />
          Screenshot
        </button>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          direction === "sent"
            ? "Mensagem que enviámos…"
            : "Mensagem que recebemos…"
        }
        rows={2}
        className="text-sm resize-none"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />

      {showScreenshot && (
        <Input
          value={screenshotUrl}
          onChange={(e) => setScreenshotUrl(e.target.value)}
          placeholder="Cola o link Drive do screenshot"
          className="text-xs font-mono"
        />
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} size="sm" disabled={pending} className="text-xs">
          {pending ? "A registar…" : "Adicionar"}
        </Button>
      </div>
    </div>
  );
}

// ─── Import dialog ──────────────────────────────────────────

function ImportDialog({
  orderId,
  onClose,
  onImported,
}: {
  orderId: string;
  onClose: () => void;
  onImported: (next: WhatsAppEntry[]) => void;
}) {
  const [rawText, setRawText] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [ourName, setOurName] = useState("Flores à Beira Rio");
  const [pending, startTransition] = useTransition();

  function handleImport() {
    if (!rawText.trim()) {
      toast.error("Cola o texto exportado do WhatsApp.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await importWhatsAppExportAction(orderId, rawText, mode, ourName);
        onImported(result.entries);
        const extras: string[] = [];
        if (result.systemFiltered > 0) extras.push(`${result.systemFiltered} de sistema ignorada${result.systemFiltered === 1 ? "" : "s"}`);
        if (result.unparsedLines > 0) extras.push(`${result.unparsedLines} linha${result.unparsedLines === 1 ? "" : "s"} não reconhecida${result.unparsedLines === 1 ? "" : "s"}`);
        toast.success(
          `Importadas ${result.imported} mensagens${extras.length ? ` (${extras.join(", ")})` : ""}.`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao importar.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-cocoa-700" />
            Importar conversa exportada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-[12px] text-blue-900 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <strong>Como exportar:</strong> WhatsApp Web → abrir conversa → menu ⋮ →{" "}
              <em>Mais</em> → <em>Exportar conversa</em> → <em>Sem multimédia</em>. Recebes um{" "}
              <code>.txt</code> — abre-o, copia tudo e cola aqui.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Modo</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("append")}
                  className={`flex-1 h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    mode === "append"
                      ? "bg-cocoa-900 text-surface border-cocoa-900"
                      : "bg-surface text-cocoa-700 border-cream-200 hover:bg-cream-50"
                  }`}
                >
                  Acrescentar
                </button>
                <button
                  type="button"
                  onClick={() => setMode("replace")}
                  className={`flex-1 h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    mode === "replace"
                      ? "bg-red-600 text-surface border-red-600"
                      : "bg-surface text-cocoa-700 border-cream-200 hover:bg-cream-50"
                  }`}
                >
                  Substituir
                </button>
              </div>
              <p className="text-[10px] text-cocoa-500">
                <em>Acrescentar</em> mantém o que já existe. <em>Substituir</em> apaga tudo e recomeça.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nosso nome no WhatsApp</Label>
              <Input
                value={ourName}
                onChange={(e) => setOurName(e.target.value)}
                placeholder="Flores à Beira Rio"
                className="text-xs"
              />
              <p className="text-[10px] text-cocoa-500">
                Usado para distinguir o que enviámos do que recebemos.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Texto da conversa (.txt)</Label>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={14}
              className="font-mono text-[11px] leading-relaxed"
              placeholder="27/04/26, 11:31 - As mensagens e as chamadas são encriptadas..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={pending}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {pending ? "A importar…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit dialog ────────────────────────────────────────────

function EditDialog({
  orderId,
  entry,
  onClose,
  onSaved,
}: {
  orderId: string;
  entry: WhatsAppEntry;
  onClose: () => void;
  onSaved: (next: WhatsAppEntry[]) => void;
}) {
  const [content, setContent] = useState(entry.content);
  const [direction, setDirection] = useState<WhatsAppDirection>(entry.direction);
  const [timestamp, setTimestamp] = useState(
    format(parseISO(entry.timestamp), "yyyy-MM-dd'T'HH:mm"),
  );
  const [screenshotUrl, setScreenshotUrl] = useState(
    entry.screenshot_urls?.[0] ?? "",
  );
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        const trimmedUrl = screenshotUrl.trim();
        const next = await updateWhatsAppEntryAction(orderId, entry.id, {
          content: content.trim(),
          direction,
          timestamp: new Date(timestamp).toISOString(),
          screenshot_urls: trimmedUrl ? [trimmedUrl] : undefined,
        });
        onSaved(next);
        toast.success("Mensagem actualizada.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao guardar.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-cocoa-700" />
            Editar mensagem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Direcção</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("sent")}
                  className={`flex-1 h-9 px-3 rounded-lg border text-xs transition-colors ${
                    direction === "sent"
                      ? "bg-green-100 text-green-800 border-green-300"
                      : "bg-surface text-cocoa-700 border-cream-200 hover:bg-cream-50"
                  }`}
                >
                  Enviámos
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("received")}
                  className={`flex-1 h-9 px-3 rounded-lg border text-xs transition-colors ${
                    direction === "received"
                      ? "bg-blue-100 text-blue-800 border-blue-300"
                      : "bg-surface text-cocoa-700 border-cream-200 hover:bg-cream-50"
                  }`}
                >
                  Recebemos
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data e hora</Label>
              <Input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Conteúdo</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Link de screenshot (Drive)</Label>
            <Input
              value={screenshotUrl}
              onChange={(e) => setScreenshotUrl(e.target.value)}
              className="text-xs font-mono"
              placeholder="https://drive.google.com/..."
            />
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
