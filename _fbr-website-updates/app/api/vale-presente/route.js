// app/api/vale-presente/route.js
// ============================================================
// Recebe os dados do formulário de Vale-Presente e cria um vale
// na base de dados do admin (Supabase, tabela `vouchers`).
//
// Histórico:
//   - até 2026-05-08: gravava no Monday.com via GraphQL.
//   - 2026-05-08+ : grava em `vouchers` (Supabase), partilhada com
//     o admin (admin.floresabeirario.pt) e com o site público de
//     consulta (voucher.floresabeirario.pt).
//
// O código de 6 caracteres do vale é gerado automaticamente por
// trigger BD (`generate_voucher_code()`), garantindo unicidade.
//
// Mantém intactas:
//   • honeypot (campo "website")
//   • rate limit (5 pedidos/IP/min)
//   • validações server-side
//   • notificação Resend interna (se RESEND_API_KEY existir)
// ============================================================

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import {
  escapeHtml,
  createRateLimiter,
  exceedsLength,
} from "@/app/_lib/api-helpers";
import { EMAIL } from "@/app/_lib/constants";
import { mapValeToVoucher } from "@/app/_lib/supabase-mappings";
import { verifyTurnstile } from "@/app/_lib/turnstile";

const isRateLimited = createRateLimiter();

const MAX_LENGTHS = {
  nome:               200,
  email:              200,
  telefone:           30,
  nomeDestinatario:   200,
  mensagem:           1000,
  morada:             500,
  comentarios:        2000,
  comoConheceuOutro:  1000,
  nomeFlorista:       300,
};

