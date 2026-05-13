# Pacote Fase 5.5 — fbr-website

Este pacote tem **4 ficheiros prontos a copiar** para o teu projecto local
do `fbr-website`. Não precisas de editar nada manualmente.

## O que muda no site público

1. **"we'll always send you"** em vez de "we'll send you" no hint das
   Notas adicionais do form de Reserva (PT + EN). PT idem ("enviamos-lhe
   sempre uma foto").
2. **"Recolha no evento" → "Recolha no local"** no select "Como vai enviar
   as flores" do form de Reserva (PT + EN).
3. **Nova opção "Recomendação de IA (ChatGPT, Gemini, etc.)"** no select
   "Como conheceu a FBR" em ambos os formulários (Reserva + Vale).
4. **Indicativo de telemóvel** no campo "Contacto do destinatário" do form
   de Vale-Presente (botão "E-mail/WhatsApp" toggle; quando WhatsApp,
   aparece o selector de país com bandeira igual ao form de Reserva).
5. **Mensagens de erro explícitas** no form de Vale-Presente: quando o
   servidor devolve "Número de telefone inválido." essa mensagem é
   mostrada (antes só aparecia o genérico "Ocorreu um erro ao enviar…").

## Pré-requisito

A migração 018 do admin (`supabase/migrations/018_fase_5_5_afinacoes.sql`)
**já tens de a ter corrido** no Supabase para o valor `recomendacao_ia`
ser aceite pela base de dados.

---

## Os 4 ficheiros a substituir

Abre o teu projecto local do `fbr-website` (clone do
[github.com/floresabeirario/fbr-website](https://github.com/floresabeirario/fbr-website))
e substitui estes 4 ficheiros pelos do pacote:

| Ficheiro neste pacote | Onde colar no fbr-website |
| --- | --- |
| `messages/pt.json` | `messages/pt.json` |
| `messages/en.json` | `messages/en.json` |
| `app/vale-presente/ValeApresenteForm.jsx` | `app/vale-presente/ValeApresenteForm.jsx` |
| `app/vale-presente/ValeApresenteClient.css` | `app/vale-presente/ValeApresenteClient.css` |

> Substitui mesmo (sobrepõe). Não há mudanças destrutivas nos ficheiros —
> só acrescentei chaves e elementos novos.

## Como fazer (passo-a-passo)

1. Abre o **VS Code** (ou o teu editor) com a pasta local do `fbr-website`.
2. No File Explorer do Windows, vai a
   `C:\Users\maria\Documents\fbr-admin2\_fbr-website-updates\`.
3. Para cada um dos 4 ficheiros acima:
   - Arrasta-o para a localização equivalente no `fbr-website`.
   - Quando o Windows perguntar "Substituir ficheiro?", clica **Sim**.
4. No terminal do VS Code, dentro da pasta do `fbr-website`:
   ```bash
   git status            # confirma que estes 4 ficheiros aparecem como modificados
   git diff --stat       # vê resumo das alterações
   ```
5. Testa localmente (`npm run dev`) — abre `http://localhost:3000/vale-presente`
   em PT e EN para confirmar:
   - O campo "Contacto do destinatário" agora tem o toggle Email/WhatsApp
   - A nova opção "Recomendação de IA" aparece no select
   - Em `/reservar-preservacao`, "Recolha no local" aparece no select de envio
6. Quando estiveres feliz, commit + push:
   ```bash
   git add -A
   git commit -m "Fase 5.5 — toggle email/WhatsApp no vale + Recomendação de IA + Recolha no local"
   git push origin develop
   ```
7. O Vercel cria um preview deployment a partir do `develop`. Testa o
   preview, e quando estiveres OK, faz merge `develop` → `main` (como
   fizeste na sessão 25/26) para o ir a produção.

---

## Notas técnicas

### Sobre o placeholder de data DD/MM/AAAA em EN

Tu mencionaste que o placeholder do input de data continua a dizer
"DD/mm/AAAA" mesmo quando o form está em inglês. **Isto é controlado
pelo browser, não pelo nosso código.** O input `<input type="date">` usa
sempre a locale do **sistema operativo do utilizador** para formatar o
placeholder, ignorando o atributo `lang` do HTML.

Soluções possíveis (não aplicadas neste pacote — discutimos antes de
implementar):
- (a) Substituir o `<input type="date">` por um datepicker custom (mais
  trabalho mas controlo total)
- (b) Adicionar um hint visível debaixo do campo a dizer "Format:
  DD/MM/YYYY" em EN (rápido mas não corrige o placeholder no input)
- (c) Deixar como está (a maioria dos clientes portugueses usa OS PT;
  para clientes em EN, a maior parte dos browsers já mostra DD/MM/YYYY
  automaticamente)

Diz-me qual preferes e aplico numa próxima sessão.

### Sobre a opção "Recomendação de IA"

Os mappings em `_fbr-website-updates/app/_lib/supabase-mappings.js`
(da sessão 25/26) já foram actualizados para aceitar o valor
`recomendacao_ia`. **Se ainda não copiaste esse ficheiro para o
`fbr-website`** (sessão 25), faz isso também — está em
`_fbr-website-updates/app/_lib/supabase-mappings.js`.

---

## Resumo do que NÃO mudou

- Anti-spam (honeypot, rate limit, Turnstile) — intocado
- Validações de campos básicos — intocadas (só adicionei a validação extra
  para o WhatsApp do destinatário)
- API routes — intocadas (o servidor já aceitava o `contactoDestinatario`
  como string; agora recebe `+351 912 345 678` quando WhatsApp, igual ao
  campo `telefone`)
- Estrutura do form — intocada (só substituí o `<input type="text">` do
  contacto do destinatário por um toggle de 2 estados)
