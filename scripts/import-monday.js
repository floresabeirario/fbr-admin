// One-shot script to convert Monday.com Excel export → SQL INSERT statements
// for the `orders` table.
//
// Usage:
//   node scripts/import-monday.js
// Output:
//   supabase/migrations/006_import_monday.sql

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "..", "public", "mondayexport.xlsx");
const OUT = path.join(__dirname, "..", "supabase", "migrations", "006_import_monday.sql");

// Names to skip
const SKIP_NAMES = new Set([
  "teste noiva teste",
  "joão correia",
  "sandra carvalho",
]);

// Rows that despite having a non-cancelado Estado are actually cancelled
// (the user confirmed: row was in Cancelamentos because client gave up before paying)
const FORCE_CANCELLED = new Set([
  "laureana castanheira rocha",
  "eugenia sardinha",
]);

// ── Header → column index ────────────────────────────────────────
const COL = {
  name: 0,
  contact_pref: 1,
  email: 2,
  phone: 3,
  budget: 4,
  payment: 5,
  commission: 6,
  commission_paid: 7,
  event_date: 8,
  status: 9,
  flower_delivery: 10,
  flower_shipping_cost: 11,
  flower_shipping_paid: 12,
  flower_type: 13,
  frame_delivery: 14,
  frame_background: 15,
  frame_size: 16,
  extras_main: 17,
  extras_other: 18,
  extra_small_frames: 19,
  extra_small_frames_qty: 20,
  ornaments: 21,
  ornaments_qty: 22,
  pendants: 23,
  pendants_qty: 24,
  how_found: 25,
  how_found_2: 26, // mostly empty
  florist_or_other: 27,
  notes: 28,
  coupon_code: 29,
  coupon_expiry: 30,
  coupon_status: 31,
  feedback: 32,
  frame_delivery_date: 33,
  couple_names: 34,
  sheets_id: 35,
};

// ── Helpers ──────────────────────────────────────────────────────

