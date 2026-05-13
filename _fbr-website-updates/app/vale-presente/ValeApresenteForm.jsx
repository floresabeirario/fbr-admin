"use client";

import { useState, useRef, useId, isValidElement, cloneElement } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import PhonePrefix from "../_components/PhonePrefix";
import { OPCOES_PRECOS_URL } from "../_lib/constants";

const INIT = {
  nome: "",
  meioContacto: "",
  telefoneIndicativo: "+351",
  telefone: "",
  email: "",
  nomeDestinatario: "",
  mensagem: "",
  valorVale: "",
  entrega: "",
  tipoVale: "",
  entregaRemetenteComo: "",
  morada: "",
  contactoDestinatario: "",
  contactoDestinatarioTipo: "email", // "email" | "whatsapp"
  contactoDestinatarioIndicativo: "+351",
  contactoDestinatarioNumero: "",
  dataEnvio: "",
  comentarios: "",
  comoConheceu: "",
  comoConheceuOutro: "",
  nomeFlorista: "",
  // Honeypot — invisível para humanos, bots costumam preencher
  website: "",
};

// ─── Field component ────────────────────────────────────────────────────────
function Field({ label, required, hint, error, children, as: Tag }) {
  const autoId = useId();

  if (Tag === "fieldset") {
    return (
      <fieldset className="vf-group vf-fieldset-group">
        <legend className="vf-label vf-legend">
          {label}
          {required && <span className="vf-req" aria-hidden="true"> *</span>}
        </legend>
        {hint && <p className="vf-hint">{hint}</p>}
        {children}
        {error && <p className="vf-error" role="alert">{error}</p>}
      </fieldset>
    );
  }

  const childType = isValidElement(children) ? children.type : null;
  const isFormControl = childType === "input" || childType === "select" || childType === "textarea";
  const enhanced = isFormControl ? cloneElement(children, { id: autoId }) : children;

  return (
    <div className="vf-group">
      <label
        className="vf-label"
        {...(isFormControl ? { htmlFor: autoId } : {})}
      >
        {label}
        {required && <span className="vf-req" aria-hidden="true"> *</span>}
      </label>
      {hint && <p className="vf-hint">{hint}</p>}
      {enhanced}
      {error && <p className="vf-error" role="alert">{error}</p>}
    </div>
  );
}

