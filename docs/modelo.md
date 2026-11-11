# Modelo de dados e cálculos (v0.3.0)

O app grava apenas o que o usuário digita. Parcelas, faturas, saldo e previsão são calculados no navegador a partir desses documentos, em `src/domain`.

## Coleções em `/users/{uid}`

| Coleção | Campos | Observações |
| --- | --- | --- |
| `cards` | `name`, `color` (`#RRGGBB`), `closingDay`, `dueDay` (1–31), `active`, `createdAt`, `updatedAt` | Criado ativo. Sem dados: exclusão real. Com compras ou faturas pagas: `active: false` e some das telas e dos cálculos. |
| `purchases` | `cardId`, `title`, `totalCents`, `installmentCount` (1 = à vista, até 24), `purchaseDate` (`YYYY-MM-DD`), `firstDueMonth` (`YYYY-MM`), `description`, `createdAt`, `updatedAt` | Uma compra = um documento. Excluir remove todas as parcelas; editar recalcula todas. |
| `invoiceStatus` | ID `{cardId}_{YYYY-MM}`; `cardId`, `month`, `paidAt` | Existir = fatura marcada como paga. Desmarcar = apagar. Não altera nenhum valor. |
| `incomes` | `title`, `amountCents`, `startMonth`, `endMonth` (nulo = sem fim), `createdAt`, `updatedAt` | Renda mensal recorrente. |
| `receivables` | `title`, `totalCents`, `installmentCount`, `launchDate`, `firstDueMonth`, `description`, `receivedIndexes`, `createdAt`, `updatedAt` | Valores de terceiros. Isolado: não entra no saldo. `receivedIndexes` guarda as parcelas recebidas (base 1). |

O documento `/users/{uid}` guarda só `createdAt` e `welcomeSeenAt`, usado pela mensagem de boas-vindas.

## Regras de cálculo

- **Parcelas** (`installments.ts`): o total em centavos é dividido em parcelas inteiras, com o resto nas primeiras (`10000 / 3 → 3334, 3333, 3333`). A parcela *n* vence em `firstDueMonth + (n − 1)` meses.
- **Fatura** (`summary.ts`): soma das parcelas das compras do cartão que vencem no mês. Data de vencimento = `dueDay` no mês; fechamento = `closingDay` no mesmo mês se `dueDay > closingDay`, senão no mês anterior. Dias 29–31 viram o último dia do mês.
- **1º mês sugerido** (`calendar.ts`): compra depois do fechamento vai para o ciclo seguinte. A sugestão é sempre editável.
- **Renda do mês**: soma das rendas com `startMonth ≤ mês ≤ endMonth` (ou sem fim).
- **A pagar**: soma das faturas dos cartões **ativos**, pagas ou não.
- **Saldo previsto** = renda − a pagar.
- **A receber do mês**: soma das parcelas de `receivables` que vencem no mês. Informativo.
- **Previsão**: os valores acima para 12 meses a partir do mês escolhido.

## Segurança

`firestore.rules` permite a cada usuário autenticado ler e gravar só em `/users/{seu uid}`, valida tipos, limites e campos permitidos de cada coleção, exige carimbos de horário do servidor e preserva `createdAt`. Compras e marcações de fatura paga só são aceitas para cartões ativos. Os testes ficam em `tests/rules.test.ts` e `tests/repository.test.ts` (`npm run test:rules`).

## Dados da v0.2.0

A v0.3.0 começou do zero, sem migração. As coleções antigas (`entries`, `installments`, `invoices`, `invoiceEvents`, `recurrences`, `recurrenceVersions`, `settlementEvents`, `accounts`, `accountMovements`, `scheduleOperations`, `categories`) ficam sem acesso pelas regras e podem ser apagadas no console do Firebase.

A coleção `cards` tem o mesmo formato nas duas versões: cartões ativos cadastrados na v0.2.0 continuam aparecendo na v0.3.0, e os arquivados continuam ocultos.
