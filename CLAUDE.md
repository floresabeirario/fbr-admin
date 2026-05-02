@AGENTS.md

# IMPORTANTE — Início de cada sessão
Lê sempre o ficheiro `PROGRESS.md` na raiz do projecto antes de qualquer coisa.
Ele diz exactamente onde ficámos e o próximo passo concreto.
Actualiza-o no fim de cada sessão de trabalho.

---

# Flores à Beira Rio — Plataforma Admin (admin.floresabeirario.pt)

## Stack
- Next.js + TypeScript (este repo)
- Supabase (auth + base de dados + storage)
- Vercel (deploy)
- shadcn/ui já instalado com: button, card, table, badge, input, label, select, dialog, sheet, sidebar, tabs, calendar, chart, command, checkbox, textarea, popover, alert-dialog, progress, sonner, tooltip, skeleton, avatar, separator, dropdown-menu, navigation-menu, input-group
- Fontes da marca: Google Sans + Tan Memories (Tan Memories está em public/fonts/)

## Design
- Design super moderno
- Fontes: Google Sans (corpo) + Tan Memories (títulos/brand)
- Moeda: sempre euros (€), formato europeu (vírgula decimal, datas dd/mm/aaaa)
- Idioma da plataforma: Português

## Utilizadores (3 no total)
- 2 Admin (Google OAuth via Supabase) — acesso total
- 1 Viewer — só pode editar tarefas (dashboard) e aba Parcerias; resto é só leitura
- Admins podem gerir permissões facilmente

## Abas da plataforma

### 1. Dashboard
- Checklist pessoal (por utilizador logado, mas pode mudar para ver de outro)
- Afazeres globais (tarefas com assignee, prioridade, prazo, alerta por email)
- Secção sumária de recolhas agendadas (dia, hora, localização)
- Dashboard de métricas (ver abaixo)
- Alertas de aproximação de data de recolha

### 2. Preservação de Flores
Campos do formulário (user = preenchido pelo cliente no site; admin = gestão interna):
- Nome na encomenda (user)
- Preferência de contacto: WhatsApp ou Email (user)
- Email (user), Telemóvel (user)
- Orçamento (admin) — calculado automaticamente a partir dos preços na aba Finanças, editável
- Pagamentos (admin): 100% pago / 70% pago / 30% pago / 30% por pagar / 100% por pagar
  - Ao mudar pagamento: alerta para anexar comprovativo, pergunta se cliente pediu NIF
- NIF (admin, condicional) + anexo de fatura
- Comissão parceria (admin, €) + estado da comissão (N/A / Parceiro informado / A aguardar / Paga / A aguardar resposta / Não aceita)
- Parceiro recomendador (ligado à aba Parcerias)
- Data do evento (user)
- Tipo de evento (user): Casamento / Batizado / Funeral / Pedido de Casamento / Outro
- Nome dos noivos (user, condicional se casamento)
- Localização do evento (user)
- Estado (admin): 15 estados desde "Entrega de flores por agendar" até "Cancelado"
- Como envia as flores (user/admin): mãos / CTT / Recolha no evento / Não sei
  - CTT e Recolha alimentam aba "Entregas e Recolhas"
- Custo envio flores (admin, €) + pago?
- Tipo de flores (user)
- Como recebe o quadro (user/admin): mãos / CTT / Não sei
  - CTT alimenta aba "Entregas e Recolhas"
- Custo envio quadro (admin, €) + pago?
- Fundo do quadro (user): Transparente / Preto / Branco / Fotografia / Cor / Vocês a escolher / Não sei
- Tamanho moldura (user): 30x40 / 40x50 / 50x70 / Vocês a escolher / Não sei
- Extras no quadro (user): lista de opções + texto livre
- Quadros extra pequenos (user): Sim / Não / Mais info + quantidade
- Ornamentos de Natal (user): Sim / Não / Mais info + quantidade
- Pendentes para colares (user): Sim / Não / Mais info + quantidade
- Como conheceu a FBR (user): Instagram / Facebook / casamentos.pt / Google / Vale-Presente / Florista / Recomendação / Outro
- Código vale-presente (user, condicional)
- Notas adicionais (user)
- Código Cupão 5% (admin, gerado automaticamente ao passar para "A ser emoldurado")
- Validade cupão (admin, 2 anos após data de entrega)
- Estado cupão: Utilizado / Não utilizado / N/A
- Feedback do cliente: Deu feedback / Já pedido | Não disse nada / Não disse nada / N/A
- Data entrega do quadro final (admin)
- ID encomenda (alfanumérico 16 dígitos, gerado automaticamente)

