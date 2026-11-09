import { describe, expect, it } from 'vitest'
import { installmentInMonth, installmentLabel, installmentsOf, lastMonthOf, monthDiff } from '../src/domain/installments'
import { cardSchema, incomeSchema, invoiceStatusId, purchaseSchema, receivableSchema, type Card, type Income, type Purchase, type Receivable } from '../src/domain/schemas'
import {
  cardHasData, cardInvoices, forecast, incomeInMonth, invoiceDates, invoiceRows, invoiceTotal, monthSummary, receivableRows, receivableTotals, type FinanceData,
} from '../src/domain/summary'

const nubank: Card = { id: 'nu', name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10, active: true }
const inter: Card = { id: 'inter', name: 'Inter', color: '#ff7a00', closingDay: 28, dueDay: 5, active: true }
const old: Card = { id: 'old', name: 'Antigo', color: '#000000', closingDay: 1, dueDay: 8, active: false }
const purchase = (id: string, cardId: string, totalCents: number, installmentCount: number, firstDueMonth: string, purchaseDate = '2026-01-15'): Purchase =>
  ({ id, cardId, title: id, totalCents, installmentCount, firstDueMonth, purchaseDate, description: '' })
const sofa = purchase('Compra sofá', 'nu', 67644, 12, '2026-01')
const income = (id: string, amountCents: number, startMonth: string, endMonth: string | null): Income => ({ id, title: id, amountCents, startMonth, endMonth })
const maico: Receivable = { id: 'maico', title: 'MAICO', totalCents: 35000, installmentCount: 5, launchDate: '2026-02-01', firstDueMonth: '2026-03', description: '', receivedIndexes: [1] }

describe('parcelas calculadas', () => {
  it('reproduz o exemplo do sofá: 676,44 em 12x, parcela 7/12 de 56,37', () => {
    const seventh = installmentInMonth(sofa, '2026-07')!
    expect(seventh).toEqual({ index: 7, count: 12, month: '2026-07', amountCents: 5637 })
    expect(installmentLabel(seventh)).toBe('Parcela 7/12')
  })
  it('reproduz o exemplo do MAICO: 350,00 em 5x, parcela 2/5 de 70,00', () => {
    expect(installmentInMonth(maico, '2026-04')).toEqual({ index: 2, count: 5, month: '2026-04', amountCents: 7000 })
  })
  it('distribui o resto nas primeiras parcelas e preserva o total', () => {
    const parts = installmentsOf({ totalCents: 10000, installmentCount: 3, firstDueMonth: '2026-01' })
    expect(parts.map(part => part.amountCents)).toEqual([3334, 3333, 3333])
  })
  it('atravessa a virada do ano', () => {
    const item = { totalCents: 30000, installmentCount: 3, firstDueMonth: '2026-11' }
    expect(installmentsOf(item).map(part => part.month)).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(lastMonthOf(item)).toBe('2027-01')
  })
  it('não tem parcela antes do primeiro mês nem depois do último', () => {
    expect(installmentInMonth(sofa, '2025-12')).toBeNull()
    expect(installmentInMonth(sofa, '2026-12')).not.toBeNull()
    expect(installmentInMonth(sofa, '2027-01')).toBeNull()
  })
  it('identifica compra à vista', () => {
    expect(installmentLabel(installmentInMonth(purchase('tv', 'nu', 100, 1, '2026-05'), '2026-05')!)).toBe('À vista')
  })
  it('calcula diferença de meses', () => {
    expect(monthDiff('2026-11', '2027-02')).toBe(3)
    expect(monthDiff('2026-03', '2026-01')).toBe(-2)
  })
})

describe('faturas', () => {
  const purchases = [sofa, purchase('tv', 'nu', 150000, 1, '2026-07', '2026-06-20'), purchase('tênis', 'inter', 30000, 3, '2026-06'), purchase('velho', 'old', 99900, 1, '2026-07')]
  it('soma as parcelas do cartão no mês', () => {
    expect(invoiceTotal('nu', '2026-07', purchases)).toBe(5637 + 150000)
    expect(invoiceTotal('inter', '2026-07', purchases)).toBe(10000)
    expect(invoiceTotal('nu', '2025-01', purchases)).toBe(0)
  })
  it('filtra à vista e parcelado', () => {
    expect(invoiceRows('nu', '2026-07', purchases, 'single').map(row => row.purchase.id)).toEqual(['tv'])
    expect(invoiceRows('nu', '2026-07', purchases, 'installment').map(row => row.purchase.id)).toEqual(['Compra sofá'])
    expect(invoiceRows('nu', '2026-07', purchases).map(row => row.purchase.id)).toEqual(['tv', 'Compra sofá'])
  })
  it('calcula fechamento e vencimento no mesmo mês ou com fechamento no mês anterior', () => {
    expect(invoiceDates(nubank, '2026-07')).toEqual({ closingDate: '2026-07-03', dueDate: '2026-07-10' })
    expect(invoiceDates(inter, '2026-03')).toEqual({ closingDate: '2026-02-28', dueDate: '2026-03-05' })
    expect(invoiceDates({ closingDay: 31, dueDay: 31 }, '2026-02')).toEqual({ closingDate: '2026-01-31', dueDate: '2026-02-28' })
  })
  it('lista só cartões ativos, em ordem alfabética, com marcador de pago', () => {
    const statuses = [{ id: invoiceStatusId('nu', '2026-07'), cardId: 'nu', month: '2026-07' }]
    const result = cardInvoices('2026-07', { cards: [nubank, inter, old], purchases, statuses })
    expect(result.map(invoice => [invoice.card.id, invoice.totalCents, invoice.paid])).toEqual([['inter', 10000, false], ['nu', 155637, true]])
  })
  it('indica se o cartão tem dados antes de excluir', () => {
    expect(cardHasData('nu', { purchases, statuses: [] })).toBe(true)
    expect(cardHasData('vazio', { purchases, statuses: [] })).toBe(false)
    expect(cardHasData('vazio', { purchases: [], statuses: [{ id: 'vazio_2026-01', cardId: 'vazio', month: '2026-01' }] })).toBe(true)
  })
})

