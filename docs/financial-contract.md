# Contrato financeiro do MVP

Este documento registra as regras acordadas para as próximas etapas. A entrega atual implementa cartões/categorias e o motor de lançamentos, parcelas, centavos, competências e repositórios. Faturas agora também têm listagem mensal, histórico e pagamento integral reversível; recorrências versionadas, ocorrências mensais e confirmações diretas de pagamentos/recebimentos também estão habilitadas. Consulte os detalhes em [Motor financeiro](financial-engine.md).

## Calendário e auditoria

- O mês selecionado é a competência de **vencimento**, `YYYY-MM`. Datas civis usam `YYYY-MM-DD` e não devem ser convertidas em instantes UTC para exibição.
- Todos os documentos têm `createdAt` e `updatedAt` com timestamp do servidor. Confirmações usam `settledAt` ou `paidAt`, também do servidor. `createdAt` é imutável.
- Apresentação de horários e determinação do mês atual usam `America/Rio_Branco`.
- Dias 29/30/31 ajustam ao último dia válido. Parcelas avançam por calendário, nunca por 30 dias. A função `dateInMonth` aplica o ajuste sem alterar o dia padrão cadastrado no cartão.

## Coleções abaixo de `/users/{uid}`

| Coleção | Campos |
| --- | --- |
| cards | name, color (`#RRGGBB`), closingDay (inteiro 1–31), dueDay (inteiro 1–31), active, createdAt, updatedAt |
| categories | name, scope (`expense`, `income`, `both`), active, createdAt, updatedAt |
| entries | type (`expense`/`income`), description, totalCents, categoryId, purchaseDate, paymentMethod (`direct`/`card`), cardId opcional, installmentCount, firstCompetence, dueDay, revision, mutationId, deletedAt, createdAt, updatedAt |
| installments | entryId, revision, index (base 1), count, amountCents, competence, dueDate, cardId opcional, recurrenceId opcional, status/settledAt para pagamento direto ou recebimento, createdAt, updatedAt |
| invoices | ID determinístico cardId+competence; cardId, competence, dueDate, status, paidAt, paidAmountCents, originInstallmentId, totalCents, chargeCount, revision, lastMutationId, lastEntryId, lastEntryRevision, lastEventId, createdAt, updatedAt |
| invoiceEvents | invoiceId, cardId, competence, dueDate, type (payment/reversal), amountCents, invoiceRevision, paymentEventId, paidAt, createdAt, updatedAt |
| recurrences | startCompetence, latestFrom, latestVersionId, revision, state, mutationId, createdAt, updatedAt |
| recurrenceVersions | recurrenceId, revision, effectiveFrom, validUntil, description, amountCents, categoryId, paymentMethod, cardId, dueDay, action, active, createdAt, updatedAt |
| settlementEvents | installmentId, entryId, entryRevision, type, amountCents, dueDate, settlementRevision, confirmationEventId, confirmedAt, description, createdAt, updatedAt |

Status persistidos em inglês: `pending`/`paid` para saídas, `pending`/`received` para entradas. Faturas: `pending`/`paid`; `paidAt` e `paidAmountCents` nulos antes de pagamento. Cobranças em cartão derivam o status da fatura; não têm quitação independente. Atraso é calculado a partir do vencimento civil e do status pendente.

## Cadastros — implementado

- Nomes são aparados nas pontas, obrigatórios e limitados a 120 caracteres. Cor válida de seis dígitos; dias inteiros de 1 a 31. Não há restrição artificial de ordem entre fechamento e vencimento.
- Novos cadastros começam ativos. A tela oferece ativos/arquivados/todos, busca por nome, edição e reativação.
- Arquivamento é uma atualização de `active: false`, com confirmação; não apaga nem altera documentos vinculados. Cadastros arquivados devem ser excluídos das opções de **novos** lançamentos e continuar resolvendo referências históricas.
- Editar cartão não recalcula competências de compras nem altera vencimentos/pagamentos materializados. Os padrões atualizados servem para novos lançamentos e futuras faturas ainda não materializadas.
- Alterar o escopo de uma categoria afeta novas escolhas. Vínculos existentes permanecem, inclusive quando o novo escopo não permitiria criar aquele lançamento hoje.
- Sem exclusão física via SDK. Criação e alteração usam timestamps do servidor. O ID é reservado por formulário para impedir duplicação em tentativas repetidas; a submissão tem bloqueio contra cliques repetidos.
- Edição e arquivamento validam `updatedAt` em transação. Uma versão alterada por outra aba exige reabrir o formulário para evitar perda silenciosa de alterações.
- As regras autorizam somente o UID pessoal em seu próprio caminho, validam campos/tipos, exigem timestamps do servidor e preservam `createdAt`. Senhas e campos extras são rejeitados.

