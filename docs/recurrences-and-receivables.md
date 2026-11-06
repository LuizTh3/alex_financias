# Recorrências versionadas, ocorrências e recebimentos parcelados

## Comportamento acordado

**Ocorrências já geradas são preservadas**, inclusive pendentes, personalizadas, pagas ou excluídas individualmente. Editar, pausar, retomar ou encerrar um modelo afeta somente competências ainda não materializadas. A interface mostra esse alcance antes de confirmar.

O MVP usa frequência mensal e recorrências de despesas. Recebimentos parcelados são lançamentos de entrada, independentes das recorrências, com a divisão exata de centavos já utilizada pelo motor financeiro.

## Modelos e versões

`users/{uid}/recurrences/{id}` contém:

- `startCompetence`: início original, imutável.
- `latestFrom`, `latestVersionId`, `revision`: última vigência e ponteiro da versão.
- `state`: active, paused ou ended; descreve a última configuração, que pode ter início futuro.
- `mutationId`, `createdAt`, `updatedAt`: idempotência e auditoria.

`users/{uid}/recurrenceVersions/{recurrenceId}__{revision}` contém os dados financeiros (`description`, `amountCents`, `categoryId`, `paymentMethod`, `cardId`, `dueDay`), além de `recurrenceId`, `revision`, `effectiveFrom`, `validUntil`, `action`, `active`, `createdAt` e `updatedAt`.

A vigência começa em `effectiveFrom`, inclusive, e termina em `validUntil`, exclusive. A última versão tem `validUntil: null`. Ao acrescentar uma versão, a transação fecha apenas o intervalo da anterior; seus dados financeiros não são alterados. As regras tornam os valores antigos imutáveis.

Novas vigências seguem ordem cronológica e começam no mês atual ou futuro, sem anteceder a última vigência agendada. É possível substituir uma vigência no mesmo mês por outra versão: a anterior fica com intervalo vazio, mas não é apagada. Pausa admite retomada por nova configuração; encerramento é definitivo e exige criar outro modelo para reiniciar. Uma pausa ou encerramento futuro não impede gerar ocorrências dos meses anteriores ao início dessa vigência.

## Ocorrências mensais

As ocorrências usam as coleções existentes:

- lançamento `entries/occ_{recurrenceId}_{YYYY-MM}`, com `recurrenceId` e `recurrenceVersionId`;
- uma cobrança `installments/{entryId}__1`, com `recurrenceId`;
- fatura e seu saldo, quando a cobrança é em cartão.

A escolha do ID é determinística. O repositório transacional valida a versão vigente e cria o lançamento, a cobrança e o saldo da fatura atomicamente. Duas abas concorrentes não geram duplicação. Ocorrências existentes nunca são sobrescritas na geração automática. Tombstones de exclusões individuais impedem recriação.

Ao consultar o mês em Despesas fixas, Visão geral, Lançamentos ou Faturas, o app gera somente as ocorrências faltantes. Não há agendador. Faturas pagas bloqueiam a inclusão: a interface mantém acesso às faturas para desfazer a quitação antes de tentar novamente.

Nas consultas de Compromissos futuros, são somadas projeções de recorrências dos próximos 12 meses aos registros já persistidos. Projeções não gravam documentos dos demais meses. Uma ocorrência existente, mesmo personalizada ou excluída, prevalece sobre o modelo. Uma projeção nova não herda o pagamento de uma fatura existente; é identificada como estimativa.

Dias 29/30/31 ajustam ao fim do mês. Em cartão, uma nova ocorrência consulta o dia padrão **atual** do cartão para faturas ainda não materializadas; se a competência já tem fatura, seu vencimento é preservado. O valor e a categoria vêm da versão vigente. Modelos existentes podem continuar usando referências posteriormente arquivadas, mas novos modelos e trocas de referência exigem cadastros ativos.

## Edição e pagamento individual

É necessário persistir a ocorrência antes de editar ou pagar. A edição individual não modifica o modelo e mantém identidade, competência e quantidade de uma cobrança. Pode alterar os dados financeiros enquanto não houver liquidação. Excluir pede confirmação e afeta somente a ocorrência, conservando o modelo e as demais competências.

- Direto: a ocorrência é confirmada manualmente como paga, com timestamp do servidor.
- Cartão: o pagamento é derivado da fatura; não há botão independente de quitação.
- O bloco de gastos fixos fica Pago somente se todas as ocorrências conhecidas do mês estiverem liquidadas; vazio mostra Sem gastos. Falha de geração é mostrada como Verificar.

## Recebimentos parcelados e histórico

Em A receber, “Novo recebimento” abre um lançamento de entrada. Informe o valor **total** e de uma a cinco parcelas; R$ 100,00 em três gera R$ 33,34 + R$ 33,33 + R$ 33,33. Todas as parcelas futuras são persistidas no cadastro.

Cada parcela direta pode ser confirmada integralmente como received (entrada) ou paid (saída). As demais parcelas não são alteradas. Reversão exige confirmação e retorna somente essa parcela a pending. O atraso é calculado pelo vencimento civil, e horários são exibidos em America/Rio_Branco.

`settlementRevision` e `lastSettlementEventId` são adicionados à cobrança na primeira confirmação. Não alteram a revisão financeira do lançamento. Edições posteriores, após reversão, preservam esse contador e os registros históricos. Documentos anteriores, sem esses dois campos, representam contador zero e não exigem migração.

`users/{uid}/settlementEvents/{mutationId}` é imutável e guarda `installmentId`, `entryId`, `entryRevision`, `type` (payment/receipt/reversal), `amountCents`, `dueDate`, `settlementRevision`, `confirmationEventId`, `confirmedAt`, `description`, `createdAt` e `updatedAt`. A reversão preserva data e valor da confirmação original. O histórico de recebimentos inclui registros mesmo quando a parcela foi removida após desfazer a confirmação.

Confirmações usam revisão financeira, contador de liquidação, valor e ID de intenção capturados na tela. Repetir o mesmo envio, inclusive em duas abas, não duplica eventos; repetir uma confirmação antiga depois de sua reversão não a refaz.

## Proteção no Firestore

- Apenas o UID pessoal no próprio caminho.
- Modelos e versões exigem transação vinculada, auditoria do servidor e referências válidas.
- Versões antigas não aceitam alterações financeiras nem exclusão.
- Geração de ocorrência exige ID, competência, versão vigente e valores exatos.
- Identidade e competência de uma ocorrência não podem ser alteradas por edição individual.
- Parcela em cartão não pode ser confirmada diretamente.
- Confirmações diretas e eventos são atômicos; pagamentos parciais e histórico avulso são negados.
- Reversão não pode ser combinada com edição financeira no mesmo lote.
- Lançamentos parcelados pagos/recebidos continuam bloqueados para alterações financeiras até desfazer todas as liquidações afetadas.

As regras e índices necessários são locais; nenhum deploy ou migração de produção é executado automaticamente. Não há nova API, agendador ou cobrança bancária automática.
