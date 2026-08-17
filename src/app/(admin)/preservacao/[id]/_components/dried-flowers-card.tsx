"use client";

// Secção exclusiva das encomendas "Emoldurar Flores Secas" (mig 094).
// Só aparece quando order.service_type === 'emoldurar_secas'. Tem um tom
// verde bem marcado para se distinguir do resto do workbench (que é de
// preservação) — é a cor do serviço em toda a plataforma (selo na lista,
// tag no cabeçalho, aba do filtro) e a do form de secas no site. Mostra a
// abordagem e o estado que o cliente indicou + as fotos do ramo submetidas
// no form (signed URLs geradas no server).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flower2, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Card, Field } from "./layout";
import { clearOrderClientPhotosAction } from "../../actions";
import {
  DRIED_APPROACH_LABELS,
  DRIED_CONDITION_LABELS,
  type Order,
} from "@/types/database";

export type ClientPhotoUrl = { name: string; path: string; url: string };

export function DriedFlowersCard({
  local,
  canEdit,
  photoUrls = [],
}: {
  local: Order;
  canEdit: boolean;
  photoUrls?: ClientPhotoUrl[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (local.service_type !== "emoldurar_secas") return null;

  const approach = local.dried_approach ? DRIED_APPROACH_LABELS[local.dried_approach] : null;
  const condition = local.dried_condition ? DRIED_CONDITION_LABELS[local.dried_condition] : null;
  const movedToDrive = photoUrls.length === 0 && Boolean(local.drive_folder_url);

  function removePhotos() {
    startTransition(async () => {
      await clearOrderClientPhotosAction(local.id);
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <Card
      title="Emoldurar flores secas"
      icon={<Flower2 className="h-3.5 w-3.5" />}
      accent="emerald"
      className="order-1 lg:order-none ring-1 ring-emerald-200 dark:ring-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Abordagem que prefere" span2>
          <p className="text-sm text-cocoa-900">{approach ?? <span className="text-cocoa-400 italic">Não indicado</span>}</p>
        </Field>
        <Field label="Estado atual das flores" span2>
          <p className="text-sm text-cocoa-900">{condition ?? <span className="text-cocoa-400 italic">Não indicado</span>}</p>
        </Field>
      </div>

      {/* Fotos do ramo submetidas pelo cliente */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-cocoa-600 mb-1.5">
          Fotos das flores (do cliente)
        </p>

        {photoUrls.length > 0 ? (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photoUrls.map((p) => (
                <a
                  key={p.path}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-square overflow-hidden rounded-lg border border-emerald-200 bg-cream-50"
                  title={p.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </a>
              ))}
            </div>
            {canEdit && (
              <div className="mt-2">
                {confirming ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-cocoa-600">Apagar as fotos do Storage?</span>
                    <button
                      type="button"
                      onClick={removePhotos}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Apagar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      disabled={pending}
                      className="rounded-md px-2 py-1 text-cocoa-600 hover:bg-cream-100"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="inline-flex items-center gap-1 text-xs text-cocoa-500 hover:text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" /> Remover fotos
                  </button>
                )}
              </div>
            )}
          </>
        ) : movedToDrive ? (
          <a
            href={local.drive_folder_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Fotos movidas para a pasta do Drive
          </a>
        ) : (
          <p className="text-xs text-cocoa-400 italic">Sem fotos submetidas.</p>
        )}
      </div>
    </Card>
  );
}