## Compras e parcelas — motor e pagamento integral de faturas implementados

- À vista no cartão é uma cobrança em fatura, não pagamento imediato. A primeira competência é sugerida conforme compra, fechamento e vencimento, exibida antes de salvar e corrigível manualmente. Compra no fechamento é ambígua conforme o banco. Sempre persistir a competência escolhida.
- Uma compra origina uma ou mais cobranças previamente materializadas; fatura soma cobranças por cartão+competência. Pagamento integral manual liquida a fatura e não cria outra despesa. Sem pagamentos parciais, rotativo ou juros no MVP.
- Fatura paga não aceita alterações de valor, inclusão ou remoção de cobranças. Desfazer exige confirmação antes de permitir correção e nova confirmação. Guardar vencimento e valor pago como histórico.
- Formulário recebe valor **total** em centavos e quantidade. Dividir com quociente inteiro e distribuir o resto nas primeiras parcelas: 10000/3 → 3334, 3333, 3333.
- IDs de parcelas determinísticos por lançamento+índice. Salvar lançamento e parcelas atomicamente; impor um limite de parcelas que considere os limites vigentes do Firestore, também as escritas auxiliares e as avaliações de regras.
- Antes de editar/excluir parcelamento, apresentar o alcance. Alterações financeiras só são permitidas sem parcela/fatura vinculada paga/recebida; caso contrário, exigir desfazer confirmações afetadas. Sem edição isolada de parcela no MVP.

## Recorrências e situações — implementado

- Separar modelo recorrente de ocorrências mensais. Modelo não recebe pagamento. Ocorrência direta é quitável; em cartão, quitação é derivada da fatura.
- Projeções combinam versão vigente do modelo e ocorrências existentes. Ao consultar uma competência, materializar só as faltantes, com ID recorrência+competência e controle transacional entre abas. Sem agendador. Edição/quitação individual exige ocorrência persistida.
- Atualizar modelo cria versão com início de vigência; passado preserva versão anterior e valores pagos ficam intactos. Pausar/encerrar a partir de uma competência, mantendo histórico. Apenas frequência mensal.
- Filtro de fixos inclui pagamentos diretos e em cartão. Bloco mensal pago somente quando todas as ocorrências estão liquidadas; vazio mostra “sem gastos”. Fatura sem cobranças mostra “sem movimentação”.

## Limites desta entrega

As consultas leem `entries`, `installments` e `invoices`, somam o cartão pela fatura uma única vez e usam quitação derivada no filtro de fixos. Lançamentos e suas parcelas agora são gravados atomicamente, com materialização de cabeçalhos de fatura, edição do conjunto e exclusão com tombstone. Os dados adicionais e as invariantes estão no [motor financeiro](financial-engine.md). Pagamento integral e reversão de faturas estão disponíveis, com registros imutáveis em `invoiceEvents`; consulte [faturas e histórico](invoices.md). Recorrências e confirmações diretas também estão implementadas; consulte [recorrências e recebimentos](recurrences-and-receivables.md). A política confirmada preserva todas as ocorrências já geradas, inclusive pendentes, ao editar/pausar/encerrar um modelo. Não há migração automática de documentos no formato antigo da inicialização.

Referências técnicas: [transações Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), [validação de campos nas regras](https://firebase.google.com/docs/firestore/security/rules-fields).