Grupos de encomendas:
- Pré-reservas (Entrega de flores por agendar) — com distinção contactados/não contactados
- Sem-resposta (Pré-reserva há mais de 4 dias)
- Reservas (Entrega agendada, Flores enviadas, Flores recebidas)
- Preservação e design (Flores na prensa, Reconstrução botânica, A compor design, A aguardar aprovação)
- Finalização (A ser emoldurado, Emoldurado, A ser fotografado, Quadro pronto, Quadro enviado)
- Concluídos (Quadro recebido)
- Cancelamentos (Cancelado)

Visualizações: Tabela, Timeline, Calendário (mostra Data do evento), Workbench

Workbench:
- Toda a info da encomenda
- Foto das flores (upload admin)
- Link para pasta Drive do cliente (criada automaticamente via Google Drive API)
- Idioma em que o cliente preencheu o formulário
- Galeria de inspiração (imagens → Drive, links → preview)
- Histórico de comunicações (Gmail integrado + WhatsApp manual via screenshot/texto)
- Assistente de resposta AI (Anthropic API)
- Link para status.floresabeirario.pt

Automações:
- Ao marcar pagamento (100%/70%/30%): criar evento Google Calendar com data do evento
- Nova encomenda: defaults automáticos (100% por pagar, orçamento calculado, etc.)
- Cupão gerado ao passar para "A ser emoldurado"
- Validade cupão = 2 anos após data de entrega

### 3. Vale-Presente
Campos (user/admin):
- Dados do remetente: nome, contacto preferido, telemóvel, email
- O vale: nome destinatário, mensagem personalizada, valor (mín. 300€)
- Entrega: para mim / para destinatário; digital (email/WA) ou físico (9€+portes)
- Outros: comentários, como conheceu FBR
- Pagamentos (admin): 100% pago / 100% por pagar
- Envio do vale (admin): Enviado / Agendado / Não agendado
- Utilização (admin): Preservação agendada / Preservação não agendada
- Código (admin): alfanumérico 6 dígitos, único, gerado automaticamente
- Validade (admin): 2 anos após criação

Alimenta o site voucher.floresabeirario.pt (campos: código, remetente, destinatário, valor, mensagem, validade)
Grupos: Pré-reservas (100% por pagar) / Reservas (100% pago)

### 4. Status
Alimenta status.floresabeirario.pt — acompanhamento público de encomendas
Campos: ID, nome, estado (mapeado para 11 estados públicos), mensagem (PT/EN editável), última atualização, data de previsão de entrega
Data de previsão: gerada automaticamente quando passa para "Flores na prensa" (data + 6 meses)
Opção de mostrar em PT, EN ou AMBOS

### 5. Parcerias
Sub-abas: Wedding Planners / Floristas / Quintas de Eventos / Outros
Grupos em cada sub-aba: Por contactar / Pendente / Tentativa de contacto / Aceite / Confirmado / Rejeitado
Campos: nome empresa, estado, ações (assignáveis a membros), email, telemóvel(s), responsável, notas, local de atuação, links (múltiplos), aceita 10% comissão?, histórico de interações
Visualização: tabela + workbench + mapa de Portugal
Clientes recomendados (ligado a Preservação e Vale-Presente)
Terceiro utilizador tem acesso de edição nesta aba

### 6. Finanças
- Tabela de preços por produto (usada para calcular orçamentos automaticamente)
  - IMPORTANTE: preço em vigor no momento da criação da encomenda deve ser guardado; aumentos futuros não recalculam encomendas antigas
