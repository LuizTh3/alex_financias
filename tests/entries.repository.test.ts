import { resumeSchedule } from '../src/repositories/scheduleRepository'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { generateInstallments, type EntryInput } from '../src/domain/entries'
const state = vi.hoisted(() => ({ db: null as Firestore | null, transactions: 0, failOnTransaction: 0 }))
vi.mock('../src/lib/firebase', () => ({ get db() { return state.db }, auth: { currentUser: { uid: 'Jhi9dIY92RbShnVhAVl5CaHuFJK2' } } }))
vi.mock('firebase/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('firebase/firestore')>()
  return { ...actual, runTransaction: (...args: Parameters<typeof actual.runTransaction>) => {
    state.transactions++
    if (state.transactions === state.failOnTransaction) return Promise.reject(new Error('Interrupção simulada'))
    return actual.runTransaction(...args)
  } }
})
import { changeSettlement } from '../src/repositories/settlementRepository'
import { saveEntry, deleteEntry } from '../src/repositories/entryRepository'
const uid = 'Jhi9dIY92RbShnVhAVl5CaHuFJK2'
const input: EntryInput = { type: 'expense', description: 'Compra', totalCents: 10000, categoryId: 'expense', purchaseDate: '2026-01-10', paymentMethod: 'direct', cardId: null, installmentCount: 3, firstCompetence: '2026-02', dueDay: 31 }
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('motor financeiro no Firestore', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-alex-entries', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
    state.db = env.authenticatedContext(uid).firestore()
  })
  beforeEach(async () => {
    state.transactions = 0; state.failOnTransaction = 0
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      const audit = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      for (const [name, scope] of [['expense', 'expense'], ['expense2', 'expense'], ['income', 'income'], ['both', 'both']]) await setDoc(doc(db, `users/${uid}/categories/${name}`), { name, scope, active: true, ...audit })
      for (const name of ['cardA', 'cardB']) await setDoc(doc(db, `users/${uid}/cards/${name}`), { name, color: '#153f35', closingDay: 5, dueDay: 12, active: true, ...audit })
    })
  })
  afterAll(async () => { await env?.cleanup() })
  const ref = (name: string, id: string) => doc(state.db!, `users/${uid}/${name}/${id}`)
  const save = (value = input, expectedRevision = 0, mutationId = 'mutation1') => saveEntry(uid, { entryId: 'entry', mutationId, expectedRevision, input: value })
  async function rows(name: string) { return (await getDocs(collection(state.db!, `users/${uid}/${name}`))).docs.map(item => ({ ...item.data(), id: item.id })) }
  async function adminUpdate(name: string, id: string, data: Record<string, unknown>) {
    await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), `users/${uid}/${name}/${id}`), data))
  }
  it('retoma após interrupção sem publicar parcialmente nem permitir pular etapas', async () => {
    state.failOnTransaction = 4
    await expect(save({ ...input, installmentCount: 24 })).rejects.toThrow('Interrupção simulada')
    const op = ref('scheduleOperations', 'current')
    expect((await getDoc(op)).data()!.cursor).toBe(2)
    expect((await getDoc(ref('entries', 'entry'))).exists()).toBe(false)
    await assertFails(updateDoc(op, { cursor: 3, updatedAt: serverTimestamp() }))
    const forged = writeBatch(state.db!)
    const { id, ...part } = generateInstallments('entry', { ...input, installmentCount: 24 })[2]
    forged.set(ref('installments', id), { ...part, amountCents: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    forged.update(op, { cursor: 3, updatedAt: serverTimestamp() })
    await assertFails(forged.commit())
    expect((await getDoc(op)).data()!.cursor).toBe(2)
    await assertFails(updateDoc(op, { state: 'done', updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(op))
    await assertFails(getDoc(doc(env.authenticatedContext('other').firestore(), 'users', uid, 'scheduleOperations', 'current')))
    await Promise.all([resumeSchedule(uid), resumeSchedule(uid)])
    expect(await rows('installments')).toHaveLength(24)
    expect((await getDoc(op)).data()!.state).toBe('done')
  })
  it('recebe e reverte a parcela 24 mantendo o histórico', async () => {
    await save({ ...input, type: 'income', categoryId: 'income', installmentCount: 24 })
    const command = { installmentId: 'entry__24', mutationId: 'receive24', expectedEntryRevision: 1, expectedSettlementRevision: 0, expectedAmountCents: 416, action: 'confirm' as const }
    await changeSettlement(uid, command)
    expect((await getDoc(ref('installments', 'entry__24'))).data()!.status).toBe('received')
    await changeSettlement(uid, { ...command, mutationId: 'reverse24', expectedSettlementRevision: 1, action: 'reverse' })
    expect((await getDoc(ref('installments', 'entry__24'))).data()!.status).toBe('pending')
  })
  it('cria 24 parcelas diretas com soma exata, edita para 6 e exclui', async () => {
    await save({ ...input, installmentCount: 24, totalCents: 10001 })
    const parts = await rows('installments')
    expect(parts).toHaveLength(24)
    expect(parts.reduce((sum, part) => sum + part.amountCents, 0)).toBe(10001)
    expect((await getDoc(ref('scheduleOperations', 'current'))).data()!.state).toBe('done')
    await resumeSchedule(uid)
    expect(await rows('installments')).toHaveLength(24)
    await save({ ...input, installmentCount: 6 }, 1, 'shorten')
    expect(await rows('installments')).toHaveLength(6)
    await deleteEntry(uid, 'entry', 2, 'delete24')
    expect(await rows('installments')).toHaveLength(0)
  })
  it('cria 24 faturas, move cartão e competências e preserva os totais', async () => {
    const card = { ...input, installmentCount: 24, paymentMethod: 'card' as const, cardId: 'cardA', dueDay: 12 }
    await save(card)
    expect(await rows('invoices')).toHaveLength(24)
    await save({ ...card, cardId: 'cardB', firstCompetence: '2028-01' }, 1, 'move24')
    const invoices = await rows('invoices')
    expect(invoices.filter(row => row.cardId === 'cardA').every(row => row.totalCents === 0)).toBe(true)
    expect(invoices.filter(row => row.cardId === 'cardB').reduce((sum, row) => sum + row.totalCents, 0)).toBe(10000)
    await deleteEntry(uid, 'entry', 2, 'remove24')
    expect((await rows('invoices')).every(row => row.totalCents === 0)).toBe(true)
  })
  it('rejeita a parcela 25 e não inicia operação para fatura paga', async () => {
    await expect(save({ ...input, installmentCount: 25 })).rejects.toThrow()
    await save({ ...input, installmentCount: 24, paymentMethod: 'card', cardId: 'cardA', dueDay: 12 })
    await adminUpdate('invoices', 'cardA__2026-02', { status: 'paid', paidAt: serverTimestamp(), paidAmountCents: 417 })
    await expect(save({ ...input, installmentCount: 24 }, 1, 'paid24')).rejects.toThrow('faturas')
    expect((await getDoc(ref('scheduleOperations', 'current'))).data()!.state).toBe('done')
  })
  it('salva lançamento e todas as parcelas atomicamente com soma exata', async () => {
    await save()
    const parts = await rows('installments')
    expect(parts).toHaveLength(3)
    expect(parts.map(item => item.amountCents)).toEqual([3334, 3333, 3333])
    expect(parts.map(item => item.dueDate)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
    expect(parts[0].createdAt).toBeTruthy()
  })
  it('uma repetição concorrente do mesmo comando não duplica', async () => {
    await Promise.all([save(), save()])
    expect(await rows('entries')).toHaveLength(1)
    expect(await rows('installments')).toHaveLength(3)
    expect((await getDoc(ref('entries', 'entry'))).data()!.revision).toBe(1)
  })
  it('materializa faturas e preserva vencimento existente após mudança do cartão', async () => {
    await save({ ...input, paymentMethod: 'card', cardId: 'cardA', dueDay: 12 })
    expect(await rows('invoices')).toHaveLength(3)
    await adminUpdate('cards', 'cardA', { dueDay: 20 })
    await saveEntry(uid, { entryId: 'second', mutationId: 'second', expectedRevision: 0, input: { ...input, paymentMethod: 'card', cardId: 'cardA', dueDay: 20, firstCompetence: '2026-04' } })
    expect((await getDoc(ref('installments', 'second__1'))).data()!.dueDate).toBe('2026-04-12')
    expect((await getDoc(ref('installments', 'second__2'))).data()!.dueDate).toBe('2026-05-20')
    expect((await getDoc(ref('entries', 'entry'))).data()!.firstCompetence).toBe('2026-02')
  })
  it('edita todas as parcelas e remove sobras sem perder createdAt', async () => {
    await save()
    const original = (await getDoc(ref('entries', 'entry'))).data()!
    await save({ ...input, totalCents: 12345, installmentCount: 1 }, 1, 'edit')
    expect(await rows('installments')).toHaveLength(1)
    expect((await getDoc(ref('installments', 'entry__1'))).data()!.amountCents).toBe(12345)
    expect((await getDoc(ref('entries', 'entry'))).data()!.createdAt.isEqual(original.createdAt)).toBe(true)
    await expect(save(input, 1, 'stale')).rejects.toThrow('outra aba')
  })
  it('suporta o limite máximo e a troca simultânea de cartão, categoria e competências', async () => {
    const old = { ...input, paymentMethod: 'card' as const, cardId: 'cardA', dueDay: 12, installmentCount: 5 }
    await save(old)
    await save({ ...old, cardId: 'cardB', categoryId: 'expense2', firstCompetence: '2027-10' }, 1, 'move')
    const parts = await rows('installments')
    expect(parts).toHaveLength(5)
    expect(parts.every(item => item.cardId === 'cardB' && item.revision === 2)).toBe(true)
    expect(await rows('invoices')).toHaveLength(10)
  })
  it('bloqueia referências inválidas e permite manter cadastros arquivados em edições', async () => {
    await expect(save({ ...input, categoryId: 'income' })).rejects.toThrow('compatível')
    await adminUpdate('cards', 'cardA', { active: false })
    await expect(save({ ...input, paymentMethod: 'card', cardId: 'cardA', dueDay: 12 })).rejects.toThrow('ativo')
    await save()
    await adminUpdate('categories', 'expense', { active: false })
    await save({ ...input, description: 'Descrição revisada' }, 1, 'edit')
  })
  it('bloqueia edição e exclusão quando uma parcela direta está paga', async () => {
    await save()
    await adminUpdate('installments', 'entry__2', { status: 'paid', settledAt: serverTimestamp() })
    await expect(save({ ...input, totalCents: 20000 }, 1, 'edit')).rejects.toThrow('confirmações')
    await expect(deleteEntry(uid, 'entry', 1, 'delete')).rejects.toThrow('confirmações')
    expect(await rows('installments')).toHaveLength(3)
  })
  it('bloqueia inclusão, edição, remoção e movimentação em faturas pagas', async () => {
    const card = { ...input, paymentMethod: 'card' as const, cardId: 'cardA', dueDay: 12 }
    await save(card)
    await adminUpdate('invoices', 'cardA__2026-03', { status: 'paid', paidAt: serverTimestamp(), paidAmountCents: 3333 })
    await expect(save({ ...card, cardId: 'cardB' }, 1, 'move')).rejects.toThrow('faturas')
    await expect(deleteEntry(uid, 'entry', 1, 'delete')).rejects.toThrow('faturas')
    await expect(saveEntry(uid, { entryId: 'another', expectedRevision: 0, mutationId: 'another', input: { ...card, firstCompetence: '2026-03', installmentCount: 1 } })).rejects.toThrow('faturas')
  })
  it('exclui atomicamente mantendo tombstone e não permite ressuscitar o mesmo ID', async () => {
    await save()
    await deleteEntry(uid, 'entry', 1, 'delete')
    await deleteEntry(uid, 'entry', 1, 'delete')
    expect(await rows('installments')).toHaveLength(0)
    expect((await getDoc(ref('entries', 'entry'))).data()!.deletedAt).toBeTruthy()
    await expect(save()).rejects.toThrow('excluído')
  })
  it('nega escrita isolada de lançamento, parcela e fatura pelo SDK', async () => {
    const batch = writeBatch(state.db!)
    batch.set(ref('entries', 'incomplete'), { ...input, revision: 1, mutationId: 'incomplete', deletedAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
    await save()
    await assertFails(updateDoc(ref('installments', 'entry__1'), { amountCents: 1, updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(ref('installments', 'entry__1')))
    await assertFails(updateDoc(ref('entries', 'entry'), { totalCents: 1, updatedAt: serverTimestamp(), revision: 2, mutationId: 'bad' }))
    await assertFails(setDoc(ref('invoices', 'fake'), { status: 'pending' }))
  })
  it('rejeita lote forjado com centavos divergentes e não deixa resíduos', async () => {
    const batch = writeBatch(state.db!)
    batch.set(ref('entries', 'bad'), { ...input, revision: 1, mutationId: 'bad', deletedAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    for (const { id, ...part } of generateInstallments('bad', input)) batch.set(ref('installments', id), { ...part, amountCents: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
    expect(await rows('entries')).toHaveLength(0)
    expect(await rows('installments')).toHaveLength(0)
  })
  it('cria recebimentos diretos e bloqueia alteração de parcela recebida', async () => {
    await save({ ...input, type: 'income', categoryId: 'income' })
    await adminUpdate('installments', 'entry__1', { status: 'received', settledAt: serverTimestamp() })
    await expect(save({ ...input, type: 'income', categoryId: 'income', totalCents: 20000 }, 1, 'edit')).rejects.toThrow('confirmações')
  })
  it('as regras também negam remoção de parcela liquidada em lote forjado', async () => {
    await save()
    await adminUpdate('installments', 'entry__1', { status: 'paid', settledAt: serverTimestamp() })
    const batch = writeBatch(state.db!)
    batch.update(ref('entries', 'entry'), { deletedAt: serverTimestamp(), updatedAt: serverTimestamp(), revision: 2, mutationId: 'forged' })
    for (const part of generateInstallments('entry', input)) batch.delete(ref('installments', part.id))
    await assertFails(batch.commit())
    expect((await getDoc(ref('entries', 'entry'))).data()!.deletedAt).toBeNull()
    expect(await rows('installments')).toHaveLength(3)
  })
  it('não permite editar vencimento materializado ou registrar pagamento sem histórico atômico', async () => {
    await save({ ...input, cardId: 'cardA', paymentMethod: 'card', dueDay: 12 })
    await assertFails(updateDoc(ref('invoices', 'cardA__2026-02'), { dueDate: '2026-02-20', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref('invoices', 'cardA__2026-02'), { status: 'paid', paidAt: serverTimestamp(), updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref('installments', 'entry__1'), { status: 'paid', settledAt: serverTimestamp(), updatedAt: serverTimestamp() }))
  })

})
