# Form público — TODO Fase 5.5

> **Quando aplicares as mudanças da Fase 5.5 do admin, há também
> alterações ao site `floresabeirario.pt` que precisam de ser aplicadas
> no repo `fbr-website`. Esta lista cobre tudo.**

## 1. Mappings — já aplicado neste pacote

Os ficheiros [`app/_lib/supabase-mappings.js`](app/_lib/supabase-mappings.js)
foram actualizados para:

- aceitar a nova opção `"Recolha no local …"` em **comoEnviarFlores**
  (e manter compatibilidade com a antiga `"Recolha no evento …"`)
- aceitar a nova opção `"Recomendação de uma IA (ChatGPT, Gemini, etc.)"`
  em `comoConheceu` (mapeia para `recomendacao_ia`)
- aceitar `recomendacao-ia` como `valor` no form Vale-Presente
  (também → `recomendacao_ia`)

⚠ Antes de fazer push, **corre a migração 018** do admin (que adiciona
`recomendacao_ia` ao CHECK constraint). Ver `supabase/migrations/018_fase_5_5_afinacoes.sql`.

## 2. Por fazer no repo `fbr-website` (eu não posso editar daqui)

Estas mudanças têm de ser feitas directamente no repo
[`floresabeirario/fbr-website`](https://github.com/floresabeirario/fbr-website).

### a) Placeholder de data em inglês

O input de data no formulário (provavelmente em `app/reservar-preservacao/`
e `app/vale-presente/`) está a usar `placeholder="DD/MM/AAAA"` que é PT.
Em EN deve dizer `DD/MM/YYYY`. Procura por `DD/MM/AAAA` e troca por algo
como:

```js
placeholder={t('formats.datePlaceholder')}
```

E adiciona em `messages/pt.json`:
```json
"formats": { "datePlaceholder": "DD/MM/AAAA" }
```

E em `messages/en.json`:
```json
"formats": { "datePlaceholder": "DD/MM/YYYY" }
```

### b) Notas adicionais — "we'll always send you"

Encontra a string que diz "we'll send you" (ou "nós enviaremos") na descrição
do campo "Notas adicionais" e muda para:

- PT: "enviar-te-emos **sempre** a confirmação por email"
- EN: "we'll **always** send you a confirmation by email"

Provavelmente está em `messages/{pt,en}.json` numa chave tipo
`reserva.notasAdicionais.helper` ou similar.

### c) Indicativo internacional no form do Vale-Presente

O form de Vale-Presente tem o campo "E-mail ou WhatsApp do destinatário"
(`contactoDestinatario`). Quando o cliente escolhe WhatsApp, falta o
selector de indicativo internacional (+351, +44, +33, etc.).

Replica a mesma lógica que o form de **Reserva** já usa para o campo
`telefone` — provavelmente um componente que combina um `<select>` de
indicativo + `<input>` de número, com o resultado `+IND NUMERO` enviado
para o servidor.

### d) Mensagens de erro explícitas no form de Vale-Presente

Quando a API devolve 400 com `{error: "Número de telefone inválido."}`,
o form mostra a mensagem genérica "Ocorreu um erro ao enviar. Por favor,
tente novamente". Devias mostrar a mensagem real (`err.error`).

Provavelmente o handler de submit faz algo como:

```js
catch (err) {
  setRootError("Ocorreu um erro ao enviar...");
}
```

Procura `setRootError` ou `setErrorMessage` e garante que mostra
`err.message || err.error || "Ocorreu um erro ao enviar..."`.

No form de Reserva (`ReservarPreservacaoForm.jsx`) já é feito assim:
copia o padrão.

### e) Opção "Recomendação de IA" no form de Reserva

Em `app/reservar-preservacao/ReservarPreservacaoForm.jsx` há um array
`comoConheceuOpcoes`. Adiciona uma nova entrada:

```jsx
{ valor: "Recomendação de uma IA (ChatGPT, Gemini, etc.)", label: t('formReserva.comoConheceu.recomendacaoIa') },
```

E em `messages/{pt,en}.json`:

PT: `"recomendacaoIa": "Recomendação de IA (ChatGPT, Gemini, etc.)"`
EN: `"recomendacaoIa": "AI recommendation (ChatGPT, Gemini, etc.)"`

Faz o mesmo no form de Vale-Presente (o `valor` lá é `recomendacao-ia`).

### f) "Recolha no evento" → "Recolha no local" no form de Reserva

Em `ReservarPreservacaoForm.jsx`, troca a string do `valor`:

```jsx
// ANTES:
{ valor: "Recolha no evento por parte da Flores à Beira-Rio - mediante orçamento e disponibilidade", ... }
// DEPOIS:
{ valor: "Recolha no local por parte da Flores à Beira-Rio - mediante orçamento e disponibilidade", ... }
```

E o `label` correspondente em `messages/{pt,en}.json`.

O mapping em `supabase-mappings.js` (já neste pacote) aceita as duas
strings em paralelo durante a migração, por isso não há quebra se
demorares uns dias entre o push do admin e o push do site.
