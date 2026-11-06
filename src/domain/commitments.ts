import { todayCivil } from './calendar'
// Apenas projeção de registros persistidos; não materializa recorrências ou cobranças.
export type EntrySummary = { id: string; type: 'expense' | 'income'; description: string }
export type InstallmentSummary = {
  id: string; entryId: string; amountCents: number; competence: string; dueDate: string;
  projected?: boolean; cardId?: string | null; recurrenceId?: string | null; status?: 'pending' | 'paid' | 'received' | null;
}
export type InvoiceSummary = { cardId: string; competence: string; dueDate: string; status: 'pending' | 'paid' }
export type CommitmentView = {
  id: string; description: string; amountCents: number; dueDate: string; paid: boolean;
  competence: string; income: boolean; fixed: boolean; cardId?: string; projected?: boolean;
}
export function buildCommitments(
  entries: EntrySummary[], installments: InstallmentSummary[], invoices: InvoiceSummary[],
  cards: { id: string; name: string }[],
) {
  const entryMap = new Map(entries.map(entry => [entry.id, entry]))
  const invoiceMap = new Map(invoices.map(invoice => [`${invoice.cardId}:${invoice.competence}`, invoice]))
  const cardMap = new Map(cards.map(card => [card.id, card]))
  const charges: CommitmentView[] = installments.map(item => {
    const entry = entryMap.get(item.entryId)
    const invoice = item.cardId ? invoiceMap.get(`${item.cardId}:${item.competence}`) : undefined
    return {
      id: `installment:${item.id}`, description: entry?.description ?? 'Cobrança recorrente', amountCents: item.amountCents,
      dueDate: invoice?.dueDate ?? item.dueDate,
      paid: item.projected ? false : item.cardId ? invoice?.status === 'paid' : item.status === 'paid' || item.status === 'received',
      competence: item.competence, income: entry?.type === 'income', fixed: !!item.recurrenceId, cardId: item.cardId ?? undefined, projected: item.projected ?? false,
    }
  })
  const groups = new Map<string, CommitmentView>()
  for (const charge of charges) {
    if (!charge.cardId) continue
    const key = `${charge.cardId}:${charge.competence}:${charge.projected ? 'projection' : 'actual'}`
    const existing = groups.get(key)
    if (existing) existing.amountCents += charge.amountCents
    else groups.set(key, { ...charge, id: `invoice:${key}`, description: `${charge.projected ? 'Projeção · ' : ''}Fatura · ${cardMap.get(charge.cardId)?.name ?? 'Cartão'}`, income: false })
  }
  const invoiceRows = [...groups.values()]
  // Um cartão aparece no total pela fatura, evitando contar a compra duas vezes.
  const outgoing = [...invoiceRows, ...charges.filter(item => !item.cardId && !item.income)]
  const incoming = charges.filter(item => !item.cardId && item.income)
  return { charges, invoiceRows, outgoing, incoming, all: [...outgoing, ...incoming] }
}
export function outstandingTotal(items: CommitmentView[], competence: string): number {
  return items.filter(item => item.competence === competence && !item.paid).reduce((sum, item) => sum + item.amountCents, 0)
}

export function commitmentSituation(item: Pick<CommitmentView, 'paid' | 'income' | 'dueDate'>, today = todayCivil()) {
  if (item.paid) return item.income ? 'Recebido' : 'Pago'
  return item.dueDate < today ? 'Atrasado' : 'Pendente'
}
