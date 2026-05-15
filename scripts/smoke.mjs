#!/usr/bin/env node
// ============================================================
// FBR Admin — smoke test
// ============================================================
// Boota o servidor (`next start` ou `next dev`) e visita as páginas
// críticas com um browser headless. Falha (exit 1) se alguma página:
//   - der `pageerror` (excepções React/JS)
//   - mostrar texto típico de Next.js "page couldn't load"
//   - emitir `console.error` (erros minified incluídos)
//
// Pré-requisitos:
//   npm i -D playwright
//   npx playwright install chromium
//
// Como usar:
//   1) Em terminal 1: npm run start  (ou npm run dev)
//   2) Em terminal 2: node scripts/smoke.mjs
//
// Variáveis opcionais:
//   SMOKE_BASE_URL    — base URL (default http://localhost:3000)
//   SMOKE_EMAIL       — email para login (Supabase auth)
//   SMOKE_PASSWORD    — password do utilizador de smoke
//   SMOKE_ORDER_ID    — id de uma encomenda para testar o workbench
//   SMOKE_VOUCHER_ID  — id de um vale
//   SMOKE_PARTNER_ID  — id de um parceiro
//
// Se SMOKE_EMAIL não estiver definido, só testa rotas públicas (login).
// ============================================================

import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

const PUBLIC_PATHS = ["/login"];
const ADMIN_PATHS = [
  "/",
  "/preservacao",
  "/vale-presente",
  "/parcerias",
  "/financas",
  "/metricas",
  "/entregas-recolhas",
  "/status",
  "/livro-receitas",
  "/ideias",
  "/settings/audit",
];

if (process.env.SMOKE_ORDER_ID) ADMIN_PATHS.push(`/preservacao/${process.env.SMOKE_ORDER_ID}`);
if (process.env.SMOKE_VOUCHER_ID) ADMIN_PATHS.push(`/vale-presente/${process.env.SMOKE_VOUCHER_ID}`);
if (process.env.SMOKE_PARTNER_ID) ADMIN_PATHS.push(`/parcerias/${process.env.SMOKE_PARTNER_ID}`);

const ERROR_PATTERNS = [
  /This page couldn['']t load/i,
  /Application error/i,
  /Internal Server Error/i,
  /Minified React error/i,
];

async function checkPage(page, url, label) {
  const issues = [];

  const onPageError = (err) => {
    issues.push(`pageerror: ${err.message}`);
  };
  const onConsole = (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignora 404s de fontes/imagens — não invalidam a página
      if (text.includes("Failed to load resource")) return;
      issues.push(`console.error: ${text}`);
    }
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (response && response.status() >= 500) {
      issues.push(`HTTP ${response.status()}`);
    }
    // Pequeno wait para hooks de render dispararem
    await page.waitForTimeout(1500);
    const body = await page.content();
    for (const pat of ERROR_PATTERNS) {
      if (pat.test(body)) issues.push(`body matches ${pat}`);
    }
  } catch (err) {
    issues.push(`navigation: ${err.message}`);
  }

  page.off("pageerror", onPageError);
  page.off("console", onConsole);

  if (issues.length === 0) {
    console.log(`✓ ${label}  ${url}`);
    return true;
  }
  console.log(`✗ ${label}  ${url}`);
  for (const i of issues) console.log(`     ${i}`);
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let allOk = true;

  for (const p of PUBLIC_PATHS) {
    const ok = await checkPage(page, `${BASE}${p}`, "public ");
    if (!ok) allOk = false;
  }

  if (EMAIL && PASSWORD) {
    // Login via formulário do /login
    await page.goto(`${BASE}/login`);
    await page.waitForTimeout(500);
    // O login da FBR usa Netflix-style avatar; clica no card com data-email ou
    // tenta um link que contenha o email. Adapta a tua UI:
    const avatar = page.locator(`[data-email="${EMAIL}"]`);
    if (await avatar.count()) {
      await avatar.first().click();
    }
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });

    for (const p of ADMIN_PATHS) {
      const ok = await checkPage(page, `${BASE}${p}`, "admin  ");
      if (!ok) allOk = false;
    }
  } else {
    console.log("ℹ SMOKE_EMAIL/SMOKE_PASSWORD não definidos — rotas admin saltadas.");
  }

  await browser.close();
  if (!allOk) {
    console.error("\n❌ Smoke test FALHOU. NÃO faças push antes de corrigir.");
    process.exit(1);
  }
  console.log("\n✅ Smoke test OK.");
}

main().catch((err) => {
  console.error("Erro inesperado no smoke test:", err);
  process.exit(1);
});
