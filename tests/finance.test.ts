import { describe, expect, it } from 'vitest'
import { monthlyTotal, shiftMonth } from '../src/domain/finance'
describe('regras financeiras', () => {
  it('navega entre anos e por fevereiro sem desvio de dia', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2024-01', 1)).toBe('2024-02')
  })
  it('soma somente pendências do mês em centavos', () => {
    expect(monthlyTotal([
      { id: 'a', description: 'Conta', amountCents: 1010, dueDate: '2026-11-10', paid: false },
      { id: 'b', description: 'Conta', amountCents: 2020, dueDate: '2026-11-11', paid: false },
      { id: 'c', description: 'Pago', amountCents: 5000, dueDate: '2026-11-12', paid: true },
      { id: 'd', description: 'Futuro', amountCents: 5000, dueDate: '2026-12-12', paid: false },
    ], '2026-11')).toBe(3030)
    expect(monthlyTotal([], '2026-11')).toBe(0)
  })
})
