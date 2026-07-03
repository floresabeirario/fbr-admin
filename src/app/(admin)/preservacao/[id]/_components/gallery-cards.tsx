"use client";

// Cartões "Inventário das flores" e "Galeria de inspiração" da coluna
// esquerda. Extraídos do workbench-client.tsx (refactor sessão 128).

import { useState } from "react";
import { Flower2, Heart, Plus, Link2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Order, InspirationItem } from "@/types/database";
import { toEmbeddableImageUrl } from "@/lib/drive-url";
import { Card, PlaceholderBox, inp } from "./layout";
import { InventorySection, safeHostname } from "./fields";
import type { UpdateFn } from "./shared";

/* Inventário das flores — secção dedicada na coluna esquerda
   (anteriormente vivia dentro do card "Flores, quadro e extras") */
export function InventoryCard({ local, update }: { local: Order; update: UpdateFn }) {
  return (
    <Card
      title="Inventário das flores"
      icon={<Flower2 className="h-3.5 w-3.5" />}
      accent="green"
      className="order-9 lg:order-none"
      badge={
        (local.inventory?.length ?? 0) > 0 ? (
          <span className="text-[10px] text-green-700 font-semibold bg-green-100 px-1.5 py-0.5 rounded-full">
            {local.inventory!.length}
          </span>
        ) : undefined
      }
    >
      <InventorySection
        items={local.inventory ?? []}
        onChange={(items) => update("inventory", items)}
      />
    </Card>
  );
}

/* Galeria de inspiração — coluna esquerda */
export function GalleryCard({ local, update }: { local: Order; update: UpdateFn }) {
  const gallery: InspirationItem[] = local.inspiration_gallery ?? [];
  const [newInspirationUrl, setNewInspirationUrl] = useState("");

  function addInspiration() {
    const url = newInspirationUrl.trim();
    if (!url) return;
    const isImage = /\.(png|jpe?g|gif|webp|avif)$/i.test(url) || /(?:drive|docs)\.google\.com/.test(url);
    const item: InspirationItem = { type: isImage ? "image" : "link", url };
    update("inspiration_gallery", [...gallery, item]);
    setNewInspirationUrl("");
  }

  function removeInspiration(idx: number) {
    update("inspiration_gallery", gallery.filter((_, i) => i !== idx));
  }

  return (
    <Card
      title="Galeria de inspiração"
      icon={<Heart className="h-3.5 w-3.5" />}
      accent="pink"
      className="order-10 lg:order-none"
      badge={gallery.length > 0 ? <span className="text-[10px] text-pink-700 font-semibold bg-pink-100 px-1.5 py-0.5 rounded-full">{gallery.length}</span> : undefined}
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            className={inp + " flex-1"}
            placeholder="Cole link ou URL"
            value={newInspirationUrl}
            onChange={(e) => setNewInspirationUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInspiration(); } }}
          />
          <button
            onClick={addInspiration}
            disabled={!newInspirationUrl.trim()}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-pink-600 text-white text-xs font-medium hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {gallery.length === 0 ? (
          <PlaceholderBox
            icon={<Heart className="h-4 w-4" />}
            title="Sem inspirações"
            description="Adicione fotos de bouquets de referência, paletas, ou ideias do cliente."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gallery.map((item, idx) => {
              const embedUrl = toEmbeddableImageUrl(item.url);
              return (
                <div key={idx} className="group relative aspect-square rounded-lg border border-cream-200 bg-cream-50 overflow-hidden">
                  {item.type === "image" && embedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={embedUrl} alt={item.label ?? ""} className="w-full h-full object-cover" />
                  ) : (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-full flex flex-col items-center justify-center text-center p-2 text-pink-700 hover:bg-pink-50 transition-colors"
                    >
                      <Link2 className="h-5 w-5 mb-1" />
                      <span className="text-[10px] truncate w-full">{safeHostname(item.url)}</span>
                    </a>
                  )}
                  <button
                    onClick={() => removeInspiration(idx)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