describe('rendas', () => {
  const incomes = [income('salário', 500000, '2026-01', null), income('freela', 100000, '2026-03', '2026-05')]
  it('soma as rendas vigentes, incluindo início e fim', () => {
    expect(incomeInMonth('2025-12', incomes)).toBe(0)
    expect(incomeInMonth('2026-02', incomes)).toBe(500000)
    expect(incomeInMonth('2026-03', incomes)).toBe(600000)
    expect(incomeInMonth('2026-05', incomes)).toBe(600000)
    expect(incomeInMonth('2026-06', incomes)).toBe(500000)
    expect(incomeInMonth('2030-01', incomes)).toBe(500000)
  })
})

describe('a receber', () => {
  it('lista a parcela do mês com marcador de recebido', () => {
    expect(receivableRows('2026-03', [maico])[0]).toMatchObject({ received: true, installment: { index: 1 } })
    expect(receivableRows('2026-04', [maico])[0]).toMatchObject({ received: false, installment: { index: 2 } })
    expect(receivableRows('2026-08', [maico])).toEqual([])
  })
  it('totaliza recebido e pendente', () => {
    const other: Receivable = { ...maico, id: 'ana', title: 'Ana', totalCents: 10000, installmentCount: 1, receivedIndexes: [] }
    expect(receivableTotals('2026-03', [maico, other])).toEqual({ totalCents: 17000, receivedCents: 7000, pendingCents: 10000 })
  })
})

describe('visão geral e previsão', () => {
  const data: FinanceData = {
    cards: [nubank, old], statuses: [],
    purchases: [sofa, purchase('velho', 'old', 99900, 1, '2026-03')],
    incomes: [income('salário', 500000, '2026-01', null)],
    receivables: [maico],
  }
  it('saldo previsto = renda − faturas; a receber e cartões inativos não entram', () => {
    expect(monthSummary('2026-03', data)).toEqual({ month: '2026-03', incomeCents: 500000, payableCents: 5637, balanceCents: 494363, receivableCents: 7000 })
  })
  it('mostra 12 meses a partir do mês escolhido', () => {
    const months = forecast('2026-03', data)
    expect(months).toHaveLength(12)
    expect(months[0].month).toBe('2026-03')
    expect(months[11].month).toBe('2027-02')
    expect(months[10].payableCents).toBe(0) // sofá terminou em 2026-12
    expect(months[10].balanceCents).toBe(500000)
  })
})

describe('validação dos formulários', () => {
  it('aceita compra à vista e parcelada e apara o título', () => {
    expect(purchaseSchema.parse({ cardId: 'nu', title: '  Sofá ', totalCents: 67644, installmentCount: 12, purchaseDate: '2026-01-15', firstDueMonth: '2026-02' }))
      .toMatchObject({ title: 'Sofá', description: '' })
  })
  it('rejeita compra sem título, acima de 24 parcelas ou com parcela de zero centavo', () => {
    const base = { cardId: 'nu', title: 'x', totalCents: 1000, installmentCount: 1, purchaseDate: '2026-01-15', firstDueMonth: '2026-02' }
    for (const change of [{ title: '  ' }, { installmentCount: 25 }, { totalCents: 2, installmentCount: 3 }, { totalCents: 10.5 }, { firstDueMonth: '2026-13' }])
      expect(purchaseSchema.safeParse({ ...base, ...change }).success).toBe(false)
  })
  it('valida cartão', () => {
    expect(cardSchema.safeParse({ name: 'Nu', color: '#8a05be', closingDay: 3, dueDay: 10 }).success).toBe(true)
    expect(cardSchema.safeParse({ name: 'Nu', color: 'roxo', closingDay: 3, dueDay: 10 }).success).toBe(false)
    expect(cardSchema.safeParse({ name: 'Nu', color: '#8a05be', closingDay: 0, dueDay: 32 }).success).toBe(false)
  })
  it('valida renda com e sem fim', () => {
    expect(incomeSchema.safeParse({ title: 'Salário', amountCents: 500000, startMonth: '2026-01', endMonth: null }).success).toBe(true)
    expect(incomeSchema.safeParse({ title: 'Salário', amountCents: 500000, startMonth: '2026-05', endMonth: '2026-04' }).success).toBe(false)
  })
  it('valida parcelas recebidas', () => {
    const base = { title: 'MAICO', totalCents: 35000, installmentCount: 5, launchDate: '2026-02-01', firstDueMonth: '2026-03' }
    expect(receivableSchema.parse(base).receivedIndexes).toEqual([])
    expect(receivableSchema.safeParse({ ...base, receivedIndexes: [6] }).success).toBe(false)
    expect(receivableSchema.safeParse({ ...base, receivedIndexes: [1, 1] }).success).toBe(false)
  })
})
