// app/api/reservar-preservacao/route.js
// ============================================================
// Recebe os dados do formulário de reserva de preservação e cria
// uma encomenda na base de dados do admin (Supabase).
//
// Histórico:
//   - até 2026-05-08: gravava no Monday.com via GraphQL.
//   - 2026-05-08+ : grava directamente em `orders` (Supabase),
//     que é a fonte de verdade do admin.floresabeirario.pt.
//
// Mantém intactas as protecções existentes:
//   • honeypot (campo "website")
//   • rate limit (5 pedidos/IP/min, in-memory)
//   • validações server-side (email, telefone, datas, max length)
//   • notificação interna por email (Resend) — opcional, depende
//     de a env var RESEND_API_KEY estar definida.
//
// Adicionados nesta migração:
//   • RGPD: persistência do consentimento (consent_at + version + ip).
//   • Cloudflare Turnstile (opcional, activa via TURNSTILE_SECRET).
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
import { mapReservaToOrder } from "@/app/_lib/supabase-mappings";
import { verifyTurnstile } from "@/app/_lib/turnstile";

const isRateLimited = createRateLimiter();

// ─── Limites de comprimento para campos de texto livre ────────────────────────
const MAX_LENGTHS = {
  nome:                200,
  email:               200,
  telefone:            30,
  nomeNoivos:          300,
  localEvento:         300,
  tipoFlores:          1000,
  elementosExtraOutro: 500,
  notasAdicionais:     2000,
  comoConheceuOutro:   1000,
  nomeFlorista:        300,
  codigoValePresente:  20,
};

