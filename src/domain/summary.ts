import { dueDateInMonth, shiftCompetence } from './calendar'
import { installmentInMonth, type Installment } from './installments'
import { invoiceStatusId, type Card, type Expense, type Income, type InvoiceStatus, type Purchase, type Receivable } from './schemas'

export type PurchaseFilter = 'all' | 'single' | 'installment'
export type FinanceData = { cards: Card[]; purchases: Purchase[]; statuses: InvoiceStatus[]; incomes: Income[]; receivables: Receivable[]; expenses: Expense[] }
export type ExpenseRow = { expense: Expense; amountCents: number; changed: boolean }
export type InvoiceRow = { purchase: Purchase; installment: Installment }
export type CardInvoice = { card: Card; month: string; closingDate: string; dueDate: string; totalCents: number; chargeCount: number; paid: boolean }
export type ReceivableRow = { receivable: Receivable; installment: Installment; received: boolean }
/** `payableCents` = faturas (`invoicesCents`) + despesas mensais (`expensesCents`). */
export type MonthSummary = {
  month: string; incomeCents: number; invoicesCents: number; expensesCents: number; payableCents: number; balanceCents: number; receivableCents: number
}

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

export const expenseActiveIn = (expense: Pick<Expense, 'startMonth' | 'endMonth'>, month: string) =>
  expense.startMonth <= month && (expense.endMonth === null || expense.endMonth >= month)

/** Valor da despesa no mês: o valor trocado só para aquele mês, ou o valor padrão. Fora da vigência, null. */
export function expenseAmountIn(expense: Expense, month: string): number | null {
  if (!expenseActiveIn(expense, month)) return null
  return expense.overrides[month] ?? expense.amountCents
}

/** Despesas vigentes no mês, com o valor do mês. Ordem: categoria e título. */
export function expenseRows(month: string, expenses: Expense[]): ExpenseRow[] {
  return expenses.flatMap(expense => {
    const amountCents = expenseAmountIn(expense, month)
    return amountCents === null ? [] : [{ expense, amountCents, changed: month in expense.overrides }]
  }).sort((a, b) => a.expense.category.localeCompare(b.expense.category, 'pt-BR') || a.expense.title.localeCompare(b.expense.title, 'pt-BR'))
}

export const expensesInMonth = (month: string, expenses: Expense[]) => sum(expenseRows(month, expenses).map(row => row.amountCents))

/** Categorias já usadas, para sugerir no formulário. */
export const expenseCategories = (expenses: Expense[]) =>
  [...new Set(expenses.map(expense => expense.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

/** Saldo previsto = renda − (faturas dos cartões ativos + despesas mensais). "A pagar" inclui faturas já pagas. */
export function monthSummary(month: string, data: FinanceData): MonthSummary {
  const incomeCents = incomeInMonth(month, data.incomes)
  const invoicesCents = sum(cardInvoices(month, data).map(invoice => invoice.totalCents))
  const expensesCents = expensesInMonth(month, data.expenses)
  const payableCents = invoicesCents + expensesCents
  return {
    month, incomeCents, invoicesCents, expensesCents, payableCents,
    balanceCents: incomeCents - payableCents, receivableCents: receivableTotals(month, data.receivables).totalCents,
  }
}

/**
 * Mês que a tela abre por padrão: o mês atual, ou o primeiro mês seguinte que não foi marcado
 * como concluído (novembro concluído → abre em dezembro).
 */
export function defaultMonth(today: string, closedMonths: string[]): string {
  const closed = new Set(closedMonths)
  let month = today
  for (let guard = 0; closed.has(month) && guard < 1200; guard++) month = shiftCompetence(month, 1)
  return month
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

/** Mês do gráfico de impacto na renda, com uma parte por série (cartão ou categoria). */
export type ImpactSeriesMonth = { month: string; incomeCents: number; parts: { id: string; cents: number }[]; totalCents: number; balanceCents: number }

/**
 * Como as despesas mensais consomem a renda mês a mês, a partir de `startMonth`, empilhadas por
 * categoria (ordem alfabética), até o último mês com alguma despesa (no máximo `limit` meses).
 */
export function expenseImpact(startMonth: string, data: Pick<FinanceData, 'expenses' | 'incomes'>, limit = 12): ImpactSeriesMonth[] {
  const categories = expenseCategories(data.expenses)
  const months = Array.from({ length: limit }, (_, offset) => {
    const month = shiftCompetence(startMonth, offset)
    const rows = expenseRows(month, data.expenses)
    const parts = categories.map(category => ({ id: category, cents: sum(rows.filter(row => row.expense.category === category).map(row => row.amountCents)) }))
    const totalCents = sum(parts.map(part => part.cents))
    const incomeCents = incomeInMonth(month, data.incomes)
    return { month, incomeCents, parts, totalCents, balanceCents: incomeCents - totalCents }
  })
  let last = -1
  months.forEach((item, index) => { if (item.totalCents > 0) last = index })
  return months.slice(0, last + 1)
}

/** Prefixo dos ids de categoria no gráfico combinado, para não colidir com ids de cartão. */
export const CATEGORY_SERIES = 'categoria:'

/**
 * Faturas dos cartões ativos e despesas mensais (por categoria) consumindo a renda mês a mês.
 * Partes: cartões em ordem alfabética, depois categorias (`categoria:<nome>`).
 */
export function totalImpact(startMonth: string, data: Pick<FinanceData, 'cards' | 'purchases' | 'expenses' | 'incomes'>, limit = 12): ImpactSeriesMonth[] {
  const cards = activeCards(data.cards)
  const categories = expenseCategories(data.expenses)
  const months = Array.from({ length: limit }, (_, offset) => {
    const month = shiftCompetence(startMonth, offset)
    const rows = expenseRows(month, data.expenses)
    const parts = [
      ...cards.map(card => ({ id: card.id, cents: invoiceTotal(card.id, month, data.purchases) })),
      ...categories.map(category => ({ id: CATEGORY_SERIES + category, cents: sum(rows.filter(row => row.expense.category === category).map(row => row.amountCents)) })),
    ]
    const totalCents = sum(parts.map(part => part.cents))
    const incomeCents = incomeInMonth(month, data.incomes)
    return { month, incomeCents, parts, totalCents, balanceCents: incomeCents - totalCents }
  })
  let last = -1
  months.forEach((item, index) => { if (item.totalCents > 0) last = index })
  return months.slice(0, last + 1)
}

export type MonthBreakdown = {
  summary: MonthSummary
  incomes: Income[]
  expenses: ExpenseRow[]
  invoices: (CardInvoice & { rows: InvoiceRow[] })[]
  receivables: ReceivableRow[]
}

/** Tudo o que compõe um mês: rendas vigentes, faturas dos cartões ativos com as cobranças, e o A receber. */
export function monthBreakdown(month: string, data: FinanceData): MonthBreakdown {
  return {
    summary: monthSummary(month, data),
    incomes: data.incomes.filter(income => incomeActiveIn(income, month))
      .sort((a, b) => b.amountCents - a.amountCents || a.title.localeCompare(b.title, 'pt-BR')),
    expenses: expenseRows(month, data.expenses),
    invoices: cardInvoices(month, data).map(invoice => ({ ...invoice, rows: invoiceRows(invoice.card.id, month, data.purchases) })),
    receivables: receivableRows(month, data.receivables),
  }
}