export default function ValeApresenteForm() {
  const t = useTranslations("formVale");
  const locale = useLocale();

  const meioContactoOpcoes     = t.raw("meioContactoOpcoes");
  const entregueAOpcoes        = t.raw("entregueAOpcoes");
  const tipoValeOpcoes         = t.raw("tipoValeOpcoes");
  const comoReceberFisicoOpcoes = t.raw("comoReceberFisicoOpcoes");
  const comoConheceuOpcoes     = t.raw("comoConheceuOpcoes");

  // Valores internos definidos nas traduções (iguais em PT e EN)
  const ENTREGA_REMETENTE   = entregueAOpcoes[0].valor;       // "remetente"
  const ENTREGA_DESTINATARIO = entregueAOpcoes[1].valor;      // "destinatario"
  const TIPO_FISICO         = tipoValeOpcoes[1].valor;        // "fisico"
  const TIPO_DIGITAL        = tipoValeOpcoes[0].valor;        // "digital"
  const RECEBER_CORREIO     = comoReceberFisicoOpcoes[1].valor; // "correio"
  const FLORISTA_VALOR      = comoConheceuOpcoes.find((o) => o.valor === "florista")?.valor ?? "florista";
  const OUTRO_VALOR         = comoConheceuOpcoes.find((o) => o.valor === "outro")?.valor ?? "outro";

  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [submitError, setSubmitError] = useState("");
  const successRef = useRef(null);

  const set = (key, val) => {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "meioContacto" && val !== "WhatsApp") next.telefone = "";
      if (key === "entrega" || key === "tipoVale") {
        next.entregaRemetenteComo = "";
        next.morada = "";
        next.contactoDestinatario = "";
        next.dataEnvio = "";
      }
      if (key === "entregaRemetenteComo" && val !== RECEBER_CORREIO) next.morada = "";
      if (key === "comoConheceu") {
        next.comoConheceuOutro = "";
        next.nomeFlorista = "";
      }
      return next;
    });
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const inp = (key) => ({
    value: form[key],
    onChange: (e) => set(key, e.target.value),
    className: `vf-input${errors[key] ? " vf-input-err" : ""}`,
  });

  const isFisico                  = form.tipoVale === TIPO_FISICO;
  const showTelefone              = form.meioContacto === "WhatsApp";
  const showEntregaRemetenteComo  = form.entrega === ENTREGA_REMETENTE && isFisico;
  const showMoradaRemetente       = showEntregaRemetenteComo && form.entregaRemetenteComo === RECEBER_CORREIO;
  const showMoradaDestinatario    = form.entrega === ENTREGA_DESTINATARIO && isFisico;
  const showMorada                = showMoradaRemetente || showMoradaDestinatario;
  const showContactoDestinatario  = form.entrega === ENTREGA_DESTINATARIO && form.tipoVale === TIPO_DIGITAL;
  const showDataEnvio             = showMorada || showContactoDestinatario;
  const showComoConheceuOutro     = form.comoConheceu === OUTRO_VALOR;
  const showNomeFlorista          = form.comoConheceu === FLORISTA_VALOR;
  const today = new Date().toISOString().split("T")[0];

  function validate() {
    const e = {};
    if (!form.nome.trim())      e.nome = t("erroCampoObrigatorio");
    if (!form.meioContacto)     e.meioContacto = t("erroEscolhaContacto");
    if (showTelefone && !form.telefone.trim()) e.telefone = t("erroCampoObrigatorio");
    else if (showTelefone && form.telefone.trim() && !/^\+?[\d\s\-]{7,20}$/.test(form.telefone))
      e.telefone = t("erroTelefoneInvalido");
    if (!form.email.trim())     e.email = t("erroCampoObrigatorio");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t("erroEmailInvalido");
    if (!form.nomeDestinatario.trim()) e.nomeDestinatario = t("erroCampoObrigatorio");
    if (!form.valorVale)        e.valorVale = t("erroCampoObrigatorio");
    else if (Number(form.valorVale) < 300)       e.valorVale = t("erroValorMin");
    else if (Number(form.valorVale) > 100_000)   e.valorVale = t("erroValorInvalido");
    if (!form.entrega)          e.entrega = t("erroCampoObrigatorio");
    if (!form.tipoVale)         e.tipoVale = t("erroCampoObrigatorio");
    if (showEntregaRemetenteComo && !form.entregaRemetenteComo) e.entregaRemetenteComo = t("erroCampoObrigatorio");
    if (showMorada && !form.morada.trim())                      e.morada = t("erroCampoObrigatorio");
    if (showContactoDestinatario) {
      if (form.contactoDestinatarioTipo === "whatsapp") {
        if (!form.contactoDestinatarioNumero.trim()) e.contactoDestinatario = t("erroCampoObrigatorio");
        else if (!/^[\d\s\-]{5,20}$/.test(form.contactoDestinatarioNumero)) e.contactoDestinatario = t("erroTelefoneInvalido");
      } else {
        if (!form.contactoDestinatario.trim()) e.contactoDestinatario = t("erroCampoObrigatorio");
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactoDestinatario)) e.contactoDestinatario = t("erroEmailInvalido");
      }
    }
    if (form.dataEnvio) {
      const year = parseInt(form.dataEnvio.split("-")[0], 10);
      if (isNaN(year) || year < 2020 || year > 2099) e.dataEnvio = t("erroDataInvalida");
    }
    if (!form.comoConheceu)     e.comoConheceu = t("erroCampoObrigatorio");
    if (showNomeFlorista && !form.nomeFlorista.trim()) e.nomeFlorista = t("erroCampoObrigatorio");
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector(".vf-input-err, [role='alert']")
        ?.closest(".vf-group, fieldset")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/vale-presente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          telefone: form.telefone.trim()
            ? `${form.telefoneIndicativo}${form.telefone.trim()}`
            : "",
          contactoDestinatario: form.contactoDestinatarioTipo === "whatsapp"
            ? (form.contactoDestinatarioNumero.trim()
              ? `${form.contactoDestinatarioIndicativo}${form.contactoDestinatarioNumero.trim()}`
              : "")
            : form.contactoDestinatario.trim(),
          locale,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const serverMsg = (json && (json.error || json.message)) || "";
        const err = new Error(serverMsg || "submit-failed");
        err.serverMsg = serverMsg;
        throw err;
      }
      setStatus("success");
      setTimeout(() => successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    } catch (err) {
      console.error("[vale-presente] submit error:", err);
      setSubmitError(err?.serverMsg || "");
      setStatus("error");
    }
  }

  if (status === "success") {
    const emailLabel = meioContactoOpcoes.find((o) => o.valor === "E-mail")?.label ?? "email";
    const contacto = form.meioContacto === "WhatsApp" ? "WhatsApp" : emailLabel;
    return (
      <div className="vf-success" role="status" ref={successRef}>
        <div className="vf-success-icon" aria-hidden="true">✓</div>
        <h2 className="vf-success-title">{t("successTitle")}</h2>
        <p className="vf-success-text">
          {t("successDesc", { contacto })}
        </p>
      </div>
    );
  }

  return (
    <form className="vale-form" onSubmit={handleSubmit} noValidate>
      <p className="vf-intro">
        {t("intro")}
      </p>

      {/* ── REMETENTE ── */}
      <div className="vf-section" role="group" aria-labelledby="sec-remetente">
        <h2 className="vf-section-title" id="sec-remetente">{t("secRemetente")}</h2>

        <Field label={t("nomeLabel")} required error={errors.nome}>
          <input type="text" {...inp("nome")} placeholder={t("nomePlaceholder")} autoComplete="name" />
        </Field>

        <Field label={t("contactoLabel")} required error={errors.meioContacto}>
          <select {...inp("meioContacto")}>
            <option value="">{t("escolha")}</option>
            {meioContactoOpcoes.map((o) => (
              <option key={o.valor} value={o.valor}>{o.label}</option>
            ))}
          </select>
        </Field>

        {showTelefone && (
          <Field label={t("telefoneLabel")} required error={errors.telefone}>
            <div className="vf-phone-wrap">
              <PhonePrefix
                value={form.telefoneIndicativo}
                onChange={(code) => set("telefoneIndicativo", code)}
                btnClassName="vf-input vf-phone-prefix"
              />
              <input
                type="tel"
                {...inp("telefone")}
                className={`vf-input vf-phone-number${errors.telefone ? " vf-input-err" : ""}`}
                placeholder={t("telefonePlaceholder")}
                autoComplete="tel-national"
              />
            </div>
          </Field>
        )}

        <Field
          label={t("emailLabel")}
          required
          error={errors.email}
          hint={showTelefone ? t("telefoneHint") : undefined}
        >
          <input type="email" {...inp("email")} placeholder={t("emailPlaceholder")} autoComplete="email" />
        </Field>
      </div>

      {/* ── O VALE ── */}
      <div className="vf-section" role="group" aria-labelledby="sec-vale">
        <h2 className="vf-section-title" id="sec-vale">{t("secVale")}</h2>

        <Field label={t("destinatarioLabel")} required error={errors.nomeDestinatario} hint={t("destinatarioHint")}>
          <input type="text" {...inp("nomeDestinatario")} placeholder={t("destinatarioPlaceholder")} />
        </Field>

        <Field label={t("mensagemLabel")} hint={undefined}>
          <textarea {...inp("mensagem")} rows={4} placeholder={t("mensagemPlaceholder")} />
        </Field>

        <Field
          label={t("valorLabel")}
          required
          error={errors.valorVale}
          hint={
            <>
              {t("valorHint")}{" "}
              <Link href={OPCOES_PRECOS_URL} className="vf-hint-link">
                {t("valorHintLinkText")}
              </Link>{" "}
              {t("valorHintSuffix")}
            </>
          }
        >
          <input type="number" {...inp("valorVale")} min={300} max={100000} step={1} placeholder={t("valorPlaceholder")} />
        </Field>
      </div>

      {/* ── ENTREGA ── */}
      <div className="vf-section" role="group" aria-labelledby="sec-entrega">
        <h2 className="vf-section-title" id="sec-entrega">{t("secEntrega")}</h2>

        <Field label={t("entreguaALabel")} required error={errors.entrega}>
          <select {...inp("entrega")}>
            <option value="">{t("escolha")}</option>
            {entregueAOpcoes.map((o) => (
              <option key={o.valor} value={o.valor}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label={t("tipoValeLabel")} required error={errors.tipoVale}>
          <select {...inp("tipoVale")}>
            <option value="">{t("escolha")}</option>
            {tipoValeOpcoes.map((o) => (
              <option key={o.valor} value={o.valor}>{o.label}</option>
            ))}
          </select>
        </Field>

        {showEntregaRemetenteComo && (
          <Field label={t("comoReceberFisicoLabel")} required error={errors.entregaRemetenteComo}>
            <select {...inp("entregaRemetenteComo")}>
              <option value="">{t("escolha")}</option>
              {comoReceberFisicoOpcoes.map((o) => (
                <option key={o.valor} value={o.valor}>{o.label}</option>
              ))}
            </select>
          </Field>
        )}

        {showMorada && (
          <Field label={t("moradaLabel")} required error={errors.morada}>
            <textarea {...inp("morada")} rows={3} placeholder={t("moradaPlaceholder")} />
          </Field>
        )}

        {showContactoDestinatario && (
          <Field label={t("emailDestinatarioLabel")} required error={errors.contactoDestinatario} hint={t("emailDestinatarioHint")}>
            <div className="vf-contacto-toggle" role="tablist" aria-label={t("emailDestinatarioLabel")}>
              <button
                type="button"
                role="tab"
                aria-selected={form.contactoDestinatarioTipo === "email"}
                className={`vf-toggle-btn${form.contactoDestinatarioTipo === "email" ? " vf-toggle-active" : ""}`}
                onClick={() => set("contactoDestinatarioTipo", "email")}
              >
                {t("destinatarioTipoEmail")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={form.contactoDestinatarioTipo === "whatsapp"}
                className={`vf-toggle-btn${form.contactoDestinatarioTipo === "whatsapp" ? " vf-toggle-active" : ""}`}
                onClick={() => set("contactoDestinatarioTipo", "whatsapp")}
              >
                {t("destinatarioTipoWhatsapp")}
              </button>
            </div>
            {form.contactoDestinatarioTipo === "email" ? (
              <input
                type="email"
                {...inp("contactoDestinatario")}
                placeholder={t("emailDestinatarioPlaceholder")}
                autoComplete="email"
              />
            ) : (
              <div className="vf-phone-wrap">
                <PhonePrefix
                  value={form.contactoDestinatarioIndicativo}
                  onChange={(code) => set("contactoDestinatarioIndicativo", code)}
                  btnClassName="vf-input vf-phone-prefix"
                />
                <input
                  type="tel"
                  value={form.contactoDestinatarioNumero}
                  onChange={(e) => set("contactoDestinatarioNumero", e.target.value)}
                  className={`vf-input vf-phone-number${errors.contactoDestinatario ? " vf-input-err" : ""}`}
                  placeholder={t("destinatarioTelefonePlaceholder")}
                  autoComplete="tel-national"
                />
              </div>
            )}
          </Field>
        )}

        {showDataEnvio && (
          <Field label={t("dataEnvioLabel")} hint={t("dataEnvioHint")}>
            <input type="date" {...inp("dataEnvio")} min={today} max="2099-12-31" />
          </Field>
        )}
      </div>

      {/* ── OUTROS ── */}
      <div className="vf-section" role="group" aria-labelledby="sec-outros">
        <h2 className="vf-section-title" id="sec-outros">{t("secOutros")}</h2>

        <Field label={t("comentariosLabel")} hint={t("comentariosHint")}>
          <textarea {...inp("comentarios")} rows={3} placeholder={t("comentariosPlaceholder")} />
        </Field>

        <Field label={t("comoConheceuLabel")} required error={errors.comoConheceu}>
          <select {...inp("comoConheceu")}>
            <option value="">{t("escolha")}</option>
            {comoConheceuOpcoes.map((o) => (
              <option key={o.valor} value={o.valor}>{o.label}</option>
            ))}
          </select>
        </Field>

        {showNomeFlorista && (
          <Field label={t("nomeFlorista")} required error={errors.nomeFlorista}>
            <textarea {...inp("nomeFlorista")} rows={2} />
          </Field>
        )}

        {showComoConheceuOutro && (
          <Field label={t("comoConheceuOutro")}>
            <textarea {...inp("comoConheceuOutro")} rows={3} />
          </Field>
        )}
      </div>

      {/* Honeypot anti-spam — oculto para utilizadores, visível para bots */}
      <div className="vf-hp-field" aria-hidden="true">
        <input
          type="text"
          name="website"
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {Object.keys(errors).length > 0 && (
        <p className="vf-errors-summary" role="alert">
          {t("erroFormulario")}
        </p>
      )}

      {status === "error" && (
        <p className="vf-submit-error" role="alert">
          {submitError ? `${submitError} ` : ""}{t("erroEnvio")}
        </p>
      )}

      <button type="submit" className="vf-btn" disabled={status === "loading"}>
        {status === "loading" ? t("submitLoading") : t("submitBtn")}
      </button>
    </form>
  );
}