export async function POST(request) {
  try {
    // ── Variáveis de ambiente obrigatórias ──────────────────────────────────
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error("[reservar-preservacao] SUPABASE_URL/ANON_KEY not set");
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

    // ── Honeypot anti-spam ──────────────────────────────────────────────────
    // O campo "website" é invisível para humanos; bots costumam preenchê-lo.
    // Retorna sucesso silencioso para não alertar o bot.
    if (data.website) {
      return NextResponse.json({ success: true });
    }

    // ── Cloudflare Turnstile (opcional) ─────────────────────────────────────
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

    const overLimit = exceedsLength(data, MAX_LENGTHS);
    if (overLimit) {
      return NextResponse.json(
        { error: `O campo "${overLimit}" excede o comprimento máximo permitido.` },
        { status: 400 }
      );
    }

    if (data.dataEvento) {
      const year = parseInt(data.dataEvento.split("-")[0], 10);
      if (isNaN(year) || year > 9999 || year < 1900) {
        return NextResponse.json(
          { error: "Data do evento inválida." },
          { status: 400 }
        );
      }
    }

    // RGPD — checkbox de Termos e Condições é obrigatória pelo form,
    // mas validamos também aqui para defesa em profundidade.
    if (data.termosCondicoes !== true) {
      return NextResponse.json(
        { error: "Tem de aceitar os Termos e Condições para continuar." },
        { status: 400 }
      );
    }

    console.log("[reservar-preservacao] new submission from:", ip);

    // ── Mapeia e insere ─────────────────────────────────────────────────────
    const { payload, errors } = mapReservaToOrder(data, { ip });
    if (errors.length) {
      console.error("[reservar-preservacao] mapping errors:", errors);
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
      .from("orders")
      .insert(payload)
      .select("id, order_id")
      .single();

    if (dbError) {
      console.error("[reservar-preservacao] supabase error:", dbError);
      return NextResponse.json(
        { error: "Erro ao registar a reserva. Tente novamente em instantes." },
        { status: 500 }
      );
    }

    // ── Notificação por e-mail (Resend) ─────────────────────────────────────
    // Falha silenciosamente se a chave não estiver configurada.
    if (process.env.RESEND_API_KEY) {
      const e = (v) =>
        escapeHtml(!v || (Array.isArray(v) && !v.length) ? "—" : Array.isArray(v) ? v.join(", ") : v);

      const idiomaLabel = data.locale === "en" ? "Inglês" : "Português";

      const linhas = [
        `<tr><td><strong>ID</strong></td><td><code>${escapeHtml(inserted.order_id)}</code></td></tr>`,
        `<tr><td><strong>Idioma da reserva</strong></td><td>${idiomaLabel}</td></tr>`,
        `<tr><td><strong>Nome</strong></td><td>${e(data.nome)}</td></tr>`,
        `<tr><td><strong>Meio de contacto</strong></td><td>${e(data.meioContacto)}</td></tr>`,
        `<tr><td><strong>E-mail</strong></td><td>${e(data.email)}</td></tr>`,
        `<tr><td><strong>Telefone</strong></td><td>${e(data.telefone)}</td></tr>`,
        `<tr><td><strong>Data do evento</strong></td><td>${e(data.dataEvento)}</td></tr>`,
        `<tr><td><strong>Tipo de evento</strong></td><td>${e(data.tipoEvento)}</td></tr>`,
        data.nomeNoivos ? `<tr><td><strong>Noivos</strong></td><td>${e(data.nomeNoivos)}</td></tr>` : "",
        `<tr><td><strong>Local do evento</strong></td><td>${e(data.localEvento)}</td></tr>`,
        `<tr><td><strong>Tipo de flores</strong></td><td>${e(data.tipoFlores)}</td></tr>`,
        `<tr><td><strong>Como enviar flores</strong></td><td>${e(data.comoEnviarFlores)}</td></tr>`,
        `<tr><td><strong>Como receber quadro</strong></td><td>${e(data.comoReceberQuadro)}</td></tr>`,
        `<tr><td><strong>Tamanho da moldura</strong></td><td>${e(data.tamanhoMoldura)}</td></tr>`,
        `<tr><td><strong>Tipo de fundo</strong></td><td>${e(data.tipoFundo)}</td></tr>`,
        `<tr><td><strong>Elementos extra</strong></td><td>${e(data.elementosExtra)}</td></tr>`,
        data.elementosExtraOutro ? `<tr><td><strong>Detalhe elemento extra</strong></td><td>${e(data.elementosExtraOutro)}</td></tr>` : "",
        `<tr><td><strong>Quadros extra</strong></td><td>${e(data.quadrosExtra)}</td></tr>`,
        data.quantosQuadros ? `<tr><td><strong>Quantos quadros extra</strong></td><td>${e(data.quantosQuadros)}</td></tr>` : "",
        `<tr><td><strong>Ornamentos de Natal</strong></td><td>${e(data.ornamentosNatal)}</td></tr>`,
        data.quantosOrnamentos ? `<tr><td><strong>Quantos ornamentos</strong></td><td>${e(data.quantosOrnamentos)}</td></tr>` : "",
        `<tr><td><strong>Pendentes</strong></td><td>${e(data.pendentes)}</td></tr>`,
        data.quantosPendentes ? `<tr><td><strong>Quantos pendentes</strong></td><td>${e(data.quantosPendentes)}</td></tr>` : "",
        `<tr><td><strong>Como conheceu</strong></td><td>${e(data.comoConheceu)}</td></tr>`,
        data.nomeFlorista ? `<tr><td><strong>Nome da florista</strong></td><td>${e(data.nomeFlorista)}</td></tr>` : "",
        data.comoConheceuOutro ? `<tr><td><strong>Como conheceu (detalhe)</strong></td><td>${e(data.comoConheceuOutro)}</td></tr>` : "",
        data.codigoValePresente ? `<tr><td><strong>Código Vale-Presente</strong></td><td><code>${e(data.codigoValePresente)}</code></td></tr>` : "",
        data.notasAdicionais ? `<tr><td><strong>Notas adicionais</strong></td><td>${e(data.notasAdicionais)}</td></tr>` : "",
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
            subject: `Nova pré-reserva de preservação | ${data.nome}`,
            html: `<h2 style="font-family:sans-serif;color:#5A1E38;">Nova pré-reserva de preservação</h2>
<p style="font-family:sans-serif;font-size:13px;color:#666;">
  Veja no admin: <a href="https://admin.floresabeirario.pt/preservacao/${escapeHtml(inserted.order_id)}">${escapeHtml(inserted.order_id)}</a>
</p>
<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:600px;">
  <tbody style="line-height:1.7;">${linhas}</tbody>
</table>`,
          }),
        });
      } catch (emailErr) {
        console.error("[reservar-preservacao] email error:", emailErr);
      }
    }

    return NextResponse.json({ success: true, orderId: inserted.order_id });
  } catch (err) {
    console.error("Reservar preservacao route error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
