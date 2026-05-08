/* eslint-disable @typescript-eslint/no-require-imports */
// Generates supabase/migrations/014_import_monday_partners.sql from
// scripts/_monday-parceiros-parsed.json
// Run `node scripts/parse-monday-parceiros.js` first to regenerate the JSON.

const fs = require("fs");
const crypto = require("crypto");

const data = JSON.parse(
  fs.readFileSync("scripts/_monday-parceiros-parsed.json", "utf8")
);

// ---------- Mapping helpers ----------
const STATUS_MAP = {
  "Por contactar 🐣": "por_contactar",
  "Pendente ⚖️": "pendente",
  "Tentativa de contacto ☹️": "tentativa_contacto",
  "Contactado 🌼": "tentativa_contacto", // user decision
  "Aceite 👍": "aceite",
  "Confirmado 🎉": "confirmado",
  "Rejeitado ❌": "rejeitado",
};

const COMMISSION_MAP = {
  Sim: "sim",
  Não: "nao",
  "Sem informação": "a_confirmar",
  "Ñ ficou claro": "a_confirmar",
};

// "Acções" column (we strip the trailing emoji — see ACTION_TITLE)
function actionTitle(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "Nada a fazer") return null;
  // Remove trailing emoji/symbol after the last space.
  return trimmed.replace(/\s+[^\w\sÀ-ÿ]+$/u, "").trim() || trimmed;
}

const MJ_EMAIL = "info+mj@floresabeirario.pt";

