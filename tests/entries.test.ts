import { describe, expect, it } from 'vitest'
import { generateInstallments, entryInputSchema, type EntryInput } from '../src/domain/entries'
import { parseMoneyToCents, splitCents, MAX_INSTALLMENTS } from '../src/domain/money'
import { suggestFirstCompetence } from '../src/domain/calendar'
const input: EntryInput = { type: 'expense', description: 'Compra', totalCents: 10000, categoryId: 'expense', purchaseDate: '2026-01-20', paymentMethod: 'direct', cardId: null, installmentCount: 3, firstCompetence: '2026-01', dueDay: 31 }
describe('centavos e parcelas', () => {
  it('divide R$ 100,00 em 33,34 + 33,33 + 33,33', () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333])
  })
  it('preserva a soma exata, parcelas positivas e diferença máxima de um centavo', () => {
    for (let total = 1; total <= 1000; total++) for (let count = 1; count <= Math.min(total, MAX_INSTALLMENTS); count++) {
      const parts = splitCents(total, count)
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total)
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1)
      expect(Math.min(...parts)).toBeGreaterThan(0)
    }
  })
  it('converte strings BRL sem arredondamento de ponto flutuante', () => {
    expect(parseMoneyToCents('R$ 1.234,56')).toBe(123456)
    expect(parseMoneyToCents('0,29')).toBe(29)
    expect(parseMoneyToCents('100')).toBe(10000)
    for (const value of ['1,005', '1.23', '-1', '0', '1e3', 'Infinity', '10000000,00']) expect(() => parseMoneyToCents(value)).toThrow()
  })
  it('rejeita zero, centavos fracionários, excesso de parcelas e parcelas de zero centavos', () => {
    for (const [total, count] of [[0, 1], [100.1, 1], [1, 2], [10000, 25], [100, 1.5]]) expect(() => splitCents(total, count)).toThrow()
  })
  it('gera IDs estáveis, meses de calendário e vencimentos ajustados', () => {
    const parts = generateInstallments('entry', input)
    expect(parts.map(part => part.id)).toEqual(['entry__1', 'entry__2', 'entry__3'])
    expect(parts.map(part => part.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(generateInstallments('entry', { ...input, firstCompetence: '2024-02' })[0].dueDate).toBe('2024-02-29')
    expect(generateInstallments('entry', { ...input, firstCompetence: '2026-12' })[1].competence).toBe('2027-01')
  })
  it('à vista no cartão é uma cobrança pendente na fatura, sem liquidação própria', () => {
    const [part] = generateInstallments('entry', { ...input, paymentMethod: 'card', cardId: 'card', installmentCount: 1 })
    expect(part.amountCents).toBe(10000)
    expect(part.status).toBeNull()
    expect(part.settledAt).toBeNull()
  })
  it('valida tipo, cartão e limites do calendário', () => {
    expect(entryInputSchema.safeParse({ ...input, type: 'income', paymentMethod: 'card', cardId: 'card' }).success).toBe(false)
    expect(entryInputSchema.safeParse({ ...input, firstCompetence: '9999-12' }).success).toBe(false)
    expect(entryInputSchema.safeParse({ ...input, purchaseDate: '2026-02-30' }).success).toBe(false)
  })
})
describe('sugestão da primeira competência', () => {
  it('considera fechamento e vencimento dentro do mês', () => {
    expect(suggestFirstCompetence('2026-11-04', 5, 12).competence).toBe('2026-11')
    expect(suggestFirstCompetence('2026-11-06', 5, 12).competence).toBe('2026-12')
  })
  it('leva o vencimento para o próximo mês quando antecede o fechamento', () => {
    expect(suggestFirstCompetence('2026-11-20', 25, 5).competence).toBe('2026-12')
    expect(suggestFirstCompetence('2026-11-26', 25, 5).competence).toBe('2027-01')
  })
  it('sinaliza fechamento ambíguo e respeita o fim de fevereiro', () => {
    expect(suggestFirstCompetence('2026-02-28', 31, 5)).toEqual({ competence: '2026-03', ambiguousClosingDate: true })
    expect(suggestFirstCompetence('2026-11-05', 5, 12).ambiguousClosingDate).toBe(true)
  })
})

it('aceita 24 parcelas e preserva valores e meses até a última', () => {
  const parts = generateInstallments('long', { ...input, installmentCount: 24, totalCents: 10001 })
  expect(parts).toHaveLength(24)
  expect(parts[23].id).toBe('long__24')
  expect(parts[23].competence).toBe('2027-12')
  expect(parts.reduce((sum, part) => sum + part.amountCents, 0)).toBe(10001)
  expect(entryInputSchema.safeParse({ ...input, installmentCount: 25 }).success).toBe(false)
})