function S(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// SQL string escape
function q(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// SQL number / decimal — accepts strings with comma or dot
function n(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  const s = String(v).replace(",", ".").trim();
  if (!s) return "NULL";
  const num = Number(s);
  if (!Number.isFinite(num)) return "NULL";
  return num.toString();
}

// SQL int
function i(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  const num = parseInt(String(v).trim(), 10);
  if (!Number.isFinite(num)) return "NULL";
  return num.toString();
}

function d(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  // Date object (xlsx cellDates:true). xlsx stores Excel dates as UTC-midnight,
  // but PT timezone (UTC+1/+2) shifts the result back one day. Add 12h to land
  // on the same calendar day regardless of local TZ, then read UTC parts.
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "NULL";
    const adjusted = new Date(v.getTime() + 12 * 3600 * 1000);
    const yyyy = adjusted.getUTCFullYear();
    const mm = String(adjusted.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(adjusted.getUTCDate()).padStart(2, "0");
    return q(`${yyyy}-${mm}-${dd}`);
  }
  // Numeric Excel serial date (days since 1900-01-01, with the 1900 leap-year bug)
  if (typeof v === "number") {
    // Excel serial 1 = 1900-01-01, but Excel treats 1900 as leap year, so offset 25569 = 1970-01-01
    const ms = (v - 25569) * 86400 * 1000;
    const dt = new Date(ms);
    if (isNaN(dt.getTime())) return "NULL";
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return q(`${yyyy}-${mm}-${dd}`);
  }
  const s = String(v).trim();
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return "NULL";
  return q(m[1]);
}

function b(v) {
  return v ? "TRUE" : "FALSE";
}

// Phone numbers come from Excel as numbers in scientific notation.
// We read with raw:true to get the raw value, then format as a digit string.
function formatPhone(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    // Convert number to integer string (no decimals, no exponent)
    return Math.round(v).toString();
  }
  const s = String(v).trim();
  if (!s) return null;
  // If it still looks like scientific notation, parse and round
  if (/e[+-]/i.test(s)) {
    const num = Number(s);
    if (Number.isFinite(num)) return Math.round(num).toString();
  }
  return s;
}

// ── Mapping functions ────────────────────────────────────────────

function mapState(s, isCancelled) {
  if (isCancelled) return "cancelado";
  const v = S(s);
  if (/Entrega flores por agendar/i.test(v)) return "entrega_flores_agendar";
  if (/Entrega flores agendada/i.test(v)) return "entrega_agendada";
  if (/^Flores enviadas/i.test(v)) return "flores_enviadas";
  if (/Flores recebidas/i.test(v)) return "flores_recebidas";
  if (/Em preserva/i.test(v)) return "flores_na_prensa";
  if (/Composi.*colagem/i.test(v)) return "a_compor_design";
  if (/Reconstru/i.test(v)) return "reconstrucao_botanica";
  if (/A aguardar aprova/i.test(v)) return "a_aguardar_aprovacao";
  if (/A ser emoldurado/i.test(v)) return "a_ser_emoldurado";
  if (/^Emoldurado/i.test(v)) return "emoldurado";
  if (/A ser fotografado/i.test(v)) return "a_ser_fotografado";
  if (/Quadro pronto/i.test(v)) return "quadro_pronto";
  if (/Quadro enviado/i.test(v)) return "quadro_enviado";
  if (/Entregue|Quadro recebido/i.test(v)) return "quadro_recebido";
  return "entrega_flores_agendar";
}

function mapPayment(s) {
  const v = S(s);
  if (/^100% pago/i.test(v)) return "100_pago";
  if (/^70% pago/i.test(v)) return "70_pago";
  if (/^Sinal 30% pago|^30% pago/i.test(v)) return "30_pago";
  if (/^30% por pagar/i.test(v)) return "30_por_pagar";
  // "100% por pagar", "Sinal por pagar", "N/A", "" → 100_por_pagar (per user)
  return "100_por_pagar";
}

function mapContactPref(s) {
  const v = S(s);
  if (/whatsapp/i.test(v)) return "whatsapp";
  if (/e-?mail/i.test(v)) return "email";
  return null;
}

function mapFlowerDelivery(s) {
  const v = S(s);
  if (!v) return null;
  if (/em mãos/i.test(v)) return "maos";
  if (/CTT|transportadora/i.test(v)) return "ctt";
  if (/recolha no evento/i.test(v)) return "recolha_evento";
  return "nao_sei";
}

function mapFrameDelivery(s) {
  const v = S(s);
  if (!v) return null;
  if (/em mãos/i.test(v)) return "maos";
  if (/transportadora|CTT/i.test(v)) return "ctt";
  return "nao_sei";
}

function mapFrameBackground(s) {
  const v = S(s);
  if (!v) return null;
  if (/transparente/i.test(v)) return "transparente";
  if (/^preto/i.test(v)) return "preto";
  if (/^branco/i.test(v)) return "branco";
  if (/fotografia/i.test(v)) return "fotografia";
  if (/voc[êe]s a escolher|que fossem voc[êe]s/i.test(v)) return "voces_a_escolher";
  if (/ainda não sei/i.test(v)) return "nao_sei";
  return null;
}

function mapFrameSize(s) {
  const v = S(s);
  if (!v) return null;
  if (/30x40/i.test(v)) return "30x40";
  if (/40x50/i.test(v)) return "40x50";
  if (/50x70/i.test(v)) return "50x70"; // also matches "50x70xm" (typo)
  if (/voc[êe]s a escolher/i.test(v)) return "voces_a_escolher";
  if (/ainda não sei/i.test(v)) return "nao_sei";
  return null;
}

function mapYesNoInfo(s) {
  const v = S(s);
  if (!v) return null;
  if (/^sim/i.test(v)) return "sim";
  if (/^não, apenas/i.test(v)) return "nao";
  if (/mais informa/i.test(v)) return "mais_info";
  return null;
}

function mapHowFound(s) {
  const v = S(s);
  if (!v) return null;
  if (/instagram/i.test(v)) return "instagram";
  if (/facebook/i.test(v)) return "facebook";
  if (/casamentos\.pt/i.test(v)) return "casamentos_pt";
  if (/google/i.test(v)) return "google";
  if (/vale-?presente/i.test(v)) return "vale_presente";
  if (/florista/i.test(v)) return "florista";
  if (/recomenda/i.test(v)) return "recomendacao";
  if (/outro/i.test(v)) return "outro";
  return null;
}

function mapPartnerCommissionStatus(s) {
  const v = S(s);
  if (!v || v === "N/A") return "na";
  if (/parceiro informado/i.test(v)) return "parceiro_informado";
  if (/aguardar resposta/i.test(v)) return "a_aguardar_resposta";
  if (/^a aguardar/i.test(v)) return "a_aguardar";
  if (/paga/i.test(v)) return "paga";
  if (/não aceita/i.test(v)) return "nao_aceita";
  return "na";
}

function mapCouponStatus(s) {
  const v = S(s);
  if (/^utilizado/i.test(v)) return "utilizado";
  if (/não utilizado/i.test(v)) return "nao_utilizado";
  return "na";
}

function mapFeedback(s) {
  const v = S(s);
  if (/^deu feedback/i.test(v)) return "deu_feedback";
  if (/^já pedido/i.test(v)) return "ja_pedido";
  if (/^não disse nada/i.test(v)) return "nao_disse_nada";
  return "na";
}

function mapShippingPaid(s) {
  return /^pago/i.test(S(s));
}

// Known multi-word extras options (from PROGRESS.md sessão 11)
const KNOWN_EXTRAS = [
  "Não pretendo incluir extras",
  "Votos manuscritos",
  "Convite do casamento",
  "Fitas, tecidos ou rendas",
  "Fotografia",
  "Joia ou medalha",
  "Coleira de animal",
  "Cartas ou bilhetes",
  "Outro (especifique abaixo)",
];

function parseExtras(s17, s18) {
  const v = S(s17);
  const notes = S(s18);
  if (!v) return { options: [], notes };
  const options = [];
  let remaining = v;
  // Match longest first to handle "Fitas, tecidos ou rendas" (contains comma)
  const sorted = [...KNOWN_EXTRAS].sort((a, b) => b.length - a.length);
  for (const ex of sorted) {
    if (remaining.includes(ex)) {
      options.push(ex);
      remaining = remaining.split(ex).join("");
    }
  }
  return { options, notes };
}

// Event type: infer from data
function inferEventType(coupleNames, flowerType) {
  const cn = S(coupleNames);
  const ft = S(flowerType);
  if (cn) return "casamento";
  if (/noiva|bridal/i.test(ft)) return "casamento";
  return null;
}

// JSONB literal
function jsonb(obj) {
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}

// Decide where to put col 27 ("Que Florista?" / "Outro" / extra origin info)
// → how_found_fbr_other when how_found is florista/recomendacao/outro
// → additional_notes appendix when how_found is something else (preserve info)
function placeOriginText(howFound, originText, baseNotes) {
  const text = S(originText);
  if (!text) return { how_found_fbr_other: null, additional_notes: S(baseNotes) || null };
  if (howFound === "florista" || howFound === "recomendacao" || howFound === "outro") {
    return {
      how_found_fbr_other: text,
      additional_notes: S(baseNotes) || null,
    };
  }
  // For vale_presente etc., store in additional_notes so we don't lose it
  const merged = [S(baseNotes), `(Origem: ${text})`].filter(Boolean).join(" — ");
  return { how_found_fbr_other: null, additional_notes: merged || null };
}

// ── Read Excel ───────────────────────────────────────────────────

const wb = XLSX.readFile(SOURCE, { cellDates: true });
const sh = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });

const rows = [];
for (let idx = 0; idx < data.length; idx++) {
  const r = data[idx];
  if (!r || !r.some((c) => c !== null && c !== "")) continue;
  const name = S(r[COL.name]);
  if (!name) continue;
  // Skip headers and group titles (group titles only have col 0 filled)
  if (r.slice(1).every((c) => c === null || c === "")) continue;
  // Skip header row (matches "Nome" exactly)
  if (name === "Nome") continue;
  // Skip sum rows (no name, lots of numbers) — already filtered by !name
  // Skip excluded names
  const lname = name.toLowerCase();
  if (SKIP_NAMES.has(lname)) {
    console.log("skip:", name);
    continue;
  }
  rows.push({ idx, r });
}

console.log("Importing", rows.length, "orders");

// ── Build SQL ────────────────────────────────────────────────────

const sqlLines = [];
sqlLines.push("-- ============================================================");
sqlLines.push("-- 006_import_monday.sql");
sqlLines.push("-- Importação de encomendas históricas do Monday.com.");
sqlLines.push("-- Gerado automaticamente por scripts/import-monday.js");
sqlLines.push("-- Executar no Supabase SQL Editor (uma única vez).");
sqlLines.push("-- ============================================================");
sqlLines.push("");
sqlLines.push("BEGIN;");
sqlLines.push("");

