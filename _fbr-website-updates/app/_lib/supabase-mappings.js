// app/_lib/supabase-mappings.js
// ============================================================
// Mapeia os "valor" dos formulários públicos (PT/EN) para os
// enums internos da base de dados Supabase (admin.floresabeirario.pt).
//
// Os ficheiros messages/pt.json e messages/en.json partilham o
// mesmo `valor` (em PT) — o `label` é que muda. Por isso este
// mapping é monolingue: chave = string PT.
//
// Server-only (não importar do browser).
// ============================================================

// ── Reserva de Preservação ──────────────────────────────────

const MEIO_CONTACTO = {
  "E-mail":   "email",
  "WhatsApp": "whatsapp",
};

const COMO_ENVIAR_FLORES = {
  "Entrega em mãos em Coimbra":                                                                 "maos",
  "Envio por CTT/transportadora para o estúdio (custos a cargo do cliente)":                    "ctt",
  "Recolha no evento por parte da Flores à Beira-Rio - mediante orçamento e disponibilidade":   "recolha_evento",
  "Ainda não sei":                                                                              "nao_sei",
};

const COMO_RECEBER_QUADRO = {
  "Recolha em mãos em Coimbra":                                            "maos",
  "Envio por transportadora/CTT para morada (custos a cargo do cliente)":  "ctt",
  "Ainda não sei":                                                         "nao_sei",
};

const TAMANHO_MOLDURA = {
  "30x40cm":         "30x40",
  "40x50cm":         "40x50",
  "50x70cm":         "50x70",
  "Ainda não sei":   "nao_sei",
};

const TIPO_FUNDO = {
  "Transparente (vidro sobre vidro)":                  "transparente",
  "Preto":                                             "preto",
  "Branco":                                            "branco",
  "Fotografia (custo adicional da impressão profissional)": "fotografia",
  "Cor":                                               "cor",
  "Gostaria que fossem vocês a escolher":              "voces_a_escolher",
  "Ainda não sei":                                     "nao_sei",
};

const SIM_NAO_INFO = {
  "Não, apenas o quadro principal":              "nao",
  "Sim, quero acrescentar quadros extra":        "sim",
  "Sim, gostaria de acrescentar ornamentos de natal": "sim",
  "Sim, gostaria de acrescentar pendentes":      "sim",
  "Gostava de receber mais informações":         "mais_info",
};

const COMO_CONHECEU_RESERVA = {
  "Ofereceram-me um Vale-Presente para preservação":                       "vale_presente",
  "Através do Instagram":                                                  "instagram",
  "Através do Facebook":                                                   "facebook",
  "Através do casamentos.pt":                                              "casamentos_pt",
  "Pesquisa no Google":                                                    "google",
  "Recomendação de florista":                                              "florista",
  "Recomendação de alguém que já contratou o serviço anteriormente":       "recomendacao",
  "Outro (especificar abaixo)":                                            "outro",
};

// ── Vale-Presente ───────────────────────────────────────────

const VALE_MEIO_CONTACTO = MEIO_CONTACTO;

const VALE_DELIVERY_RECIPIENT = {
  "remetente":    "remetente",
  "destinatario": "destinatario",
};

const VALE_DELIVERY_FORMAT = {
  "digital": "digital",
  "fisico":  "fisico",
};

// O contacto digital pode ser email ou whatsapp — inferido do conteúdo
// do contactoDestinatario (se inclui "@", é email; senão whatsapp).
function inferDeliveryChannel(contactoDestinatario) {
  if (!contactoDestinatario) return null;
  return contactoDestinatario.includes("@") ? "email" : "whatsapp";
}

const VALE_COMO_CONHECEU = {
  "recomendacao-cliente": "recomendacao",
  "instagram":            "instagram",
  "facebook":             "facebook",
  "casamentos":           "casamentos_pt",
  "google":               "google",
  "florista":             "florista",
  "outro":                "outro",
};

// ── Helpers públicos ────────────────────────────────────────

function lookup(map, value) {
  if (!value) return null;
  return map[value] ?? null;
}

