import { describe, expect, it } from 'vitest'
import { applyInvoiceDelta, invoiceSituation, monthlyInvoices } from '../src/domain/invoices'
const card = { id: 'card', name: 'Pessoal', color: '#153f35', active: true, dueDay: 31 }
const header = { id: 'card__2026-02', cardId: 'card', competence: '2026-02', dueDate: '2026-02-12', status: 'pending' as const, totalCents: 3334, chargeCount: 1, revision: 1, paidAmountCents: null }
const charge = { id: 'entry__1', entryId: 'entry', index: 1, count: 3, cardId: 'card', competence: '2026-02', dueDate: '2026-02-12', amountCents: 3334 }
describe('faturas mensais e histórico', () => {
  it('mantém saldo e contagem ao incluir, alterar e remover cobranças', () => {
    expect(applyInvoiceDelta({ totalCents: 3334, chargeCount: 1 }, [], [{ amountCents: 3333 }])).toEqual({ totalCents: 6667, chargeCount: 2 })
    expect(applyInvoiceDelta({ totalCents: 6667, chargeCount: 2 }, [{ amountCents: 3334 }], [{ amountCents: 1234 }])).toEqual({ totalCents: 4567, chargeCount: 2 })
    expect(applyInvoiceDelta({ totalCents: 3334, chargeCount: 1 }, [{ amountCents: 3334 }], [])).toEqual({ totalCents: 0, chargeCount: 0 })
    expect(() => applyInvoiceDelta({ totalCents: 0, chargeCount: 0 }, [{ amountCents: 1 }], [])).toThrow()
  })
  it('cartão sem cobranças mostra sem movimentação mesmo com vencimento passado', () => {
    expect(invoiceSituation({ status: 'pending', dueDate: '2026-01-01', chargeCount: 0 }, '2026-02-01')).toBe('Sem movimentação')
    expect(invoiceSituation({ ...header, dueDate: '2026-01-01' }, '2026-02-01')).toBe('Atrasada')
    expect(invoiceSituation({ ...header, status: 'paid' }, '2026-03-01')).toBe('Paga')
    const [row] = monthlyInvoices('2026-02', [card], [], [])
    expect(row.situation).toBe('Sem movimentação'); expect(row.dueDate).toBe('2026-02-28')
  })
  it('preserva vencimento materializado e inclui cartões arquivados com faturas', () => {
    const [row] = monthlyInvoices('2026-02', [{ ...card, active: false }], [header], [charge])
    expect(row.archived).toBe(true); expect(row.dueDate).toBe('2026-02-12'); expect(row.consistent).toBe(true)
    expect(monthlyInvoices('2026-03', [{ ...card, active: false }], [header], [])).toEqual([])
  })
  it('detecta snapshots desencontrados antes de permitir confirmação', () => {
    const [row] = monthlyInvoices('2026-02', [card], [header], [])
    expect(row.consistent).toBe(false)
    expect(monthlyInvoices('2026-03', [card], [header], [charge])[0].chargeCount).toBe(0)
  })
})
