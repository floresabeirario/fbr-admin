"use client";

// Cartão "Comunicações" da coluna esquerda: contactos do cliente (com popover
// de edição), picker de templates e tabs Email/WhatsApp.
// Extraído do workbench-client.tsx (refactor sessão 128).

import { useState } from "react";
import { Mail, MessageCircle, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import TemplatePicker from "@/components/template-picker";
import { Flag } from "@/components/ui/flag";
import type { Order, FormLanguage } from "@/types/database";
import { FORM_LANGUAGE_LABELS } from "@/types/database";
import { formatPhone, phoneToWaMe } from "@/lib/format-phone";
import WhatsappLivePanel from "./wa-live-panel";
import GmailPanel from "./gmail-panel";
import { Card, inp } from "./layout";
import type { UpdateFn, ClientUpdateFn } from "./shared";

export function CommsCard({
  local,
  canEdit,
  update,
  clientUpdate,
}: {
  local: Order;
  canEdit: boolean;
  update: UpdateFn;
  clientUpdate: ClientUpdateFn;
}) {
  // Edição do contacto do cliente (popover na coluna de comunicações)
  // Os clientes às vezes dão um número errado e corrigem por mensagem.
  const [contactDraftPhone, setContactDraftPhone] = useState("");
  const [contactDraftEmail, setContactDraftEmail] = useState("");
  const [contactDraftPreference, setContactDraftPreference] = useState<"whatsapp" | "email" | "">("");
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);

  return (
    <Card
      title="Comunicações"
      icon={<MessageCircle className="h-3.5 w-3.5" />}
      accent="blue"
      className="order-4 lg:order-none"
      action={
        <button
          type="button"
          onClick={() => {
            const next: FormLanguage = local.form_language === "pt" ? "en" : "pt";
            clientUpdate(
              "form_language",
              next,
              "Idioma do formulário",
              (v) => v ? FORM_LANGUAGE_LABELS[v as FormLanguage] : "—",
            );
          }}
          className="inline-flex items-center rounded-md p-0.5 hover:bg-cream-100 transition-colors"
          title={`Idioma do formulário: ${FORM_LANGUAGE_LABELS[local.form_language]}. Clica para trocar.`}
        >
          <Flag lang={local.form_language} className="h-4 w-6" />
        </button>
      }
    >
      {/* Contactos do cliente — discreto, sem caixa pesada */}
      <div className="space-y-1.5">
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0 space-y-1.5">
            {local.email ? (
              <a
                href={`mailto:${local.email}`}
                className={`flex items-center gap-1.5 text-[12px] hover:text-cocoa-900 transition-colors ${
                  local.contact_preference === "email"
                    ? "text-blue-700 font-medium"
                    : "text-cocoa-700"
                }`}
                title={local.contact_preference === "email" ? "Contacto preferido" : "Email"}
              >
                <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate">{local.email}</span>
                {local.contact_preference === "email" && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-blue-600 shrink-0">★</span>
                )}
              </a>
            ) : (
              <div className="flex items-center gap-1.5 text-[12px] text-cocoa-500 italic">
                <Mail className="h-3.5 w-3.5 text-blue-500/60 shrink-0" />
                <span>Sem email</span>
              </div>
            )}
            {local.phone ? (
              <a
                href={`https://wa.me/${phoneToWaMe(local.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-[12px] hover:text-cocoa-900 transition-colors ${
                  local.contact_preference === "whatsapp"
                    ? "text-green-700 font-medium"
                    : "text-cocoa-700"
                }`}
                title={local.contact_preference === "whatsapp" ? "Contacto preferido" : "WhatsApp"}
              >
                <MessageCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <span className="truncate font-mono">{formatPhone(local.phone)}</span>
                {local.contact_preference === "whatsapp" && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-green-600 shrink-0">★</span>
                )}
              </a>
            ) : (
              <div className="flex items-center gap-1.5 text-[12px] text-cocoa-500 italic">
                <MessageCircle className="h-3.5 w-3.5 text-green-500/60 shrink-0" />
                <span>Sem telemóvel</span>
              </div>
            )}
          </div>
          {canEdit && (
            <Popover
              open={contactPopoverOpen}
              onOpenChange={(v) => {
                setContactPopoverOpen(v);
                if (v) {
                  setContactDraftPhone(local.phone ?? "");
                  setContactDraftEmail(local.email ?? "");
                  setContactDraftPreference(local.contact_preference ?? "");
                }
              }}
            >
              <PopoverTrigger
                className="shrink-0 mt-0.5 p-1 rounded-md text-cocoa-500 hover:bg-cream-100 hover:text-cocoa-900 transition-colors"
                title="Editar contactos e preferência"
              >
                <Pencil className="h-3 w-3" />
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 space-y-2.5">
                <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-cocoa-700">
                  Contactos do cliente
                </p>
                <div className="space-y-1">
                  <Label className="text-[11px] text-cocoa-700 flex items-center gap-1.5">
                    <MessageCircle className="h-3 w-3 text-green-500" /> Telemóvel (WhatsApp)
                  </Label>
                  <Input
                    className={inp + " font-mono"}
                    type="tel"
                    value={contactDraftPhone}
                    onChange={(e) => setContactDraftPhone(e.target.value)}
                    placeholder="+351 9XX XXX XXX"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-cocoa-700 flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-blue-500" /> Email
                  </Label>
                  <Input
                    className={inp}
                    type="email"
                    value={contactDraftEmail}
                    onChange={(e) => setContactDraftEmail(e.target.value)}
                    placeholder="nome@exemplo.pt"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-cocoa-700">Contacto preferido</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setContactDraftPreference("whatsapp")}
                      className={`h-8 rounded-lg border text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                        contactDraftPreference === "whatsapp"
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-cream-200 bg-surface text-cocoa-700 hover:bg-cream-50"
                      }`}
                    >
                      <MessageCircle className="h-3 w-3 text-green-500" /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactDraftPreference("email")}
                      className={`h-8 rounded-lg border text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                        contactDraftPreference === "email"
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-cream-200 bg-surface text-cocoa-700 hover:bg-cream-50"
                      }`}
                    >
                      <Mail className="h-3 w-3 text-blue-500" /> Email
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-cocoa-500 leading-relaxed">
                  Se o cliente deu um número errado e corrigiu por mensagem, atualiza aqui.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setContactPopoverOpen(false)}
                    className="h-8 px-3 rounded-lg border border-cream-200 bg-surface text-xs text-cocoa-700 hover:bg-cream-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newPhone = contactDraftPhone.trim() || null;
                      const newEmail = contactDraftEmail.trim() || null;
                      const newPref = contactDraftPreference || null;
                      if (newPhone !== (local.phone ?? null)) update("phone", newPhone);
                      if (newEmail !== (local.email ?? null)) update("email", newEmail);
                      if (newPref !== (local.contact_preference ?? null)) update("contact_preference", newPref);
                      setContactPopoverOpen(false);
                    }}
                    className="h-8 px-3 rounded-lg bg-btn-primary text-btn-primary-fg text-xs font-medium hover:bg-btn-primary-hover transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Picker de templates de mensagens — sugere templates conforme estado da encomenda */}
      <div className="pt-2">
        <TemplatePicker
          scope="order"
          order={local}
          preferredLanguage={local.form_language}
        />
      </div>

      <Tabs defaultValue={local.contact_preference === "whatsapp" ? "whatsapp" : "email"}>
        <TabsList className="bg-cream-50 border border-cream-200 w-full">
          <TabsTrigger value="email" className="flex-1 text-xs data-[state=active]:bg-surface data-[state=active]:text-blue-700">
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex-1 text-xs data-[state=active]:bg-surface data-[state=active]:text-green-700">
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
            WhatsApp
          </TabsTrigger>
        </TabsList>
        <TabsContent value="email" className="mt-3">
          <GmailPanel email={local.email} />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-3">
          <WhatsappLivePanel phone={local.phone} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