/**
 * Constrói o payload para INSERT em `orders` a partir do body do form
 * de Reserva de Preservação. Devolve `{ payload, errors }` onde
 * `errors` é um array vazio se tudo OK; caso contrário lista nomes
 * de campos inválidos.
 */
export function mapReservaToOrder(data, { ip } = {}) {
  const errors = [];

  // Telefone: o front-end já junta indicativo (+351) com número.
  const phone = (data.telefone || "").trim() || null;

  // Email obrigatório (já validado a montante)
  const email = (data.email || "").trim() || null;

  // Mapeamentos
  const contact_preference     = lookup(MEIO_CONTACTO,         data.meioContacto);
  const flower_delivery_method = lookup(COMO_ENVIAR_FLORES,    data.comoEnviarFlores);
  const frame_delivery_method  = lookup(COMO_RECEBER_QUADRO,   data.comoReceberQuadro);
  const frame_size             = lookup(TAMANHO_MOLDURA,       data.tamanhoMoldura);
  const frame_background       = lookup(TIPO_FUNDO,            data.tipoFundo);
  const extra_small_frames     = lookup(SIM_NAO_INFO,          data.quadrosExtra);
  const christmas_ornaments    = lookup(SIM_NAO_INFO,          data.ornamentosNatal);
  const necklace_pendants      = lookup(SIM_NAO_INFO,          data.pendentes);
  const how_found_fbr          = lookup(COMO_CONHECEU_RESERVA, data.comoConheceu);

  if (data.meioContacto      && !contact_preference)     errors.push("meioContacto");
  if (data.comoEnviarFlores  && !flower_delivery_method) errors.push("comoEnviarFlores");
  if (data.comoReceberQuadro && !frame_delivery_method)  errors.push("comoReceberQuadro");
  if (data.tamanhoMoldura    && !frame_size)             errors.push("tamanhoMoldura");
  if (data.tipoFundo         && !frame_background)       errors.push("tipoFundo");
  if (data.quadrosExtra      && !extra_small_frames)     errors.push("quadrosExtra");
  if (data.ornamentosNatal   && !christmas_ornaments)    errors.push("ornamentosNatal");
  if (data.pendentes         && !necklace_pendants)      errors.push("pendentes");
  if (data.comoConheceu      && !how_found_fbr)          errors.push("comoConheceu");

  // Quantidades (números positivos opcionais)
  const toIntOrNull = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  };

  // "how_found_fbr_other" usa-se também para o nome da florista,
  // mantendo simetria com a UI do admin (sessão 15).
  let how_found_fbr_other = null;
  if (how_found_fbr === "florista") {
    how_found_fbr_other = (data.nomeFlorista || "").trim() || null;
    if (!how_found_fbr_other) errors.push("nomeFlorista");
  } else if (how_found_fbr === "outro") {
    how_found_fbr_other = (data.comoConheceuOutro || "").trim() || null;
  }

  // extras_in_frame: lista PT directamente + nota opcional
  const extras_options = Array.isArray(data.elementosExtra)
    ? data.elementosExtra.filter((s) => typeof s === "string" && s.trim())
    : [];
  const extras_in_frame = {
    options: extras_options,
    notes:   (data.elementosExtraOutro || "").trim(),
  };

  const payload = {
    // Cliente
    client_name:       (data.nome || "").trim(),
    contact_preference,
    email,
    phone,
    event_date:        data.dataEvento || null,
    flower_type:       (data.tipoFlores || "").trim() || null,
    flower_delivery_method,
    frame_delivery_method,
    frame_size,
    frame_background,
    extras_in_frame,
    extra_small_frames,
    extra_small_frames_qty:    toIntOrNull(data.quantosQuadros),
    christmas_ornaments,
    christmas_ornaments_qty:   toIntOrNull(data.quantosOrnamentos),
    necklace_pendants,
    necklace_pendants_qty:     toIntOrNull(data.quantosPendentes),
    how_found_fbr,
    how_found_fbr_other,
    additional_notes:   (data.notasAdicionais || "").trim() || null,
    form_language:      data.locale === "en" ? "en" : "pt",

    // RGPD
    consent_at:         new Date().toISOString(),
    consent_version:    "1.0-explicit",
    consent_ip:         ip || null,

    // Os campos administrativos (status, payment_status, contacted,
    // manually_no_response, etc.) ficam ao seu DEFAULT da BD —
    // a policy `orders_public_insert` exige isto.
  };

  return { payload, errors };
}

