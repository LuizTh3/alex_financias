import { describe, expect, it, vi } from 'vitest'
import { cardSchema, categorySchema } from '../src/domain/catalog'
import { currentMonth, dateInMonth, formatTimestamp, shiftMonth } from '../src/domain/finance'
describe('cadastros', () => {
  it('normaliza nomes e aceita os limites dos dias sem impor ordem entre fechamento e vencimento', () => {
    const card = cardSchema.parse({ name: '  Pessoal  ', color: '#aAbB00', closingDay: 31, dueDay: 1 })
    expect(card.name).toBe('Pessoal')
    expect(categorySchema.parse({ name: ' Casa ', scope: 'both' }).name).toBe('Casa')
  })
  it('rejeita cadastros inválidos', () => {
    const card = { name: 'Pessoal', color: '#153f35', closingDay: 5, dueDay: 12 }
    for (const invalid of [{ name: '   ' }, { name: 'x'.repeat(121) }, { closingDay: 0 }, { dueDay: 32 }, { dueDay: 1.5 }, { dueDay: NaN }, { color: 'red' }, { active: true }]) {
      expect(cardSchema.safeParse({ ...card, ...invalid }).success).toBe(false)
    }
    expect(categorySchema.safeParse({ name: 'Casa', scope: 'other' }).success).toBe(false)
  })
})
describe('calendário civil e apresentação de horários', () => {
  it('ajusta dias 29, 30 e 31 no mês de vencimento', () => {
    expect(dateInMonth('2026-02', 29)).toBe('2026-02-28')
    expect(dateInMonth('2026-02', 30)).toBe('2026-02-28')
    expect(dateInMonth('2024-02', 31)).toBe('2024-02-29')
    expect(dateInMonth('2026-04', 31)).toBe('2026-04-30')
    expect(dateInMonth(shiftMonth('2026-01', 1), 31)).toBe('2026-02-28')
    expect(dateInMonth(shiftMonth('2026-01', 2), 31)).toBe('2026-03-31')
    expect(() => dateInMonth('2026-13', 31)).toThrow()
  })
  it('usa Rio Branco na virada do mês e nos horários', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-11-01T04:59:00Z'))
      expect(currentMonth()).toBe('2026-10')
      expect(formatTimestamp(new Date())).toContain('23:59')
      vi.setSystemTime(new Date('2026-11-01T05:00:00Z'))
      expect(currentMonth()).toBe('2026-11')
    } finally { vi.useRealTimers() }
  })
})
