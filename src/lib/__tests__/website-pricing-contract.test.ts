import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { computePricingSnapshot } from "@/lib/pricing";
import type { PricingItem } from "@/types/pricing";

// ============================================================
// Contrato de PREÇOS website ↔ admin
//
// Desde 26/08/2026 o fbr-website deixou de ter preços escritos à mão:
// lê-os de `pricing_items` (a tabela que a Maria edita em Finanças) pelo
// mapa PRICE_KEYS em app/_lib/precos-valores.js. Isso resolve a desactualização,
// mas cria uma dependência silenciosa: se uma chave for renomeada ou
// apagada no admin, o site não parte nem avisa — cai no fallback e
// continua a mostrar o preço antigo para sempre.
//
// Este teste é a rede. Confere que cada (categoria, key) que o site
// procura existe mesmo, semeada por alguma migração.
//
// Só corre quando o repo do website existe ao lado (máquina da Maria);
// na CI do GitHub o sibling não existe e o teste é ignorado.
// ============================================================

const PRECOS_PATH = join(
  process.cwd(),
  "..",
  "fbr-website",
  "fbr-website",
  "app",
  "_lib",
  "precos-valores.js",
);

const hasWebsite = existsSync(PRECOS_PATH);

/** Todas as linhas de pricing_items semeadas pelas migrações, como "categoria:key". */
function seededPricingKeys(): Set<string> {
  const dir = join(process.cwd(), "supabase", "migrations");
  const out = new Set<string>();
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(dir, name), "utf8");
    // ('base_frame', '30x40', 'Moldura 30x40', 300, …)
    const re = /\(\s*'(base_frame|background_supplement|glass_supplement|extra)'\s*,\s*'([^']+)'/g;
    for (const m of sql.matchAll(re)) out.add(`${m[1]}:${m[2]}`);
  }
  return out;
}

/** O mapa PRICE_KEYS do site: nome no site → "categoria:key". */
function websitePriceKeys(): Map<string, string> {
  const src = readFileSync(PRECOS_PATH, "utf8");
  const start = src.indexOf("export const PRICE_KEYS = {");
  expect(start, "PRICE_KEYS não encontrado em precos-valores.js do website").toBeGreaterThan(-1);
  const end = src.indexOf("};", start);
  const body = src.slice(start, end);
  const out = new Map<string, string>();
  // quadro30x40: ["base_frame", "30x40"],
  const re = /(\w+)\s*:\s*\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g;
  for (const m of body.matchAll(re)) out.set(m[1], `${m[2]}:${m[3]}`);
  return out;
}

describe.skipIf(!hasWebsite)("contrato de preços website ↔ admin", () => {
  it("todas as chaves que o site procura existem nas migrações", () => {
    const site = websitePriceKeys();
    const seeded = seededPricingKeys();
    expect(site.size).toBeGreaterThan(0);

    const orfas = [...site.entries()]
      .filter(([, ref]) => !seeded.has(ref))
      .map(([nome, ref]) => `${nome} → ${ref}`);

    expect(
      orfas,
      "O site procura preços que nenhuma migração cria. Cairia no fallback " +
        "em silêncio e mostraria valores desactualizados para sempre. " +
        "Corrigir o mapa PRICE_KEYS em fbr-website/app/_lib/precos-valores.js, " +
        "ou semear a linha em pricing_items.",
    ).toEqual([]);
  });

  it("o fallback do site cobre todas as chaves que o site procura", () => {
    // Sem entrada no fallback, uma falha de rede deixa o preço em branco
    // ("undefined€") numa página de preços — pior do que um valor antigo.
    const site = websitePriceKeys();
    const fallbackSrc = readFileSync(
      join(process.cwd(), "..", "fbr-website", "fbr-website", "app", "_lib", "precos-valores.js"),
      "utf8",
    );
    const semFallback = [...site.keys()].filter(
      (nome) => !new RegExp(`\\b${nome}\\s*:`).test(fallbackSrc),
    );
    expect(semFallback, "chaves sem valor em PRECOS_FALLBACK").toEqual([]);
  });

  it("nenhum texto do site tem precos escritos a mao", () => {
    // Pedido da Maria (26/08/2026): "nao quero que os valores fiquem
    // escritos a mao, tudo tem que estar interligado". Os precos vem da
    // tabela de Financas por placeholder ICU ({quadro30x40}); um valor
    // cravado no copy volta a envelhecer sem ninguem dar por isso.
    //
    // So apanha 2-3 digitos: valores de um digito (o 9 EUR dos portes do
    // vale fisico) nao sao precos de catalogo. Se um dia for preciso um
    // valor fixo legitimo, acrescentar o caminho a EXCEPCOES com a razao.
    const EXCEPCOES: string[] = [];
    const dir = join(process.cwd(), "..", "fbr-website", "fbr-website", "messages");
    const problemas: string[] = [];
    const RE_PRECO = /(?:€\s?\d{2,3}\b|\b\d{2,3}\s?€)/;

    for (const ficheiro of ["pt.json", "en.json"]) {
      const msgs: unknown = JSON.parse(readFileSync(join(dir, ficheiro), "utf8"));
      const visita = (valor: unknown, caminho: string) => {
        if (typeof valor === "string") {
          if (RE_PRECO.test(valor) && !/\{\w+\}/.test(valor) && !EXCEPCOES.includes(caminho)) {
            problemas.push(ficheiro + " -> " + caminho);
          }
        } else if (Array.isArray(valor)) {
          valor.forEach((v, i) => visita(v, caminho + "[" + i + "]"));
        } else if (valor && typeof valor === "object") {
          for (const [k, v] of Object.entries(valor)) {
            visita(v, caminho ? caminho + "." + k : k);
          }
        }
      };
      visita(msgs, "");
    }

    expect(
      problemas,
      "Texto do site com preco escrito a mao. Trocar o valor por um " +
        "placeholder ({quadro30x40}, {vidro50x70}, ...) e passa-lo no t(), " +
        "com getPrecos() no servidor ou usePrecos() no cliente.",
    ).toEqual([]);
  });
});