// ---------- Date parsing ----------
const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  janeiro: 0, fevereiro: 1, março: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function parseMondayDate(raw) {
  if (!raw) return null;
  const m = String(raw)
    .trim()
    .match(/^(\d{1,2})\/([A-Za-zÀ-ÿ]+)\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthIdx = MONTHS[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  let hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const second = parseInt(m[6], 10);
  const ampm = m[7] ? m[7].toUpperCase() : null;
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  if (monthIdx == null) return null;
  // Treat as Lisbon local time → UTC ISO (best-effort: assume UTC+1 winter / +0 summer? Use UTC).
  const date = new Date(Date.UTC(year, monthIdx, day, hour, minute, second));
  return date.toISOString();
}

// ---------- Channel inference ----------
function inferChannel(text) {
  if (!text) return "outro";
  const t = String(text).toLowerCase();
  // Search for first occurrence of each keyword set; the first match wins.
  const candidates = [
    { ch: "telefone", re: /\b(ligar|liguei|ligamos|liguei-?lhe|telefon[ei]|chamada|atend[ei]|atendeu)\b/i },
    { ch: "whatsapp", re: /\b(whats?app|whatapp|wa\b|whatzap)\b/i },
    { ch: "email", re: /\b(e-?mail|mail enviad|enviei mail|mandei mail|por mail)\b/i },
    { ch: "reuniao", re: /\b(reuni[aã]o|presencial|fui à loja|fomos à loja|loja|visit[áa]mos|encontrei-?me)\b/i },
  ];
  let best = { ch: "outro", idx: Infinity };
  for (const c of candidates) {
    const m = t.match(c.re);
    if (m) {
      const idx = t.indexOf(m[0]);
      if (idx < best.idx) best = { ch: c.ch, idx };
    }
  }
  return best.ch;
}

// ---------- Phone extraction ----------
function normalizePhone(raw) {
  if (!raw) return null;
  // Handles things like "9.33786543E+8" if any slipped through, plus normal strings.
  const s = String(raw).replace(/\s+/g, "");
  if (/^\d+(\.\d+)?[Ee][+-]?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return String(Math.round(n));
  }
  // Strip non-digits but keep leading "+"
  const cleaned = s.replace(/[^0-9+]/g, "");
  return cleaned || null;
}

// Extract { label, number } pairs from free-text notes.
// Recognizes "Ana paula - 915 704 383", "Diogo: 933886082",
// "Rita Abecasis +351 914 696 165", "outro telemovel: 9XXXXXXXX" (label null).
function extractPhonesFromNotes(notes, primary) {
  if (!notes) return [];
  const primDigits = primary ? String(primary).replace(/\D/g, "") : "";
  const seen = new Set();
  if (primDigits) seen.add(primDigits);

  // Split into segments at clear delimiters (|, newlines, semicolons).
  const segments = String(notes).split(/[|\n;]+/);
  const PHONE_RE = /(?<!\d)([29](?:[\s.-]?\d){8})(?!\d)/g;

  const FILLERS = [
    "outro tele", "outra tele", "outro telef", "outro telem",
    "outro telofone", // typo seen in notes
    "alt tele", "alt.tele", "alt. tele", "alt. tel", "alt.tel", "alt tel",
    "atl.tele", "atl. tele", "atl tele",
    "outro número", "outro numero",
    "outra linha", "outro contacto", "outro tel",
  ];
  const FILLER_SOLO = /^(tele|telefone|telem[oó]vel|n[uú]mero|contacto|linha|outro|outra|alt|atl|tel|tlm|telef)\.?$/i;

  const result = [];
  for (const seg of segments) {
    PHONE_RE.lastIndex = 0;
    let m;
    while ((m = PHONE_RE.exec(seg))) {
      const digits = m[1].replace(/\D/g, "");
      if (digits.length !== 9) continue;
      if (seen.has(digits)) continue;
      seen.add(digits);

      // Label = text immediately before the number in this segment.
      let before = seg.slice(0, m.index);
      // Strip trailing separators / punctuation / "+351" prefix.
      before = before.replace(/[\s\-:+,.()*/]+$/u, "").trim();
      before = before.replace(/(\+?\s*351)$/u, "").trim();
      before = before.replace(/[\s\-:+,.()*/]+$/u, "").trim();

      let label = before || null;
      if (label) {
        const lowL = label.toLowerCase();
        if (FILLERS.some((f) => lowL.includes(f))) label = null;
        else if (FILLER_SOLO.test(label.trim())) label = null;
        // Discard if "label" is actually digits (previous number leaked through)
        else if (/^[\d\s.\-+()]+$/.test(label)) label = null;
        // Too long → almost certainly random text, not a label
        else if (label.length > 60) label = null;
      }
      result.push({ label, number: digits });
    }
  }
  return result;
}

// ---------- SQL escaping ----------
function sqlStr(s) {
  if (s == null) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function sqlArr(arr) {
  if (!arr || arr.length === 0) return "'{}'::text[]";
  const escaped = arr.map((s) =>
    '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'
  );
  return "'{" + escaped.join(",") + "}'::text[]";
}

function sqlJsonb(obj) {
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}

// ---------- Build SQL ----------
const lines = [];
lines.push("-- ============================================================");
lines.push("-- FBR Admin — Importação Monday → Parcerias (Fase 5)");
lines.push("-- Gerado por scripts/import-monday-parceiros.js");
lines.push("-- ⚠ EXECUTAR UMA SÓ VEZ no Supabase SQL Editor");
lines.push("-- ============================================================");
lines.push("--");
lines.push("-- Origem: 4 Excel exportados do Monday em public/");
lines.push("--   Wedding_Planners_1778232249.xlsx");
lines.push("--   Floristas_1778232269.xlsx");
lines.push("--   Quintas_de_Eventos_1778232283.xlsx");
lines.push("--   Outros_contactos_1778232307.xlsx");
lines.push("--");
lines.push("-- Decisões:");
lines.push("--   • Estado 'Contactado 🌼' → tentativa_contacto");
lines.push("--   • Coluna 'Ações' → 1 acção pendente por parceiro (excepto 'Nada a fazer')");
lines.push("--   • Histórico de interações: canal inferido do texto (email/whatsapp/telefone/reuniao/outro)");
lines.push("--   • Telemóveis adicionais extraídos das notas (formato 9 dígitos PT)");
lines.push("--   • Todos os updates foram registados pela MJ → by = 'info+mj@floresabeirario.pt'");
lines.push("-- ============================================================");
lines.push("");
lines.push("BEGIN;");
lines.push("");

let totalPartners = 0;
let totalInteractions = 0;
let totalActions = 0;
let phonesFromNotes = 0;
let phonesWithLabels = 0;
let unknownStates = new Set();

const categoryOrder = ["wedding_planners", "floristas", "quintas_eventos", "outros"];

for (const category of categoryOrder) {
  const block = data[category];
  if (!block) continue;
  const { partners, updates } = block;

  // Group updates by monday_id; sort chronologically (asc by created_at).
  const updatesById = new Map();
  for (const u of updates) {
    if (!updatesById.has(u.monday_id)) updatesById.set(u.monday_id, []);
    updatesById.get(u.monday_id).push(u);
  }
  for (const arr of updatesById.values()) {
    arr.sort((a, b) => {
      const da = parseMondayDate(a.created_at) || "";
      const db = parseMondayDate(b.created_at) || "";
      return da.localeCompare(db);
    });
  }

  lines.push(`-- ── ${category.toUpperCase()} (${partners.length} parceiros) ──`);
  lines.push("");

  for (const p of partners) {
    totalPartners++;
    const status = STATUS_MAP[String(p.estado_raw).trim()] || null;
    if (!status) {
      unknownStates.add(p.estado_raw);
      continue;
    }

    const accepts =
      p.comissao_raw && COMMISSION_MAP[String(p.comissao_raw).trim()]
        ? COMMISSION_MAP[String(p.comissao_raw).trim()]
        : null;

    // Phones — { label, number }
    const primary = normalizePhone(p.telemovel);
    const extras = extractPhonesFromNotes(p.notas, primary);
    phonesFromNotes += extras.length;
    const phones = [];
    if (primary) phones.push({ label: null, number: primary });
    for (const e of extras) {
      if (!phones.some((existing) => existing.number === e.number)) {
        phones.push(e);
      }
    }
    if (extras.some((e) => e.label)) phonesWithLabels++;

    // Links
    const links = [];
    if (p.link) {
      String(p.link)
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s))
        .forEach((s) => links.push(s));
    }

    // Interactions
    const partnerUpdates = updatesById.get(p.monday_id) || [];
    const interactions = partnerUpdates
      .map((u) => {
        const date = parseMondayDate(u.created_at);
        if (!u.content) return null;
        return {
          id: crypto.randomUUID(),
          date: date || new Date().toISOString(),
          channel: inferChannel(u.content),
          summary: String(u.content).trim(),
          by: MJ_EMAIL,
        };
      })
      .filter(Boolean);
    totalInteractions += interactions.length;

    // Actions
    const actions = [];
    const title = actionTitle(p.acoes_raw);
    if (title) {
      actions.push({
        id: crypto.randomUUID(),
        title,
        assignee_email: null,
        due_date: null,
        done: false,
        done_at: null,
        done_by: null,
        created_at: new Date().toISOString(),
        created_by: null,
      });
      totalActions++;
    }

    lines.push(
      `INSERT INTO partners (name, category, status, contact_person, email, phones, links, location_label, accepts_commission, notes, interactions, actions) VALUES (`
    );
    lines.push(`  ${sqlStr(p.name)},`);
    lines.push(`  '${category}',`);
    lines.push(`  '${status}',`);
    lines.push(`  ${sqlStr(p.responsavel)},`);
    lines.push(`  ${sqlStr(p.email)},`);
    lines.push(`  ${sqlJsonb(phones)},`);
    lines.push(`  ${sqlArr(links)},`);
    lines.push(`  ${sqlStr(p.local)},`);
    lines.push(`  ${accepts ? `'${accepts}'` : "NULL"},`);
    lines.push(`  ${sqlStr(p.notas)},`);
    lines.push(`  ${sqlJsonb(interactions)},`);
    lines.push(`  ${sqlJsonb(actions)}`);
    lines.push(`);`);
    lines.push("");
  }
}

lines.push("COMMIT;");
lines.push("");
lines.push(`-- Totais: ${totalPartners} parceiros · ${totalInteractions} interações · ${totalActions} acções pendentes`);
lines.push(`-- Telemóveis adicionais extraídos das notas: ${phonesFromNotes}`);
if (unknownStates.size > 0) {
  lines.push(`-- ⚠ Estados desconhecidos (linhas IGNORADAS): ${[...unknownStates].join(", ")}`);
}

const outPath = "supabase/migrations/014_import_monday_partners.sql";
fs.writeFileSync(outPath, lines.join("\n"));
console.log(`✅ ${outPath} written`);
console.log(`   • ${totalPartners} parceiros`);
console.log(`   • ${totalInteractions} interações`);
console.log(`   • ${totalActions} acções pendentes`);
console.log(`   • ${phonesFromNotes} telemóveis extraídos das notas`);
console.log(`   • ${phonesWithLabels} parceiros com pelo menos 1 etiqueta extraída (ex.: "Ana Paula")`);
if (unknownStates.size > 0) {
  console.log(`   ⚠ Estados desconhecidos: ${[...unknownStates].join(", ")}`);
}
