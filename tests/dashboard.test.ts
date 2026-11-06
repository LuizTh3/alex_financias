import { describe, expect, it } from 'vitest'
import { buildCommitments } from '../src/domain/commitments'
import { summarizeDashboard } from '../src/domain/dashboard'

const entries = [
  { id: 'income', type: 'income' as const, description: 'Salário' },
  { id: 'expense', type: 'expense' as const, description: 'Compra' },
]
const part = { id: 'a', entryId: 'expense', amountCents: 10001, competence: '2026-11', dueDate: '2026-11-10' }
describe('dashboard', () => {
  it('soma faturas uma vez, exclui liquidados e calcula saldo negativo em centavos', () => {
    const view = buildCommitments(entries, [
      { ...part, cardId: 'card' },
      { ...part, id: 'b', cardId: 'card' },
      { ...part, id: 'c', entryId: 'income', amountCents: 15000 },
      { ...part, id: 'd', status: 'paid' },
      { ...part, id: 'e', entryId: 'income', status: 'received' },
      { ...part, id: 'f', competence: '2026-12' },
    ], [], [])
    const summary = summarizeDashboard(view.all, '2026-11')
    expect(summary.outgoing).toBe(20002)
    expect(summary.incoming).toBe(15000)
    expect(summary.balance).toBe(-5002)
    expect(summary.visible).toHaveLength(4)
  })
  it('limita o futuro a 12 meses, inclusive na virada do ano, sem liquidados', () => {
    const view = buildCommitments(entries, [
      part,
      { ...part, id: 'first', competence: '2026-12', dueDate: '2026-12-10' },
      { ...part, id: 'last', competence: '2027-11', dueDate: '2027-11-10', projected: true },
      { ...part, id: 'outside', competence: '2027-12' },
      { ...part, id: 'paid', competence: '2026-12', status: 'paid' },
    ], [], [])
    const summary = summarizeDashboard(view.all, '2026-11', true)
    expect(summary.visible.map(item => item.id)).toEqual(['installment:first', 'installment:last'])
    expect(summary.outgoing).toBe(20002)
  })
  it('retorna zeros para período vazio e não altera a ordem da fonte', () => {
    expect(summarizeDashboard([], '2026-11')).toEqual({ visible: [], incoming: 0, outgoing: 0, balance: 0 })
    const view = buildCommitments(entries, [{ ...part, id: 'z', dueDate: '2026-11-20' }, part], [], [])
    expect(summarizeDashboard(view.all, '2026-11').visible[0].id).toBe('installment:a')
    expect(view.all[0].id).toBe('installment:z')
  })
})
