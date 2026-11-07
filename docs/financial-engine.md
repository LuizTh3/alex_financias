# Motor financeiro: lançamentos e parcelas

## Uso na aplicação

Em **Lançamentos**, cadastre uma despesa ou um recebimento usando o valor **total**, a categoria, a quantidade de parcelas e o primeiro mês de vencimento. O formulário exibe todas as cobranças antes de salvar. Em cartão, também mostra uma sugestão de competência e permite aplicá-la ou corrigir manualmente. Compra na data de fechamento recebe um aviso de ambiguidade.

A lista mensal inclui lançamentos que têm alguma parcela vencendo na competência selecionada. “Todos os lançamentos” ignora esse filtro. Edição substitui o conjunto inteiro de parcelas; exclusão pede confirmação e apresenta seu alcance. Não há edição isolada de parcela.

## Domínio puro

- `calendar.ts`: valida competências/datas, avança meses de calendário, ajusta dias 29/30/31 e calcula o dia civil em America/Rio_Branco.
- `money.ts`: converte strings brasileiras para centavos sem `parseFloat` e divide o total com o restante nas primeiras parcelas. Exemplo: 10000/3 = 3334 + 3333 + 3333.
- `entries.ts`: valida o lançamento e gera todas as parcelas. IDs `entryId__index` (índice iniciado em 1); faturas `cardId__YYYY-MM`.
- `commitments.ts`: projeta compromissos sem duplicar a despesa do cartão e calcula atraso sem persistir um status adicional.

Sugestão: fechamento define o ciclo; compras posteriores ao fechamento avançam um ciclo. Se o dia padrão de vencimento for menor ou igual ao dia de fechamento, o vencimento fica no mês seguinte ao ciclo. Igualdade na data real de fechamento (já ajustada ao mês) é ambígua. A competência **escolhida** é persistida e não é recalculada em consultas.

## Limites

- 1 a **24 parcelas** por lançamento, cada uma com no mínimo um centavo.
- Total positivo de até **999.999.999 centavos** (R$ 9.999.999,99).
- Calendário de 1900 a 9999, inclusive a última parcela.

Até cinco parcelas preservam o fluxo atômico anterior. Operações que envolvem um parcelamento com mais de cinco parcelas usam scheduleOperations/current: uma transação inicia e captura origem/destino; cada etapa grava uma parcela e no máximo duas faturas, avançando o cursor; a última transação publica o lançamento e encerra a operação. As regras validam o cursor, os valores, os documentos exigidos e a preservação de faturas pagas. As telas financeiras ficam bloqueadas enquanto a operação estiver ativa e oferecem retomada. Nenhuma rotina de servidor é necessária.

## Repositório e modelo persistido

`saveEntry(uid, { entryId, mutationId, expectedRevision, input })` cria ou edita. Reserve `entryId` uma vez por formulário com `newEntryId`, e um `mutationId` por intenção de envio com `newMutationId`. Reuse o mesmo comando ao repetir uma tentativa que falhou. `expectedRevision: 0` representa criação. Edição usa a revisão carregada.

Cada lançamento contém os campos do contrato, mais:

- `dueDay`: padrão capturado para gerar seu calendário; os vencimentos das cobranças e faturas são materializados.
- `revision`: incrementa ao editar ou excluir; as parcelas têm a mesma revisão.
- `mutationId`: identifica a última intenção de escrita, para repetição segura.
- `deletedAt`: nulo enquanto vigente; timestamp do servidor na exclusão.

Todas as parcelas têm `cardId`, `recurrenceId`, `status` e `settledAt` explícitos. Neste motor sem recorrências, `recurrenceId` é nulo. Em pagamento direto, começam com `status: pending` e `settledAt: null`. Em cartão, ambos são nulos: a liquidação vem da fatura. Entrada em cartão é rejeitada.

A transação lê o lançamento, as referências novas, todas as parcelas antigas e todas as faturas afetadas **antes** de escrever. Valida conflitos e liquidações, grava a revisão e o conjunto completo de parcelas e cria faturas faltantes e atualiza os saldos materializados de todas as faturas afetadas. Timestamps são do servidor. Preserva `createdAt` dos documentos existentes.

A fatura contém `originInstallmentId`, utilizado para validar sua materialização junto com uma cobrança válida. Seu vencimento e os campos de pagamento não são alterados por este repositório. `totalCents`, `chargeCount`, `revision` e os campos de vínculo com o lançamento são atualizados na mesma transação das parcelas. Novas cobranças de uma competência já materializada recebem o vencimento existente, mesmo após editar o padrão do cartão. Faturas que ficam sem cobranças permanecem como cabeçalhos históricos e aparecem como sem movimentação.

Referências a cartões/categorias devem estar ativas e ser compatíveis ao criar ou trocar a referência. Referências já existentes podem ser mantidas em edição mesmo após arquivamento ou mudança de escopo. Para o mesmo cartão, o `dueDay` capturado no lançamento é preservado; trocar de cartão usa o padrão atual do novo cartão.

`deleteEntry(uid, entryId, expectedRevision, mutationId)` exclui todas as parcelas na mesma transação e mantém o lançamento como tombstone com `deletedAt`. As consultas ocultam tombstones. Isso conserva auditoria e impede que uma repetição antiga de cadastro ressuscite o mesmo ID. Não apaga cabeçalhos de fatura.

## Invariantes nas regras

- Somente o UID pessoal em seu próprio caminho.
- Campos, tipos, datas válidas, limites, timestamps do servidor e `createdAt` imutável.
- Lançamento exige todas as parcelas da revisão e ausência das posições não utilizadas.
- Parcela exige lançamento atualizado na mesma operação, ID/índice corretos, valor exato pela divisão e competência de calendário.
- Criação de cabeçalho de fatura exige uma cobrança materializada na mesma operação.
- Não há edição isolada de parcela. Exclusão física de lançamento e alteração de tombstone são negadas.
- Parcelas pagas/recebidas e faturas pagas bloqueiam remoção, alteração e movimentação, inclusive tentativas por SDK fora da interface.

## Fora desta etapa

Confirmação e reversão integral de faturas foram implementadas na etapa de [faturas e histórico](invoices.md). Pagamentos diretos de parcelas, recorrências e suas projeções estão disponíveis na etapa de [recorrências e recebimentos](recurrences-and-receivables.md). Os bloqueios reconhecem liquidações existentes; as faturas também são confirmadas e revertidas pelos testes de integração. As confirmações diretas também são cobertas por testes transacionais; cenários antigos com dados preparados administrativamente continuam como regressões. Não há migração automática de documentos antigos, API própria ou deploy automático.
