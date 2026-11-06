# Conta e renda recorrente

A conta única inicia com o saldo disponível informado hoje. Eventos anteriores não são importados. Saldo = abertura + movimentos imutáveis em centavos. Ajustes exigem justificativa e registram a diferença, não substituem o saldo.

Confirmações de recebimentos, despesas diretas e faturas oferecem uma escolha explícita para movimentar Minha conta. A escolha desmarcada representa dinheiro fora da conta controlada. A projeção assume que as pendências serão movimentadas nesta conta; confirmações externas retiram a pendência sem alterar o saldo, atualizando a previsão.

Movimento e confirmação são escritos na mesma transação. IDs derivam do evento, impedindo duplicação. Reversões procuram o movimento original e criam o valor oposto; nunca recalculam o valor pelo modelo atual. Regras exigem o movimento associado quando solicitado, exigem reversão quando a origem movimentou a conta e proíbem editar/apagar o histórico.

Recorrências antigas continuam sendo despesas. Novas versões podem ser renda ou despesa, com tipo imutável por modelo. Renda aceita somente recebimento direto e categoria de renda/ambas. Configure valor líquido. Ocorrências mensais são pendências, não crédito automático. Versões e ocorrências já geradas mantêm as regras anteriores de preservação.

A projeção parte de hoje, inclui atrasados e o restante do mês, depois os próximos 12 meses. O saldo final passa ao mês seguinte uma vez. Faturas agrupam compras sem duplicação. Entradas e saídas são agrupadas por dia: o alerta indica saldo negativo ao final do dia, sem inferir horários bancários. O saldo atual é manual, não sincronizado com bancos. Não há pagamentos parciais ou múltiplas contas nesta versão.

Para disponibilizar a funcionalidade, publique as regras do Firestore junto com a aplicação. A coleção accounts usa o documento main; accountMovements contém histórico somente de criação.