for (const { r } of rows) {
  const name = S(r[COL.name]);
  const lname = name.toLowerCase();
  const isCancelled = FORCE_CANCELLED.has(lname);
  const status = mapState(r[COL.status], isCancelled);
  const couple = S(r[COL.couple_names]);
  const flowerType = S(r[COL.flower_type]);
  const extras = parseExtras(r[COL.extras_main], r[COL.extras_other]);
  const howFound = mapHowFound(r[COL.how_found]);
  const placement = placeOriginText(howFound, r[COL.florist_or_other], r[COL.notes]);
  const sheetsId = S(r[COL.sheets_id]);

  const fields = {
    order_id: sheetsId ? q(sheetsId) : "DEFAULT",
    client_name: q(name),
    contact_preference: q(mapContactPref(r[COL.contact_pref])),
    email: q(S(r[COL.email]) || null),
    phone: q(formatPhone(r[COL.phone])),
    event_date: d(r[COL.event_date]),
    event_type: q(inferEventType(couple, flowerType)),
    couple_names: q(couple || null),
    event_location: "NULL",
    flower_delivery_method: q(mapFlowerDelivery(r[COL.flower_delivery])),
    flower_type: q(flowerType || null),
    frame_delivery_method: q(mapFrameDelivery(r[COL.frame_delivery])),
    frame_background: q(mapFrameBackground(r[COL.frame_background])),
    frame_size: q(mapFrameSize(r[COL.frame_size])),
    extras_in_frame: jsonb(extras),
    extra_small_frames: q(mapYesNoInfo(r[COL.extra_small_frames])),
    extra_small_frames_qty: i(r[COL.extra_small_frames_qty]),
    christmas_ornaments: q(mapYesNoInfo(r[COL.ornaments])),
    christmas_ornaments_qty: i(r[COL.ornaments_qty]),
    necklace_pendants: q(mapYesNoInfo(r[COL.pendants])),
    necklace_pendants_qty: i(r[COL.pendants_qty]),
    how_found_fbr: q(howFound),
    how_found_fbr_other: q(placement.how_found_fbr_other),
    additional_notes: q(placement.additional_notes),
    status: q(status),
    budget: n(r[COL.budget]),
    payment_status: q(mapPayment(r[COL.payment])),
    partner_commission: n(r[COL.commission]),
    partner_commission_status: q(mapPartnerCommissionStatus(r[COL.commission_paid])),
    flower_shipping_cost: n(r[COL.flower_shipping_cost]),
    flower_shipping_paid: b(mapShippingPaid(r[COL.flower_shipping_paid])),
    coupon_code: q(S(r[COL.coupon_code]) || null),
    coupon_expiry: d(r[COL.coupon_expiry]),
    coupon_status: q(mapCouponStatus(r[COL.coupon_status])),
    client_feedback_status: q(mapFeedback(r[COL.feedback])),
    frame_delivery_date: d(r[COL.frame_delivery_date]),
  };

  // Drop fields that resolve to "DEFAULT" — handle them inline
  const keys = Object.keys(fields);
  const cols = keys.join(", ");
  const vals = keys.map((k) => fields[k]).join(", ");
  sqlLines.push(`-- ${name}`);
  sqlLines.push(`INSERT INTO orders (${cols}) VALUES (${vals});`);
  sqlLines.push("");
}

sqlLines.push("COMMIT;");
sqlLines.push("");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, sqlLines.join("\n"), "utf8");
console.log("Wrote", OUT);
