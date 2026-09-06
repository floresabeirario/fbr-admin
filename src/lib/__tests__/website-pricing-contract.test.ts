import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ============================================================
// Contrato de PREÇOS website ↔ admin
//
// Desde 26/08/2026 o fbr-website deixou de ter preços escritos à mão:
// lê-os de `pricing_items` (a tabela que a Maria edita em Finanças) pelo
// mapa PRICE_KEYS em app/_lib/precos.js. Isso resolve a desactualização,
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
  "precos.js",
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
  const start = src.indexOf("const PRICE_KEYS = {");
  expect(start, "PRICE_KEYS não encontrado em precos.js do website").toBeGreaterThan(-1);
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
        "Corrigir o mapa PRICE_KEYS em fbr-website/app/_lib/precos.js, " +
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
