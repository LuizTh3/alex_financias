# Plano de refatoração — simplificação (v0.3.0)

> **Situação (11/11/2026):** fases 1 a 7 concluídas; falta a fase 8 (verificação final e publicação). O modelo implementado está em [modelo.md](modelo.md).

Base: diagrama de fluxo do FigJam (Visão geral, Faturas, Cartões, Previsão dos meses, Rendas, A receber) comparado com o código atual da branch `develop` (v0.2.0).

## 1. Diagnóstico: por que o app ficou complicado

| Aspecto | Hoje | No diagrama |
| --- | --- | --- |
| Menu | 10 itens: Visão geral, Como usar, Categorias, Cartões, Minha conta, Lançamentos, Rendas e despesas mensais, Faturas, A receber, Compromissos futuros | 6 itens: Visão geral, Faturas, Cartões, Previsão dos meses, Rendas, A receber |
| Coleções no Firestore | 12: `cards`, `categories`, `entries`, `installments`, `invoices`, `invoiceEvents`, `recurrences`, `recurrenceVersions`, `settlementEvents`, `accounts`, `accountMovements`, `scheduleOperations` | 5 bastam (ver seção 3) |
| Lançamento | Despesa ou recebimento, pagamento direto ou cartão, categoria, competência sugerida, parcelas materializadas | Só compra **no cartão**: título, valor, parcelado (s/n), nº de parcelas, data da compra, 1º mês de vencimento, descrição |
| Pagar fatura | Pagamento integral com histórico imutável (`invoiceEvents`), movimento de conta, revisão, bloqueio de edição | Apenas um **marcador pago/não pago**, com confirmação para marcar e desmarcar. Sem cálculo |
| Rendas | Recorrências versionadas (vigências, pausa, encerramento), ocorrências materializadas mês a mês | Título, valor, início, fim opcional. Excluir apaga tudo |
| A receber | Lançamentos de entrada que entram no saldo | **Isolado**: não entra em nenhum cálculo, só tem marcador de recebido por parcela |
| Saldo | Conta com saldo inicial + movimentos | `Saldo previsto = renda do mês − soma das faturas do mês` |
| Parcelamentos grandes | Protocolo retomável em etapas (`scheduleRepository` + `ScheduleGate` bloqueando a interface) | Desnecessário com o novo modelo |
| Regras do Firestore | 597 linhas | Estimativa de ~100 linhas |

A maior fonte de complexidade é **materializar** parcelas, faturas e ocorrências como documentos separados, o que exige transações, revisões, tombstones e retomada. O diagrama não pede nada disso.

## 2. Ideia central da refatoração

**Guardar só o que o usuário digita e calcular o resto.**

- Uma compra parcelada é **um documento**. As parcelas (`Parcela 7/12 R$ 56,37`) são calculadas na tela a partir de `totalCents`, `installmentCount` e `firstDueMonth`.
- A fatura de um cartão em um mês = soma das parcelas das compras daquele cartão que caem naquele mês. Não é gravada.
- Uma renda é **um documento** com início e fim opcional; o valor do mês é calculado.
- Os marcadores "pago" e "recebido" são os únicos estados gravados além dos cadastros.

Consequências diretas:
- "Excluir todas as parcelas, inclusive meses anteriores e próximos" vira apagar um único documento.
- Editar uma compra atualiza todas as parcelas automaticamente.
- Some a necessidade de transações em lote, revisões, `mutationId`, protocolo retomável e `ScheduleGate`.

Para uso pessoal (centenas a poucos milhares de compras), carregar as coleções do usuário e calcular no navegador é suficiente e barato.

## 3. Novo modelo de dados (`/users/{uid}/...`)

| Coleção | Campos | Observação |
| --- | --- | --- |
| `cards` | `name`, `color`, `closingDay`, `dueDay`, `active`, `createdAt`, `updatedAt` | Sem dados: exclusão real. Com dados: inativado (D3) |
| `purchases` | `cardId`, `title`, `totalCents`, `installmentCount` (1 = à vista), `purchaseDate` (`YYYY-MM-DD`), `firstDueMonth` (`YYYY-MM`), `description`, `createdAt`, `updatedAt` | Parcelas calculadas |
| `invoiceStatus` | ID `{cardId}_{YYYY-MM}`; `paid: true`, `paidAt` | Documento existe = pago. Desmarcar = apagar |
| `incomes` | `title`, `amountCents`, `startMonth`, `endMonth` (nulo = sem fim), `createdAt`, `updatedAt` | Renda mensal recorrente |
| `receivables` | `title`, `totalCents`, `installmentCount`, `launchDate`, `firstDueMonth`, `description`, `receivedIndexes: number[]`, `createdAt`, `updatedAt` | Marcador de recebido por parcela dentro do próprio documento |

