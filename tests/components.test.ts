import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { centsToInput, formatDate, formatDayMonth, formatMonth, formatShortMonth, maskMoneyInput } from '../src/domain/format'
import { parseMoneyToCents } from '../src/domain/money'
import { CreditCardVisual } from '../src/components/CreditCardVisual'
import { InstallmentRow } from '../src/components/InstallmentRow'
import { StatusBadge } from '../src/components/StatusBadge'
import { MonthPicker } from '../src/components/MonthPicker'

const html = (type: Parameters<typeof createElement>[0], props: object) => renderToStaticMarkup(createElement(type, props))

describe('formatação', () => {
  it('formata meses e datas', () => {
    expect(formatMonth('2026-03')).toBe('março de 2026')
    expect(formatShortMonth('2026-03')).toBe('mar/26')
    expect(formatDate('2026-07-10')).toBe('10/07/2026')
    expect(formatDayMonth('2026-07-10')).toBe('10/07')
  })
  it('máscara de dinheiro gera texto aceito pelo parser', () => {
    expect(maskMoneyInput('67644')).toBe('676,44')
    expect(maskMoneyInput('R$ 1.234,567')).toBe('12.345,67')
    expect(maskMoneyInput('5')).toBe('0,05')
    expect(maskMoneyInput('000')).toBe('')
    expect(maskMoneyInput('abc')).toBe('')
    for (const typed of ['67644', '123456789', '1']) expect(parseMoneyToCents(maskMoneyInput(typed))).toBe(Number(typed))
    expect(centsToInput(123456)).toBe('1.234,56')
  })
})

describe('componentes', () => {
  const card = { name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10 }
  it('cartão mostra fatura, datas e selo', () => {
    const markup = html(CreditCardVisual, { card, invoice: { totalCents: 155637, closingDate: '2026-07-03', dueDate: '2026-07-10', paid: true, chargeCount: 19 }, onOpen: () => undefined })
    expect(markup).toContain('Nubank')
    expect(markup).toContain('1.556,37')
    expect(markup).toContain('03/07')
    expect(markup).toContain('10/07')
    expect(markup).toContain('Paga')
    expect(markup).toContain('19 cobranças')
    expect(markup).toContain('Fechamento')
    expect(markup).toContain('<button')
  })
  it('cartão sem fatura mostra os dias de fechamento e vencimento', () => {
    const markup = html(CreditCardVisual, { card })
    expect(markup).toContain('dia 3')
    expect(markup).not.toContain('<button')
  })
  it('linha do histórico mostra título, parcela e valor', () => {
    const markup = html(InstallmentRow, { title: 'Compra sofá', installment: { index: 7, count: 12, month: '2026-07', amountCents: 5637 }, onOpen: () => undefined })
    expect(markup).toContain('Compra sofá')
    expect(markup).toContain('Parcela 7/12')
    expect(markup).toContain('56,37')
  })
  it('selos', () => {
    expect(html(StatusBadge, { done: false })).toContain('Pendente')
    expect(html(StatusBadge, { done: true, kind: 'receivable' })).toContain('Recebido')
  })
  it('seletor mostra o mês por extenso', () => {
    expect(html(MonthPicker, { value: '2026-03', onChange: () => undefined })).toContain('Março de 2026')
  })
})
