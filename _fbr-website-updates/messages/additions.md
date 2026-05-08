# Adições aos `messages/pt.json` e `messages/en.json`

> **Onde colar:** dentro do bloco `"formReserva": { ... }` em cada ficheiro.
> Podes meter as chaves novas em qualquer sítio dentro desse bloco — não há
> ordem obrigatória — mas sugerimos pô-las junto às outras chaves do mesmo
> grupo (`tipoEventoLabel` perto de `dataEventoLabel`, `codigoValeLabel`
> perto de `comoConheceuLabel`, etc.).
>
> ⚠ **Cuida da última vírgula.** JSON é estrito: cada par precisa de `,`
> a seguir, excepto o último do bloco. Se por engano deixares vírgula a
> seguir ao último par, o build do Next falha.

---

## 1) Em `messages/pt.json` — adicionar dentro de `"formReserva"`

```json
"tipoEventoLabel": "Tipo de evento",
"tipoEventoHint": "Para personalizarmos a comunicação consigo.",
"tipoEventoOpcoes": [
  { "valor": "Casamento",            "label": "Casamento" },
  { "valor": "Batizado",             "label": "Batizado" },
  { "valor": "Funeral",              "label": "Funeral" },
  { "valor": "Pedido de Casamento",  "label": "Pedido de Casamento" },
  { "valor": "Outro",                "label": "Outro" }
],
"nomeNoivosLabel": "Nome dos noivos",
"nomeNoivosHint": "Para identificarmos a vossa encomenda e para podermos personalizar a peça final.",
"nomeNoivosPlaceholder": "Ex.: Joana e Pedro",
"localEventoLabel": "Localização do evento",
"localEventoHint": "Cidade ou local onde o evento aconteceu (ou vai acontecer).",
"localEventoPlaceholder": "Ex.: Quinta das Lágrimas, Coimbra",
"codigoValeLabel": "Código do Vale-Presente",
"codigoValeHint": "Indique-nos o código presente no seu vale para que possamos validar a oferta.",
"codigoValePlaceholder": "Ex.: A4F8K2"
```

## 2) Em `messages/en.json` — adicionar dentro de `"formReserva"`

```json
"tipoEventoLabel": "Type of event",
"tipoEventoHint": "So we can personalise our communication with you.",
"tipoEventoOpcoes": [
  { "valor": "Casamento",            "label": "Wedding" },
  { "valor": "Batizado",             "label": "Baptism" },
  { "valor": "Funeral",              "label": "Funeral" },
  { "valor": "Pedido de Casamento",  "label": "Marriage proposal" },
  { "valor": "Outro",                "label": "Other" }
],
"nomeNoivosLabel": "Names of the couple",
"nomeNoivosHint": "To identify your booking and to personalise the final piece.",
"nomeNoivosPlaceholder": "E.g.: Joana and Pedro",
"localEventoLabel": "Event location",
"localEventoHint": "City or venue where the event took place (or will take place).",
"localEventoPlaceholder": "E.g.: Quinta das Lágrimas, Coimbra",
"codigoValeLabel": "Gift Voucher code",
"codigoValeHint": "Please give us the code on your gift voucher so we can validate the offer.",
"codigoValePlaceholder": "E.g.: A4F8K2"
```

---

## Notas importantes

- **`valor` mantém-se em PT em ambos os ficheiros** (igual ao padrão existente
  para `comoEnviarOpcoes`, `tamanhoOpcoes`, etc.). Só os `label` é que mudam
  com o idioma. O `valor` é a string que vai para o servidor e o servidor
  espera sempre PT.

- **Não traduzir `Casamento` para `Wedding` no `valor`.** Se o fizerem, o
  mapping `TIPO_EVENTO` no servidor (`supabase-mappings.js`) deixa de
  reconhecer a opção e a reserva falha com `"Valores inválidos em:
  tipoEvento"`.

- **`codigoValePresente` aparece só quando** `comoConheceu` é `"Ofereceram-me
  um Vale-Presente para preservação"`. Não é preciso nenhuma chave nova nas
  opções `comoConheceuOpcoes` — essa opção já existe.

- **`nomeNoivos` aparece só quando** `tipoEvento` é `"Casamento"`.