export async function POST(request) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error("[vale-presente] SUPABASE_URL/ANON_KEY not set");
      return NextResponse.json(
        { error: "Configuração em falta no servidor." },
        { status: 500 }
      );
    }

    // ── Rate limiting ───────────────────────────────────────────────────────
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Demasiados pedidos. Por favor aguarde um momento." },
        { status: 429 }
      );
    }

    const data = await request.json();

    // ── Honeypot ────────────────────────────────────────────────────────────
    if (data.website) {
      return NextResponse.json({ success: true });
    }

    // ── Turnstile (opcional) ────────────────────────────────────────────────
    const turnstileOk = await verifyTurnstile(data.turnstileToken, ip);
    if (!turnstileOk) {
      return NextResponse.json(
        { error: "Verificação anti-spam falhou. Recarregue a página e tente novamente." },
        { status: 400 }
      );
    }

    // ── Validação server-side ───────────────────────────────────────────────
    if (!data.nome?.trim() || !data.email?.trim()) {
      return NextResponse.json(
        { error: "Campos obrigatórios em falta." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return NextResponse.json(
        { error: "Endereço de e-mail inválido." },
        { status: 400 }
      );
    }

    if (data.telefone && !/^\+?[\d\s\-]{5,30}$/.test(data.telefone)) {
      return NextResponse.json(
        { error: "Número de telefone inválido." },
        { status: 400 }
      );
    }

    if (data.valorVale !== undefined && data.valorVale !== "") {
      const val = Number(data.valorVale);
      if (isNaN(val) || val < 300 || val > 100_000) {
        return NextResponse.json(
          { error: "Valor do vale inválido." },
          { status: 400 }
        );
      }
    }

    const overLimit = exceedsLength(data, MAX_LENGTHS);
    if (overLimit) {
      return NextResponse.json(
        { error: `O campo "${overLimit}" excede o comprimento máximo permitido.` },
        { status: 400 }
      );
    }

    if (data.dataEnvio) {
      const year = parseInt(data.dataEnvio.split("-")[0], 10);
      if (isNaN(year) || year < 2020 || year > 2099) {
        return NextResponse.json(
          { error: "Data de envio inválida." },
          { status: 400 }
        );
      }
    }

    console.log("[vale-presente] new submission from:", ip);

    const { payload, errors } = mapValeToVoucher(data, { ip });
    if (errors.length) {
      console.error("[vale-presente] mapping errors:", errors);
      return NextResponse.json(
        { error: `Valores inválidos em: ${errors.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );

    const { data: inserted, error: dbError } = await supabase
      .from("vouchers")
      .insert(payload)
      .select("id, code")
      .single();

    if (dbError) {
      console.error("[vale-presente] supabase error:", dbError);
      return NextResponse.json(
        { error: "Erro ao registar o vale. Tente novamente em instantes." },
        { status: 500 }
      );
    }

    // ── Notificação por e-mail (Resend) ─────────────────────────────────────
    if (process.env.RESEND_API_KEY) {
      const e = (v) => escapeHtml(!v ? "—" : v);

      const idiomaLabel = data.locale === "en" ? "Inglês" : "Português";

      const linhas = [
        `<tr><td><strong>Código</strong></td><td><code>${escapeHtml(inserted.code)}</code></td></tr>`,
        `<tr><td><strong>Idioma da reserva</strong></td><td>${idiomaLabel}</td></tr>`,
        `<tr><td><strong>Nome</strong></td><td>${e(data.nome)}</td></tr>`,
        `<tr><td><strong>Meio de contacto</strong></td><td>${e(data.meioContacto)}</td></tr>`,
        `<tr><td><strong>E-mail</strong></td><td>${e(data.email)}</td></tr>`,
        data.telefone ? `<tr><td><strong>Telefone</strong></td><td>${e(data.telefone)}</td></tr>` : "",
        `<tr><td><strong>Destinatário</strong></td><td>${e(data.nomeDestinatario)}</td></tr>`,
        data.mensagem ? `<tr><td><strong>Mensagem personalizada</strong></td><td>${e(data.mensagem)}</td></tr>` : "",
        `<tr><td><strong>Valor do vale</strong></td><td>${e(data.valorVale)}€</td></tr>`,
        `<tr><td><strong>Entrega</strong></td><td>${e(data.entrega)}</td></tr>`,
        `<tr><td><strong>Tipo de vale</strong></td><td>${e(data.tipoVale)}</td></tr>`,
        data.entregaRemetenteComo ? `<tr><td><strong>Como receber (remetente)</strong></td><td>${e(data.entregaRemetenteComo)}</td></tr>` : "",
        data.morada ? `<tr><td><strong>Morada</strong></td><td>${e(data.morada)}</td></tr>` : "",
        data.contactoDestinatario ? `<tr><td><strong>Contacto destinatário</strong></td><td>${e(data.contactoDestinatario)}</td></tr>` : "",
        data.dataEnvio ? `<tr><td><strong>Data de envio</strong></td><td>${e(data.dataEnvio)}</td></tr>` : "",
        data.comentarios ? `<tr><td><strong>Comentários</strong></td><td>${e(data.comentarios)}</td></tr>` : "",
        `<tr><td><strong>Como conheceu</strong></td><td>${e(data.comoConheceu)}</td></tr>`,
        data.nomeFlorista ? `<tr><td><strong>Nome da florista</strong></td><td>${e(data.nomeFlorista)}</td></tr>` : "",
        data.comoConheceuOutro ? `<tr><td><strong>Como conheceu (detalhe)</strong></td><td>${e(data.comoConheceuOutro)}</td></tr>` : "",
      ].filter(Boolean).join("\n");

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Flores à Beira-Rio <noreply@floresabeirario.pt>",
            to: [EMAIL],
            subject: `Novo pedido de vale presente | ${data.nome}`,
            html: `<h2 style="font-family:sans-serif;color:#3A4A78;">Novo pedido de vale presente</h2>
<p style="font-family:sans-serif;font-size:13px;color:#666;">
  Veja no admin: <a href="https://admin.floresabeirario.pt/vale-presente/${escapeHtml(inserted.code)}">${escapeHtml(inserted.code)}</a>
</p>
<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:600px;">
  <tbody style="line-height:1.7;">${linhas}</tbody>
</table>`,
          }),
        });
      } catch (emailErr) {
        console.error("[vale-presente] email error:", emailErr);
      }
    }

    return NextResponse.json({ success: true, code: inserted.code });
  } catch (err) {
    console.error("Vale presente route error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
