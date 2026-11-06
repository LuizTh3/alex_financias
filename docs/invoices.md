# Faturas mensais, histórico e pagamento integral

## Interface

- **Faturas** lista os cartões ativos na competência selecionada, inclusive sem movimentação. Cartões arquivados aparecem quando têm cabeçalho de fatura nesse mês; arquivar não esconde dívidas ou pagamentos.
- Filtros por cartão e situação: pendente, atrasada, paga ou sem movimentação. O mês representa vencimento.
- **Histórico** consulta as competências materializadas, ordenadas da mais recente para a mais antiga. Os filtros também se aplicam ao histórico.
- **Cobranças e histórico** abre a composição da fatura e a sequência imutável de confirmações e reversões.
- Cada cartão no cadastro tem um atalho para suas faturas.
- Confirmação integral mostra cartão, vencimento e valor. **Desfazer pagamento** exige outra confirmação e preserva o registro original.

Sem cobranças, a fatura aparece como **Sem movimentação**, sem botão de pagamento. Atraso é calculado pelo dia civil em America/Rio_Branco, sem persistir outro status. Vencimentos materializados não são recalculados quando o padrão do cartão muda.

## Saldo materializado e concorrência

Faturas agora possuem `totalCents`, `chargeCount` e `revision`. Cada inclusão, edição, movimentação ou exclusão de lançamento atualiza os saldos das faturas antigas e novas **na mesma transação** das parcelas.

As regras verificam o delta a partir do lançamento antes/depois, usando a mesma divisão de centavos e o deslocamento de competência das parcelas. Uma alteração de parcela em cartão só é aceita se a fatura correspondente reconhecer a revisão desse lançamento. O saldo não pode ser modificado isoladamente pelo cliente.

O pagamento lê apenas o cabeçalho com saldo validado e cria um evento na mesma transação. Não é necessário atualizar ou enumerar cada cobrança durante a confirmação, nem criar uma segunda despesa. Isso permite quitar faturas com muitas cobranças sem exceder cotas de consultas das regras. Referências: [agregação na gravação](https://firebase.google.com/docs/firestore/solutions/aggregation), [validação atômica com getAfter](https://firebase.google.com/docs/firestore/security/rules-conditions).

Um comando usa `expectedRevision` e `expectedTotalCents` capturados na confirmação. Se outra aba alterar a fatura, o usuário precisa conferir e confirmar novamente. O SDK repete o mesmo `mutationId` em uma tentativa repetida; eventos já confirmados tornam o comando idempotente, inclusive quando a resposta da primeira tentativa se perde. Repetir uma confirmação antiga após sua reversão não refaz o pagamento.

## Transições e histórico

`changeInvoicePayment(uid, command)` aceita `action: payment | reversal`.

- `pending → paid`: exige movimentação e total positivo. `paidAmountCents` é exatamente o saldo validado. `paidAt` é timestamp do servidor.
- `paid → pending`: limpa apenas os campos de liquidação vigente e registra a reversão, com o valor, vencimento e `paidAt` originais.
- Parcela em cartão não recebe quitação independente. Seu pagamento é derivado da fatura.
- Não há pagamento parcial, rotativo, juros ou integração com bancos. A confirmação é manual, após o usuário efetuar o pagamento.

`users/{uid}/invoiceEvents/{mutationId}` guarda:

| Campo | Conteúdo |
| --- | --- |
| invoiceId, cardId, competence | Identidade da fatura e do cartão |
| dueDate | Vencimento histórico |
| type | payment ou reversal |
| amountCents | Valor integral confirmado ou desfeito |
| invoiceRevision | Revisão da fatura após a operação |
| paymentEventId | ID do próprio pagamento, ou do pagamento original na reversão |
| paidAt | Data da confirmação original; preservada na reversão |
| createdAt, updatedAt | Timestamps do servidor da gravação do evento |

Eventos são criados atomicamente com a mudança de situação da fatura e não podem ser editados ou excluídos. Após desfazer, corrigir e pagar novamente, as três operações permanecem no histórico.

O cabeçalho também tem `lastMutationId`, `lastEventId`, `lastEntryId` e `lastEntryRevision`, para vincular cada transição à gravação responsável. `originInstallmentId`, `createdAt`, cartão, competência e vencimento do cabeçalho permanecem imutáveis.

## Regras e limites

- Apenas o UID pessoal em seu caminho; histórico também é privado.
- Pagamento parcial, histórico isolado, datas falsas, alteração de vencimento e edição do histórico são negados pelo Firestore.
- Fatura paga bloqueia inclusão, remoção ou alteração das cobranças. É preciso desfazer primeiro e editar em uma operação posterior; não é permitido combinar reversão e edição em um mesmo lote.
- O limite de cinco parcelas por lançamento permanece. A edição que troca cartão/categoria e todas as competências continua coberta pelos testes de regras, agora incluindo os saldos antigos/novos.
- Saldo de uma fatura limitado a 999.999.999.999 centavos para preservar aritmética inteira segura. Total de cada lançamento continua limitado a 999.999.999 centavos.
- Cabeçalhos vazios são preservados. Não representam dívida e o histórico de confirmações/reversões continua consultável.

## Migração dos cabeçalhos da etapa anterior

A ferramenta `scripts/migrate-invoice-balances.mjs` confere o formato anterior antes de habilitar os pagamentos. Ela é administrativa, usa o SDK Admin apenas em desenvolvimento e não faz parte da aplicação web nem cria uma API.

Com credenciais administrativas via Application Default Credentials, suspenda clientes antigos, mantenha backup e confira o projeto/UID explicitamente:

```sh
npm run migrate:invoices -- --project SEU_PROJETO --uid SEU_UID
```

O padrão **não grava**. O relatório valida vínculos, revisões, competências, centavos, vencimentos e confirmações existentes. Após conferir o resultado, a aplicação exige o sinalizador explícito:

```sh
npm run migrate:invoices -- --project SEU_PROJETO --uid SEU_UID --apply
```

Cada fatura é migrada atomicamente. Reexecução reconhece cabeçalhos já atualizados e confere seus saldos. Divergências são recusadas. Uma confirmação antiga paga gera um registro histórico que preserva o valor e `paidAt` originais; o cabeçalho mantém vencimento e criação. Não são alterados lançamentos ou parcelas. O comando com `--apply` faz pré-conferência de toda a coleção; falhas concorrentes durante a aplicação ainda podem deixar uma parte já migrada, recuperável por reexecução após corrigir a divergência.

As migrações de faturas pendentes/pagas, o modo de conferência, a repetição e a recusa de divergências são testados no emulador. Não se presume saldo zero e não há migração ou publicação automática. Pagamento direto de parcelas e recorrências continuam fora desta etapa.
