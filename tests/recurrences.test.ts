import { describe, it, expect } from 'vitest'
import { versionForMonth, projectRecurrences, occurrenceInput, fixedBlockSituation, type RecurrenceVersion } from '../src/domain/recurrences'
const base: RecurrenceVersion = { id: 'rec__1', recurrenceId: 'rec', revision: 1, effectiveFrom: '2026-01', validUntil: '2026-11', description: 'Internet', amountCents: 10000, categoryId: 'expense', paymentMethod: 'direct', cardId: null, dueDay: 31, active: true, action: 'configure' }
describe('recorrências mensais versionadas', () => {
  it('seleciona a versão por vigência e preserva projeções passadas', () => {
    const next = { ...base, id: 'rec__2', revision: 2, effectiveFrom: '2026-11', validUntil: null, amountCents: 12000 }
    expect(versionForMonth([base, next], 'rec', '2026-10')?.amountCents).toBe(10000)
    expect(versionForMonth([base, next], 'rec', '2026-11')?.amountCents).toBe(12000)
    expect(occurrenceInput(base, '2026-02').dueDay).toBe(31)
    expect(occurrenceInput(base, '2026-02').firstCompetence).toBe('2026-02')
  })
  it('não projeta duplicatas, ocorrências personalizadas ou tombstones', () => {
    const versions = [{ ...base, validUntil: null }]
    expect(projectRecurrences('2026-02', [{ id: 'rec' }], versions, [])).toHaveLength(1)
    expect(projectRecurrences('2026-02', [{ id: 'rec' }], versions, [{ id: 'occ_rec_2026-02', recurrenceId: 'rec', firstCompetence: '2026-02' }])).toEqual([])
  })
  it('pausa/encerramento interrompem somente novas projeções na sua vigência', () => {
    const pause = { ...base, id: 'rec__2', revision: 2, effectiveFrom: '2026-11', validUntil: null, active: false, action: 'pause' as const }
    expect(projectRecurrences('2026-10', [{ id: 'rec' }], [base, pause], [])).toHaveLength(1)
    expect(projectRecurrences('2026-11', [{ id: 'rec' }], [base, pause], [])).toEqual([])
    expect(() => occurrenceInput(pause, '2026-11')).toThrow()
  })
  it('o bloco mensal é pago apenas se todas as ocorrências estiverem liquidadas', () => {
    expect(fixedBlockSituation([])).toBe('Sem gastos')
    expect(fixedBlockSituation([{ paid: true }, { paid: false }])).toBe('Pendente')
    expect(fixedBlockSituation([{ paid: true }])).toBe('Pago')
  })
})

 it('projeta renda mensal e mantém compatibilidade com despesas antigas', () => {
   const income = { ...base, type: 'income' as const, validUntil: null }
   expect(occurrenceInput(income, '2026-11').type).toBe('income')
   expect(occurrenceInput({ ...base, validUntil: null }, '2026-11').type).toBe('expense')
   expect(projectRecurrences('2026-11', [{ id: 'rec' }], [income], [{ id: 'occ_rec_2026-11', firstCompetence: '2026-11' }])).toEqual([])
 })