Mantém-se: dinheiro em centavos inteiros, divisão exata com resto nas primeiras parcelas (`splitCents`), meses `YYYY-MM`, dias 29–31 ajustados ao último dia do mês (`dueDateInMonth`), limite de 24 parcelas, fuso `America/Rio_Branco`.

Conferência com os exemplos do diagrama: 676,44 em 12x → 12 × 56,37; 350,00 em 5x → 5 × 70,00.

## 4. Regras de cálculo (domínio puro, testado)

- `installmentsOf(item)` → lista `{ index, count, month, amountCents }`.
- `installmentInMonth(item, month)` → a parcela daquele mês ou nada.
- `invoiceTotal(cardId, month, purchases)` → soma das parcelas do cartão no mês.
- `incomeInMonth(month, incomes)` → soma das rendas vigentes (`startMonth <= mês` e `endMonth` nulo ou `>= mês`).
- `monthSummary(month)` → `{ renda, aPagar = Σ faturas de todos os cartões, saldoPrevisto = renda − aPagar }`.
- `forecast(startMonth)` → 12 × `monthSummary`, do mês escolhido em diante.
- `receivablesInMonth(month)` → total e lista para o card isolado de "A receber".
- Datas exibidas no card do cartão: data da fatura (fechamento) e vencimento derivados de `closingDay`/`dueDay` e do mês.
- Sugestão do 1º mês de vencimento a partir da data da compra e do fechamento (reaproveitar `suggestFirstCompetence`), sempre editável.

## 5. Telas e rotas

O mês e o cartão selecionados ficam **na URL**, o que resolve a pré-seleção vinda de outras telas e evita o tipo de bug corrigido em `5d96957` (404 ao recarregar com modal aberto).

| Rota | Tela | Conteúdo |
| --- | --- | --- |
| `/entrar` | Login | Mantém e-mail e senha atuais |
| `/` | Visão geral | Seletor de mês; 3 indicadores (Renda, A pagar, Saldo previsto); cards dos cartões (nome, data da fatura, valor, vencimento, selo pago/não pago, botão rápido "Pagar" com confirmação, clique no card ou "Acessar" → Faturas com o cartão); card "A receber" do mês (somente visualização) com "Acessar" |
| `/faturas?cartao=ID&mes=YYYY-MM` | Faturas | Sem `cartao`: estado vazio "Selecione o cartão". Com cartão: cartão visual com valor da fatura, seletor de mês, selo pago, botão pagar/desmarcar com confirmação, botão "Novo lançamento", histórico com filtros Todos / À vista / Parcelado, item "Compra sofá — Parcela 7/12 R$ 56,37", editar, excluir (à vista: confirmação simples; parcelado: "Excluir todas as parcelas deste lançamento?"), clique abre modal de detalhes com a descrição |
| `/cartoes` | Cartões | Novo cartão, busca por nome, lista com botões Faturas, Editar, Excluir. Excluir sem compras nem faturas pagas: confirmação simples e exclusão real. Com dados: aviso "Este cartão tem lançamentos/faturas" + confirmação, e o cartão é inativado |
| `/previsao?inicio=YYYY-MM` | Previsão dos meses | Seletor do mês inicial; tabela de 12 meses: mês, renda, a pagar, saldo previsto (renda − a pagar) e, em coluna informativa separada, o "A receber" do mês, que não entra no saldo |
| `/rendas` | Rendas | Nova renda (título, valor, início, "tem fim?" + mês final); histórico com editar e excluir (confirma que remove todos os meses) |
| `/a-receber?mes=YYYY-MM` | A receber | Novo a receber (título, valor, nº de parcelas, data, 1º mês, descrição); lista do mês "MAICO — Parcela 2/5 R$ 70,00", botão recebido/não recebido, editar, excluir tudo com confirmação, modal de detalhes |

### Componentes compartilhados

`MonthPicker` (setas + `input type="month"`), `CreditCardVisual`, `PaidBadge`, `ConfirmDialog`, `DetailsModal`, `InstallmentRow`, `MoneyInput`, `EmptyState`. Reaproveitar `Modal`, `ThemeToggle`, `ProtectedRoute`, `AuthContext`, estilos e tema escuro.

## 6. O que sai, o que fica

