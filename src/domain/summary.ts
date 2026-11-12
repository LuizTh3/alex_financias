import { dueDateInMonth, shiftCompetence } from './calendar'
import { installmentInMonth, type Installment } from './installments'
import { invoiceStatusId, type Card, type Income, type InvoiceStatus, type Purchase, type Receivable } from './schemas'

export type PurchaseFilter = 'all' | 'single' | 'installment'
export type FinanceData = { cards: Card[]; purchases: Purchase[]; statuses: InvoiceStatus[]; incomes: Income[]; receivables: Receivable[] }
export type InvoiceRow = { purchase: Purchase; installment: Installment }
export type CardInvoice = { card: Card; month: string; closingDate: string; dueDate: string; totalCents: number; chargeCount: number; paid: boolean }
export type ReceivableRow = { receivable: Receivable; installment: Installment; received: boolean }
export type MonthSummary = { month: string; incomeCents: number; payableCents: number; balanceCents: number; receivableCents: number }

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/**
 * Datas da fatura que vence em `month`. Se o vencimento é depois do fechamento no calendário,
 * os dois caem no mesmo mês; senão o fechamento é no mês anterior.
 */
export function invoiceDates(card: Pick<Card, 'closingDay' | 'dueDay'>, month: string) {
  const closingMonth = card.dueDay > card.closingDay ? month : shiftCompetence(month, -1)
  return { closingDate: dueDateInMonth(closingMonth, card.closingDay), dueDate: dueDateInMonth(month, card.dueDay) }
}

/** Compras do cartão que têm parcela vencendo em `month`, já com a parcela do mês. */
export function invoiceRows(cardId: string, month: string, purchases: Purchase[], filter: PurchaseFilter = 'all'): InvoiceRow[] {
  return purchases
    .filter(purchase => purchase.cardId === cardId)
    .filter(purchase => filter === 'all' || (filter === 'single') === (purchase.installmentCount === 1))
    .flatMap(purchase => {
      const installment = installmentInMonth(purchase, month)
      return installment ? [{ purchase, installment }] : []
    })
    .sort((a, b) => b.purchase.purchaseDate.localeCompare(a.purchase.purchaseDate) || a.purchase.title.localeCompare(b.purchase.title))
}

export const invoiceTotal = (cardId: string, month: string, purchases: Purchase[]) =>
  sum(invoiceRows(cardId, month, purchases).map(row => row.installment.amountCents))

export const isInvoicePaid = (cardId: string, month: string, statuses: InvoiceStatus[]) =>
  statuses.some(status => status.id === invoiceStatusId(cardId, month))

export const activeCards = (cards: Card[]) =>
  cards.filter(card => card.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

/** Faturas do mês de todos os cartões ativos, para a Visão geral. */
export function cardInvoices(month: string, data: Pick<FinanceData, 'cards' | 'purchases' | 'statuses'>): CardInvoice[] {
  return activeCards(data.cards).map(card => ({
    card, month, ...invoiceDates(card, month),
    totalCents: invoiceTotal(card.id, month, data.purchases),
    chargeCount: invoiceRows(card.id, month, data.purchases).length,
    paid: isInvoicePaid(card.id, month, data.statuses),
  }))
}

/** Cartão com compras ou faturas pagas é inativado em vez de apagado. */
export const cardHasData = (cardId: string, data: Pick<FinanceData, 'purchases' | 'statuses'>) =>
  data.purchases.some(purchase => purchase.cardId === cardId) || data.statuses.some(status => status.cardId === cardId)

export const incomeActiveIn = (income: Income, month: string) =>
  income.startMonth <= month && (income.endMonth === null || income.endMonth >= month)

export const incomeInMonth = (month: string, incomes: Income[]) =>
  sum(incomes.filter(income => incomeActiveIn(income, month)).map(income => income.amountCents))

export function receivableRows(month: string, receivables: Receivable[]): ReceivableRow[] {
  return receivables.flatMap(receivable => {
    const installment = installmentInMonth(receivable, month)
    return installment ? [{ receivable, installment, received: receivable.receivedIndexes.includes(installment.index) }] : []
  }).sort((a, b) => a.receivable.title.localeCompare(b.receivable.title, 'pt-BR'))
}

/** Total a receber de terceiros no mês. Informativo: não entra no saldo. */
export function receivableTotals(month: string, receivables: Receivable[]) {
  const rows = receivableRows(month, receivables)
  const totalCents = sum(rows.map(row => row.installment.amountCents))
  const receivedCents = sum(rows.filter(row => row.received).map(row => row.installment.amountCents))
  return { totalCents, receivedCents, pendingCents: totalCents - receivedCents }
}

/** Saldo previsto = renda − soma das faturas dos cartões ativos. "A pagar" inclui faturas já pagas. */
export function monthSummary(month: string, data: FinanceData): MonthSummary {
  const incomeCents = incomeInMonth(month, data.incomes)
  const payableCents = sum(cardInvoices(month, data).map(invoice => invoice.totalCents))
  return { month, incomeCents, payableCents, balanceCents: incomeCents - payableCents, receivableCents: receivableTotals(month, data.receivables).totalCents }
}

export const forecast = (startMonth: string, data: FinanceData, months = 12): MonthSummary[] =>
  Array.from({ length: months }, (_, offset) => monthSummary(shiftCompetence(startMonth, offset), data))

export type ImpactMonth = { month: string; incomeCents: number; cards: { cardId: string; cents: number }[]; totalCents: number; balanceCents: number }

/**
 * Como as faturas dos cartões ativos consomem a renda mês a mês, a partir de `startMonth`,
 * até o último mês com alguma cobrança (no máximo `limit` meses). Cartões em ordem alfabética.
 */
export function incomeImpact(startMonth: string, data: Pick<FinanceData, 'cards' | 'purchases' | 'incomes'>, limit = 12): ImpactMonth[] {
  const cards = activeCards(data.cards)
  const months = Array.from({ length: limit }, (_, offset) => {
    const month = shiftCompetence(startMonth, offset)
    const items = cards.map(card => ({ cardId: card.id, cents: invoiceTotal(card.id, month, data.purchases) }))
    const totalCents = sum(items.map(item => item.cents))
    const incomeCents = incomeInMonth(month, data.incomes)
    return { month, incomeCents, cards: items, totalCents, balanceCents: incomeCents - totalCents }
  })
  let last = -1
  months.forEach((item, index) => { if (item.totalCents > 0) last = index })
  return months.slice(0, last + 1)
}
