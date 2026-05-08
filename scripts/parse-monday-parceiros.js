/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

// ---- Mapping ----
const FILES = [
  { file: "Wedding_Planners_1778232249.xlsx", category: "wedding_planners" },
  { file: "Floristas_1778232269.xlsx", category: "floristas" },
  { file: "Quintas_de_Eventos_1778232283.xlsx", category: "quintas_eventos" },
  { file: "Outros_contactos_1778232307.xlsx", category: "outros" },
];

// Header row in Monday export looks like the second sheet row, with these labels:
// Name | Subelementos | Estado | Ações | Email | Telemóvel | Responsável | Notas | Local | Link | 10% comissão | Data agendada | Item ID
const COLS = {
  name: "🤝 Wedding Planners", // first sheet col, but always main col
  subelementos: "__EMPTY",
  estado: "__EMPTY_1",
  acoes: "__EMPTY_2",
  email: "__EMPTY_3",
  telemovel: "__EMPTY_4",
  responsavel: "__EMPTY_5",
  notas: "__EMPTY_6",
  local: "__EMPTY_7",
  link: "__EMPTY_8",
  comissao: "__EMPTY_9",
  data_agendada: "__EMPTY_10",
  item_id: "__EMPTY_11",
};

// Group headers (rows that just say "Por contactar", "Pendente", etc.)
// We use them to know the current state of subsequent rows? Actually each row
// already carries its own state, so we just skip group-header rows.
const GROUP_HEADERS = new Set([
  "Por contactar",
  "Pendente",
  "Tentativa de contacto",
  "Aceite",
  "Confirmado",
  "Rejeitado",
  "Subitems",
  "Subelementos",
  "Subelementos ",
]);

const parsed = {
  byCategory: {},
  uniqueStates: new Set(),
  uniqueActions: new Set(),
  uniqueComissao: new Set(),
  uniqueResponsavel: new Set(),
  totalPartners: 0,
  totalUpdates: 0,
};

for (const { file, category } of FILES) {
  const wb = XLSX.readFile(path.join("public", file));
  const mainSheetName = wb.SheetNames[0];
  const updatesSheetName = wb.SheetNames[1];

  const mainRows = XLSX.utils.sheet_to_json(wb.Sheets[mainSheetName], {
    defval: null,
    raw: false,
  });

  // First col key changes per file (emoji prefix). Find the actual first col key.
  const firstColKey = Object.keys(mainRows[0] || {})[0];

  const partners = [];
  for (const row of mainRows) {
    const name = row[firstColKey];
    if (!name) continue;
    if (GROUP_HEADERS.has(String(name).trim())) continue;
    if (String(name).trim() === "Name") continue; // header row

    const itemId = row[COLS.item_id];
    const estado = row[COLS.estado];
    const acoes = row[COLS.acoes];
    const comissao = row[COLS.comissao];
    const responsavel = row[COLS.responsavel];

    if (estado) parsed.uniqueStates.add(estado);
    if (acoes) parsed.uniqueActions.add(acoes);
    if (comissao) parsed.uniqueComissao.add(comissao);
    if (responsavel) parsed.uniqueResponsavel.add(responsavel);

    partners.push({
      monday_id: itemId ? String(itemId).trim() : null,
      name: String(name).trim(),
      estado_raw: estado,
      acoes_raw: acoes,
      email: row[COLS.email] || null,
      telemovel: row[COLS.telemovel] || null,
      responsavel: responsavel || null,
      notas: row[COLS.notas] || null,
      local: row[COLS.local] || null,
      link: row[COLS.link] || null,
      comissao_raw: comissao,
      data_agendada: row[COLS.data_agendada] || null,
    });
  }

  // ---- updates sheet ----
  const updatesRows = XLSX.utils.sheet_to_json(wb.Sheets[updatesSheetName], {
    defval: null,
    raw: false,
  });
  // First col is Item ID, second is Item Name, then __EMPTY_n
  const upFirstKey = Object.keys(updatesRows[0] || {})[0];
  const updates = [];
  for (const row of updatesRows) {
    const itemId = row[upFirstKey];
    if (!itemId || itemId === "Item ID") continue;
    updates.push({
      monday_id: String(itemId).trim(),
      item_name: row["Updates"],
      content_type_a: row["__EMPTY"],
      content_type_b: row["__EMPTY_1"],
      user: row["__EMPTY_2"],
      created_at: row["__EMPTY_3"],
      content: row["__EMPTY_4"],
      post_id: row["__EMPTY_7"],
      parent_post_id: row["__EMPTY_8"],
    });
  }

  parsed.byCategory[category] = { partners, updates };
  parsed.totalPartners += partners.length;
  parsed.totalUpdates += updates.length;
}

const summary = {
  totals: {
    partners: parsed.totalPartners,
    updates: parsed.totalUpdates,
    by_category: Object.fromEntries(
      Object.entries(parsed.byCategory).map(([k, v]) => [
        k,
        { partners: v.partners.length, updates: v.updates.length },
      ])
    ),
  },
  uniqueStates: [...parsed.uniqueStates].sort(),
  uniqueActions: [...parsed.uniqueActions].sort(),
  uniqueComissao: [...parsed.uniqueComissao].sort(),
  uniqueResponsavel: [...parsed.uniqueResponsavel].sort(),
};

console.log("\n========= SUMMARY =========");
console.log(JSON.stringify(summary, null, 2));

fs.writeFileSync(
  "scripts/_monday-parceiros-parsed.json",
  JSON.stringify(parsed.byCategory, null, 2)
);
console.log("\nFull parsed data → scripts/_monday-parceiros-parsed.json");