// ============================================================
// PARIDADE do cálculo do orçamento: website ↔ admin
//
// Desde 06/09/2026 o formulário do site mostra um "Resumo da sua
// encomenda" com o total, e a API grava esse total em `orders.budget`
// (+ pricing_snapshot). O cálculo vive em app/_lib/orcamento.js no site,
// que é um ESPELHO de src/lib/pricing.ts daqui. Se um dia alguém mudar
// uma regra só num lado (ex.: o vidro museu dos minis), o cliente vê um
// valor no site e a Maria outro no admin — e ninguém dá por isso.
//
// Este teste corre o módulo do site, tal como está, contra o nosso, com
// a mesma tabela de preços e uma matriz de encomendas.
// ============================================================

const ORCAMENTO_PATH = join(
  process.cwd(),
  "..",
  "fbr-website",
  "fbr-website",
  "app",
  "_lib",
  "orcamento.js",
);

describe.skipIf(!existsSync(ORCAMENTO_PATH))("paridade do cálculo website ↔ admin", () => {
  // Tabela de preços de teste (cobre todas as chaves que os dois usam).
  const now = "2026-09-06T00:00:00.000Z";
  const mk = (
    category: PricingItem["category"],
    key: string,
    price: number,
  ): PricingItem => ({
    id: `${category}:${key}`,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    created_by: null,
    updated_by: null,
    category,
    key,
    label: `${category} ${key}`,
    price,
    position: 0,
    notes: null,
  });
  const pricing: PricingItem[] = [
    mk("base_frame", "30x40", 300),
    mk("base_frame", "40x50", 400),
    mk("base_frame", "50x70", 500),
    mk("base_frame", "secas_30x40", 200),
    mk("base_frame", "secas_40x50", 270),
    mk("base_frame", "secas_50x70", 360),
    mk("background_supplement", "transparente", 0),
    mk("background_supplement", "preto", 0),
    mk("background_supplement", "branco", 0),
    mk("background_supplement", "cor", 0),
    mk("background_supplement", "voces_a_escolher", 0),
    mk("background_supplement", "nao_sei", 0),
    mk("background_supplement", "fotografia", 30),
    mk("background_supplement", "fotografia_30x40", 15),
    mk("background_supplement", "fotografia_40x50", 25),
    mk("background_supplement", "fotografia_50x70", 35),
    mk("background_supplement", "fotografia_mini", 5),
    mk("glass_supplement", "museum_glass_30x40", 45),
    mk("glass_supplement", "museum_glass_40x50", 65),
    mk("glass_supplement", "museum_glass_50x70", 115),
    mk("glass_supplement", "museum_glass_20x25", 20),
    mk("extra", "mini_frame", 90),
    mk("extra", "christmas_ornament", 35),
    mk("extra", "necklace_pendant", 35),
    mk("extra", "pyramid_frame", 0),
  ];

  type Input = Parameters<typeof computePricingSnapshot>[0];
  const sizes: Input["frame_size"][] = ["30x40", "40x50", "50x70", "nao_sei", "voces_a_escolher", null];
  const backgrounds: Input["frame_background"][] = ["transparente", "fotografia", "cor", "voces_a_escolher", null];
  const glass: Input["museum_glass"][] = ["sim", "nao", "nao_sei"];
  const flags: Input["extra_small_frames"][] = ["sim", "nao", "mais_info", null];

  it("dá o mesmo total e as mesmas linhas para uma matriz de encomendas", async () => {
    const site = (await import(pathToFileURL(ORCAMENTO_PATH).href)) as {
      computePricingSnapshot: (o: unknown, items: unknown) => {
        total: number;
        lines: Array<{ key: string; qty: number; subtotal: number }>;
        provisional?: boolean;
      } | null;
    };

    let casos = 0;
    for (const service_type of ["preservacao", "emoldurar_secas", "recriacao"] as const)
      for (const frame_size of sizes)
        for (const frame_background of backgrounds)
          for (const museum_glass of glass)
            for (const museum_glass_mini of glass)
              for (const minis of flags)
                for (const qty of [null, 0, 2]) {
                  const order: Input = {
                    service_type,
                    frame_size,
                    frame_background,
                    museum_glass,
                    museum_glass_mini,
                    pyramid_frame: false,
                    extra_small_frames: minis,
                    extra_small_frames_qty: qty,
                    christmas_ornaments: minis,
                    christmas_ornaments_qty: qty,
                    necklace_pendants: minis === "sim" ? "sim" : "nao",
                    necklace_pendants_qty: 1,
                  };
                  const a = computePricingSnapshot(order, pricing);
                  const b = site.computePricingSnapshot(order, pricing);
                  const norm = (s: typeof a) =>
                    s && {
                      total: s.total,
                      provisional: s.provisional ?? false,
                      lines: s.lines.map((l) => [l.key, l.qty, l.subtotal]),
                    };
                  expect(norm(b as typeof a), JSON.stringify(order)).toEqual(norm(a));
                  casos++;
                }
    expect(casos).toBeGreaterThan(1000);
  });
});
