// ============================================================
// Inventário: migrações locais vs. Supabase produção
// ============================================================
// Faz o parse de supabase/migrations/*.sql à procura de tabelas e
// colunas criadas, e sonda cada uma via PostgREST com a anon key.
//
// Interpretação das respostas (não precisa de service_role):
//   • PGRST205 / "Could not find the table"  → tabela NÃO existe (ou não exposta)
//   • 42703 / "column ... does not exist"    → coluna NÃO existe
//   • 200, 401, 42501 (permission denied)    → objecto EXISTE (RLS/grants à parte)
//
// Limitações: não consegue verificar triggers, funções, policies nem
// publicações Realtime (ex.: mig 075) — só tabelas e colunas.
//
// Uso:  node scripts/db-inventory.mjs
// ============================================================

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// ── Carregar .env.local ──────────────────────────────────────
const env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  console.error("Não encontrei .env.local — corre a partir da raiz do projecto.");
  process.exit(1);
}
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_BASE || !ANON) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local");
  process.exit(1);
}

// ── Parse das migrações ──────────────────────────────────────
const MIG_DIR = "supabase/migrations";
const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();

// tabela → { firstMig, columns: Map<col, mig> }
const tables = new Map();
// "DROP TABLE" / renames não são tratados — assinala manualmente se aparecerem.

const reCreate = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi;
const reAlterAdd = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi;
const reRenameCol = /alter\s+table\s+(?:public\.)?"?(\w+)"?\s+rename\s+column\s+"?(\w+)"?\s+to\s+"?(\w+)"?/gi;
const reDropCol = /alter\s+table\s+(?:public\.)?"?(\w+)"?\s+drop\s+column\s+(?:if\s+exists\s+)?"?(\w+)"?/gi;

for (const f of files) {
  const sql = readFileSync(path.join(MIG_DIR, f), "utf8");
  let m;
  while ((m = reCreate.exec(sql))) {
    const t = m[1].toLowerCase();
    if (!tables.has(t)) tables.set(t, { firstMig: f, columns: new Map() });
  }
  while ((m = reAlterAdd.exec(sql))) {
    const t = m[1].toLowerCase();
    if (!tables.has(t)) tables.set(t, { firstMig: "(pré-existente)", columns: new Map() });
    tables.get(t).columns.set(m[2].toLowerCase(), f);
  }
  while ((m = reRenameCol.exec(sql))) {
    const t = m[1].toLowerCase();
    const info = tables.get(t);
    if (info) {
      info.columns.delete(m[2].toLowerCase());
      info.columns.set(m[3].toLowerCase(), f);
    }
  }
  while ((m = reDropCol.exec(sql))) {
    tables.get(m[1].toLowerCase())?.columns.delete(m[2].toLowerCase());
  }
}

// ── Sondas ───────────────────────────────────────────────────
async function probe(pathQS) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathQS}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  let body = "";
  try { body = await res.text(); } catch {}
  return { status: res.status, body };
}

function classify(status, body) {
  if (body.includes("PGRST205") || /Could not find the table/i.test(body)) return "missing-table";
  if (body.includes("42703") || /column .* does not exist/i.test(body)) return "missing-column";
  // PGRST204 = coluna não está na cache do schema (equivalente a não existir)
  if (body.includes("PGRST204")) return "missing-column";
  // 200/206 (ok), 401/403/42501 (permissões) → o objecto existe
  return "exists";
}

const okT = [], missT = [], okC = [], missC = [], odd = [];

for (const [t, info] of [...tables.entries()].sort()) {
  const r = await probe(`${t}?select=*&limit=0`);
  const cls = classify(r.status, r.body);
  if (cls === "missing-table") {
    missT.push(`  ✗ TABELA ${t}  (criada em ${info.firstMig})`);
    continue; // sem tabela, não vale a pena sondar colunas
  }
  if (cls === "exists") okT.push(t);
  else odd.push(`  ? ${t} → HTTP ${r.status}: ${r.body.slice(0, 120)}`);

  for (const [c, mig] of [...info.columns.entries()].sort()) {
    const rc = await probe(`${t}?select=${c}&limit=0`);
    const cc = classify(rc.status, rc.body);
    if (cc === "missing-column") missC.push(`  ✗ COLUNA ${t}.${c}  (mig ${mig})`);
    else if (cc === "exists") okC.push(`${t}.${c}`);
    else odd.push(`  ? ${t}.${c} → HTTP ${rc.status}: ${rc.body.slice(0, 120)}`);
  }
}

// ── Relatório ────────────────────────────────────────────────
console.log("════════════════════════════════════════════════");
console.log("Inventário BD — " + new Date().toISOString());
console.log(`Migrações analisadas: ${files.length}`);
console.log(`Tabelas esperadas: ${tables.size} · existem: ${okT.length}`);
console.log(`Colunas (ALTER ADD) sondadas: ${okC.length + missC.length} · existem: ${okC.length}`);
console.log("════════════════════════════════════════════════");
if (missT.length) {
  console.log("\n⚠️  TABELAS EM FALTA NA PRODUÇÃO:");
  missT.forEach((l) => console.log(l));
}
if (missC.length) {
  console.log("\n⚠️  COLUNAS EM FALTA NA PRODUÇÃO:");
  missC.forEach((l) => console.log(l));
}
if (odd.length) {
  console.log("\n❓ RESPOSTAS AMBÍGUAS (verificar à mão):");
  odd.forEach((l) => console.log(l));
}
if (!missT.length && !missC.length && !odd.length) {
  console.log("\n✅ Todas as tabelas e colunas das migrações existem na produção.");
}
console.log(
  "\nNota: triggers, funções, policies e publicações Realtime (ex.: mig 075)\n" +
  "não são verificáveis por esta via — confirmar no SQL Editor com:\n" +
  "  select * from pg_publication_tables where pubname = 'supabase_realtime';",
);