**Remover:** `CatalogPage` de categorias, `AccountPage`, `EntriesPage`, `FixedExpensesPage`, `HelpPage` (ver D5); `EntryForm`, `RecurrenceForm`, `SettlementButton`, `ScheduleGate`, `CatalogForm` (substituído por formulário de cartão); `domain/commitments`, `cashFlow`, `dashboard`, `recurrences`, `invoices`, `entries`, `catalog` (no formato atual); `repositories/schedule*`, `settlement*`, `account*`, `recurrence*`, `invoice*`, `entry*`, `catalog*`, `financialSchemas`; `useRecurringMonth`; `scripts/migrate-invoice-balances.mjs`; docs `cash-flow`, `financial-engine`, `invoices`, `recurrences-and-receivables`, `financial-contract` (substituídos por um único `docs/modelo.md`).

**Manter:** stack (React 19, Vite, TS, Tailwind 4, React Router 7, React Hook Form + Zod, Firebase), login, layout com menu lateral e tema escuro, `money.ts`, `calendar.ts`, hospedagem Vercel, testes com Vitest e emulador.

**Avaliar:** `WelcomeModal`/tutorial — pode ficar, com o texto reescrito para as 6 telas.

## 7. Fases de execução

Trabalhar na branch `refactor/simplificacao` a partir de `develop`. As novas coleções têm nomes diferentes das antigas, então os dados atuais ficam intactos até a remoção final — dá para voltar atrás a qualquer momento.

1. **Domínio e testes** — funções puras da seção 4 + esquemas Zod das 5 coleções, com testes (incluindo os exemplos 676,44/12 e 350/5, virada de ano, dia 31, renda sem fim, renda encerrada).
2. **Regras e repositórios** — `firestore.rules` novo (dono do caminho, validação de campos, timestamps do servidor), repositórios CRUD simples, hook genérico `useCollection`. Testes de regras no emulador.
3. **Layout e rotas** — menu com 6 itens, rotas da seção 5, redirecionar rotas antigas (`/lancamentos`, `/despesas-fixas`, `/futuros`…) para as novas.
4. **Componentes compartilhados** da seção 5.
5. **Telas, na ordem de dependência:** Cartões → Faturas (com lançamentos) → Visão geral → Rendas → A receber → Previsão.
6. **Dados existentes** — começar do zero (D1): sem script de migração. As coleções antigas ficam no Firestore, sem acesso pelas novas regras, e podem ser apagadas manualmente no console depois que a v0.3.0 estiver validada.
7. **Limpeza** — remover o código e as docs da seção 6, regras e índices antigos, atualizar README e CHANGELOG (v0.3.0).
8. **Verificação e publicação** — `npm test`, `npm run test:rules`, `npm run build`, teste manual de cada fluxo do diagrama no navegador (desktop e celular, claro e escuro), deploy das regras e depois da Vercel.

Estimativa de tamanho: o código-fonte deve cair de ~2.700 para ~1.200 linhas e as regras de 597 para ~100.

## 8. Decisões tomadas (09/11/2026)

- **D1 — Dados atuais:** começar do zero. Sem migração.
- **D2 — Despesas fora do cartão:** fora do escopo. O app administra apenas cartões; as demais contas são pagas no débito, fora do app. Nenhuma tela de despesas diretas ou fixas.
- **D3 — Excluir cartão:**
  - Sem compras e sem faturas marcadas como pagas → confirmação simples e exclusão real do documento.
  - Com dados → aviso de que o cartão tem lançamentos/faturas e pedido de confirmação. Confirmado, o cartão recebe `active: false` e some de todas as telas (Visão geral, Faturas, Cartões, seletor de cartão). Suas compras deixam de entrar no "A pagar" e na Previsão. Os dados continuam gravados.
- **D4 — Previsão:** colunas Mês, Renda, A pagar, Saldo previsto (renda − a pagar) e "A receber" como coluna apenas informativa, fora do saldo.
- **D5 — Editar renda:** a edição altera todos os meses. Para mudança de valor a partir de um mês (ex.: aumento), encerrar a renda antiga e criar uma nova.

### Ainda em aberto

- Manter a página "Como usar" e o tutorial de boas-vindas (reescritos para as 6 telas) ou removê-los? Até decidir, o plano remove "Como usar" e mantém só o modal de boas-vindas atualizado.
- Inativar o cartão o tira de todos os cálculos, inclusive de meses passados. Se preferir que meses já vencidos continuem somando, é uma mudança pequena no cálculo.
