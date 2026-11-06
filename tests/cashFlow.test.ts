import { describe, it, expect } from 'vitest'
import { accountBalance, projectCashFlow } from '../src/domain/cashFlow'
import type { CommitmentView } from '../src/domain/commitments'
const item = (id: string, amountCents: number, dueDate: string, income = false): CommitmentView => ({ id, amountCents, dueDate, income, competence: dueDate.slice(0, 7), description: id, paid: false, fixed: false })
describe('fluxo de caixa', () => {
  it('preserva saldo com recebimento e reversão', () => {
    expect(accountBalance(10000, [{ id: 'a', amountCents: 5000, date: '2026-11-06' }, { id: 'b', amountCents: -5000, date: '2026-11-07', reversesId: 'a' }])).toBe(10000)
  })
  it('recusa duplicidade e reversão sem origem', () => {
    expect(() => accountBalance(0, [{ id: 'a', amountCents: 1, date: '' }, { id: 'a', amountCents: 1, date: '' }])).toThrow()
    expect(() => accountBalance(0, [{ id: 'b', amountCents: -1, date: '', reversesId: 'a' }])).toThrow()
  })
  it('carrega saldo, inclui atrasados e identifica falta antes do salário', () => {
    const result = projectCashFlow(10000, [item('atraso', 5000, '2026-10-01'), item('conta', 10000, '2026-11-10'), item('salario', 30000, '2026-11-20', true)], '2026-11-06', 1)
    expect(result.firstNegativeDate).toBe('2026-11-10')
    expect(result.rows[0].closing).toBe(25000)
    expect(result.rows[1].opening).toBe(25000)
    expect(result.rows[1].closing).toBe(25000)
  })
  it('confirmação move previsão para saldo sem duplicar dinheiro', () => {
    const receipt = item('r', 5000, '2026-11-10', true)
    expect(projectCashFlow(10000, [receipt], '2026-11-06').rows[0].closing).toBe(projectCashFlow(15000, [{ ...receipt, paid: true }], '2026-11-06').rows[0].closing)
  })
})
