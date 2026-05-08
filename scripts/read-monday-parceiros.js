/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require("xlsx");
const path = require("path");

const files = [
  "Wedding_Planners_1778232249.xlsx",
  "Floristas_1778232269.xlsx",
  "Quintas_de_Eventos_1778232283.xlsx",
  "Outros_contactos_1778232307.xlsx",
];

for (const f of files) {
  const wb = XLSX.readFile(path.join("public", f));
  console.log("\n========================================");
  console.log("FILE:", f);
  console.log("Sheets:", wb.SheetNames);
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
    console.log(`\n-- Sheet: "${sheetName}" — rows: ${rows.length}`);
    if (rows.length > 0) {
      console.log("Columns:", Object.keys(rows[0]));
      console.log("First 3 rows:");
      console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    }
  }
}
