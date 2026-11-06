import { dueDateInMonth, todayCivil } from './calendar'
import { invoiceId } from './entries'
export const MAX_INVOICE_CENTS = 999_999_999_999
export type InvoiceBalance = { totalCents: number; chargeCount: number }
export type InvoiceCharge = { id: string; cardId: string | null; competence: string; amountCents: number; entryId: string; index: number; count: number; dueDate: string }
export type MonthlyInvoiceHeader = InvoiceBalance & {
  id: string; cardId: string; competence: string; dueDate: string; status: 'pending' | 'paid'; revision: number;
  paidAmountCents: number | null;
}
export type InvoiceCard = { id: string; name: string; color: string; active: boolean; dueDay: number }
export function applyInvoiceDelta(balance: InvoiceBalance, previous: Pick<InvoiceCharge, 'amountCents'>[], next: Pick<InvoiceCharge, 'amountCents'>[]): InvoiceBalance {
  const totalCents = balance.totalCents - previous.reduce((sum, part) => sum + part.amountCents, 0) + next.reduce((sum, part) => sum + part.amountCents, 0)
  const chargeCount = balance.chargeCount - previous.length + next.length
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > MAX_INVOICE_CENTS
    || !Number.isSafeInteger(chargeCount) || chargeCount < 0 || (chargeCount === 0 ? totalCents !== 0 : totalCents < chargeCount)) throw new Error('Saldo de fatura inconsistente.')
  return { totalCents, chargeCount }
}
export function invoiceSituation(header: Pick<MonthlyInvoiceHeader, 'status' | 'dueDate' | 'chargeCount'>, today = todayCivil()) {
  if (header.status === 'paid') return 'Paga'
  if (header.chargeCount === 0) return 'Sem movimentação'
  return header.dueDate < today ? 'Atrasada' : 'Pendente'
}
export function monthlyInvoices(month: string, cards: InvoiceCard[], invoices: MonthlyInvoiceHeader[], installments: InvoiceCharge[]) {
  const monthly = invoices.filter(invoice => invoice.competence === month)
  const cardMap = new Map(cards.map(card => [card.id, card]))
  const ids = new Set([...cards.filter(card => card.active).map(card => card.id), ...monthly.map(invoice => invoice.cardId)])
  return [...ids].map(cardId => {
    const card = cardMap.get(cardId)
    const header = monthly.find(invoice => invoice.cardId === cardId) ?? null
    const charges = installments.filter(part => part.cardId === cardId && part.competence === month).sort((a, b) => a.id.localeCompare(b.id))
    const balance = header ?? { totalCents: 0, chargeCount: 0 }
    return {
      id: invoiceId(cardId, month), competence: month, cardId, card, header, charges,
      name: card?.name ?? 'Cartão indisponível', color: card?.color ?? '#68796f', archived: card ? !card.active : true,
      dueDate: header?.dueDate ?? (card ? dueDateInMonth(month, card.dueDay) : null),
      totalCents: balance.totalCents, chargeCount: balance.chargeCount,
      situation: header ? invoiceSituation(header) : 'Sem movimentação',
      consistent: header ? charges.length === header.chargeCount && charges.reduce((sum, part) => sum + part.amountCents, 0) === header.totalCents : charges.length === 0,
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