- Tracking de despesas
- Estatísticas de faturação
  - ATENÇÃO: vales no estado "Preservação agendada" NÃO contam para faturação (evitar duplicação com orçamento de preservação)
  - Vales no estado "Preservação não agendada" SIM contam

### 7. Dashboard de Métricas
Filtros: este mês / mês passado / últimos 3/6 meses / este ano / ano passado / personalizado
Atualização: no refresh da página (não tempo real). Mostrar data/hora da última atualização.

Métricas:
- Receita do mês (vs mesmo mês ano anterior, %)
- Receita acumulada do ano (vs ano anterior)
- Nº encomendas novas (vs mês anterior)
- Encomendas por estado (gráfico barras horizontais)
- Tempo médio de conclusão (global + últimos 6 meses)
- Vales vendidos no mês + % convertidos em preservação
- Top 5 canais de aquisição
- Top 5 parceiros (receita + comissões)
- Tamanho de moldura mais vendido (circular)
- Tipo de fundo mais escolhido (circular)
- % encomendas com extras
- Tipo de evento mais comum
- Alertas visuais: eventos nos próximos 7 dias, encomendas paradas 14+ dias, pré-reservas sem contacto 4+ dias, vales a expirar em 3 meses
- Insights automáticos (análise simples dos dados)

### 8. Entregas e Recolhas
- Sumário de recolhas agendadas e entregas CTT (dia, hora, localização)
- Calculadora de transporte (placeholder para desenvolvimento futuro)
- Alimentado automaticamente pelos campos de envio das abas Preservação e Vale-Presente

### 9. Ecossistema
- Fluxograma/visual com todos os links e plataformas usadas

### 10. Healthchecks
- Placeholder para verificação de forms, BD, SEO (a desenvolver mais tarde)

### 11. Ideias Futuras
- Lista de ideias ordenadas por importância/tema

## Formulários Públicos (site FBR)
- Reserva de preservação: form substituindo o atual (integrado com Monday → migrar para Supabase)
- Vale-presente: idem
- Ambos em PT e EN, resultados no mesmo lugar
- Anti-spam: Cloudflare Turnstile + Honeypot + Rate limiting (5/hora/IP)
- RGPD: checkbox obrigatório, guardar data/versão do consentimento
- Validações completas com mensagens de erro por campo
- Email de confirmação após submissão

## Funcionalidades Transversais
- Pesquisa global (todas as abas, todos os campos)
- Audit log (quem alterou o quê, quando, valor anterior e novo)
- Soft delete (arquivo em vez de eliminação, recuperável por admin)
- "Apagar definitivamente" (só admin, confirmação dupla, justificação obrigatória, anonimização estatística)
- Exportação de dados pessoais por cliente (PDF ou JSON)
- Exportação manual Excel/CSV de encomendas e vales
- Backup automático diário para Google Drive (info@floresabeirario.pt)
- Gestão de ficheiros: tudo guardado na Drive do cliente (pasta por cliente, criada automaticamente)
- Alertas visuais para clientes sem resposta há +24h
- Diferenciação visual quando faltam ≤5 dias para data do evento
- PWA (Progressive Web App) para uso no telemóvel
- Retenção de dados: 10 anos para encomendas concluídas (fiscal), alerta automático após prazo

## Segurança e RGPD
- Auth via Supabase (Google OAuth)
- Passwords encriptadas (nativo Supabase)
- Dados sensíveis nunca expostos em URLs/logs públicos
- Terceiro utilizador só vê o estritamente necessário
- Direito ao esquecimento implementado

## Integrações
- Supabase Auth (Google OAuth)
- Google Drive API (pastas por cliente)
- Gmail API (histórico emails por encomenda)
- Google Calendar API (eventos de pagamento)
- Anthropic API (assistente de resposta AI)
- Cloudflare Turnstile (anti-spam)
- voucher.floresabeirario.pt (alimentado por Vale-Presente)
- status.floresabeirario.pt (alimentado por Status)
