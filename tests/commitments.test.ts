import { describe, expect, it } from 'vitest'
import { buildCommitments, outstandingTotal, commitmentSituation } from '../src/domain/commitments'
describe('consulta de compromissos persistidos', () => {
  const entries = [{ id: 'purchase', type: 'expense' as const, description: 'Internet' }]
  const charges = [{ id: 'part', entryId: 'purchase', amountCents: 10000, competence: '2026-11', dueDate: '2026-11-10', cardId: 'card', recurrenceId: 'internet' }]
  it('soma cobranças do cartão uma vez e deriva quitação da fatura', () => {
    const view = buildCommitments(entries, charges, [], [{ id: 'card', name: 'Pessoal' }])
    expect(outstandingTotal(view.outgoing, '2026-11')).toBe(10000)
    expect(view.charges[0].fixed).toBe(true)
    const paid = buildCommitments(entries, charges, [{ cardId: 'card', competence: '2026-11', dueDate: '2026-11-12', status: 'paid' }], [])
    expect(paid.charges[0].paid).toBe(true)
    expect(paid.charges[0].dueDate).toBe('2026-11-12')
    expect(outstandingTotal(paid.outgoing, '2026-11')).toBe(0)
  })
  it('não cria dívida para cartão sem cobranças e filtra pela competência', () => {
    expect(buildCommitments([], [], [], [{ id: 'card', name: 'Pessoal' }]).invoiceRows).toEqual([])
    const view = buildCommitments(entries, charges, [], [])
    expect(outstandingTotal(view.outgoing, '2026-10')).toBe(0)
  })
  it('calcula atraso sem persistir outro status e respeita liquidações', () => {
    expect(commitmentSituation({ paid: false, income: false, dueDate: '2026-11-05' }, '2026-11-06')).toBe('Atrasado')
    expect(commitmentSituation({ paid: false, income: true, dueDate: '2026-11-06' }, '2026-11-06')).toBe('Pendente')
    expect(commitmentSituation({ paid: true, income: true, dueDate: '2026-11-05' }, '2026-11-06')).toBe('Recebido')
  })

  it('projeções novas em cartão não herdam a liquidação de cobranças existentes', () => {
    const projected = [{ ...charges[0], id: 'projected', projected: true }]
    const view = buildCommitments(entries, [...charges, ...projected], [{ cardId: 'card', competence: '2026-11', dueDate: '2026-11-12', status: 'paid' }], [])
    expect(outstandingTotal(view.outgoing, '2026-11')).toBe(10000)
    expect(view.invoiceRows).toHaveLength(2)
    expect(view.charges.find(charge => charge.projected)?.paid).toBe(false)
  })

})