/**
 * Constrói o payload para INSERT em `vouchers` a partir do body do
 * form de Vale-Presente.
 */
export function mapValeToVoucher(data, { ip } = {}) {
  const errors = [];

  const sender_contact_pref = lookup(VALE_MEIO_CONTACTO, data.meioContacto);
  const delivery_recipient  = lookup(VALE_DELIVERY_RECIPIENT, data.entrega);
  const delivery_format     = lookup(VALE_DELIVERY_FORMAT, data.tipoVale);
  const how_found_fbr       = lookup(VALE_COMO_CONHECEU, data.comoConheceu);

  if (data.meioContacto && !sender_contact_pref) errors.push("meioContacto");
  if (data.entrega      && !delivery_recipient)  errors.push("entrega");
  if (data.tipoVale     && !delivery_format)     errors.push("tipoVale");
  if (data.comoConheceu && !how_found_fbr)       errors.push("comoConheceu");

  // delivery_channel só faz sentido em digital
  let delivery_channel = null;
  if (delivery_format === "digital" && delivery_recipient === "destinatario") {
    delivery_channel = inferDeliveryChannel(data.contactoDestinatario);
  } else if (delivery_format === "digital" && delivery_recipient === "remetente") {
    // Quando é digital e vai para o próprio remetente, herda o meio de contacto.
    delivery_channel = sender_contact_pref;
  }

  // Validade (admin) — vouchers tem default `current_date + 2 years` na BD.
  // Não definimos aqui; deixamos a BD aplicar.

  // Notas adicionais sobre destinatário (morada / contacto / data ideal)
  // Mapeiam para campos da 011_vouchers_fix_and_extra_fields.sql:
  //   recipient_contact, recipient_address, ideal_send_date
  const recipient_contact = (data.contactoDestinatario || "").trim() || null;
  const recipient_address = (data.morada               || "").trim() || null;
  const ideal_send_date   =  data.dataEnvio || null;

  // how_found_fbr_other: usa nomeFlorista quando comoConheceu="florista";
  // caso contrário, comoConheceuOutro.
  let how_found_fbr_other = null;
  if (how_found_fbr === "florista") {
    how_found_fbr_other = (data.nomeFlorista || "").trim() || null;
    if (!how_found_fbr_other) errors.push("nomeFlorista");
  } else if (how_found_fbr === "outro") {
    how_found_fbr_other = (data.comoConheceuOutro || "").trim() || null;
  }

  // Valor — já validado a montante (mín. 300, máx. 100k)
  const amount = data.valorVale ? Number(data.valorVale) : null;

  const payload = {
    // Remetente
    sender_name:           (data.nome || "").trim(),
    sender_contact_pref,
    sender_email:          (data.email || "").trim() || null,
    sender_phone:          (data.telefone || "").trim() || null,

    // O vale
    recipient_name:        (data.nomeDestinatario || "").trim(),
    message:               (data.mensagem || "").trim() || null,
    amount,

    // Entrega
    delivery_recipient,
    delivery_format,
    delivery_channel,
    recipient_contact,
    recipient_address,
    ideal_send_date,

    // Outros
    comments:              (data.comentarios || "").trim() || null,
    how_found_fbr,
    how_found_fbr_other,
    form_language:         data.locale === "en" ? "en" : "pt",

    // RGPD — o form de vale ainda não tem checkbox dedicada de termos,
    // por isso marcamos como "implicit" (TODO: adicionar checkbox).
    consent_at:            new Date().toISOString(),
    consent_version:       "1.0-implicit",
    consent_ip:            ip || null,
  };

  return { payload, errors };
}
