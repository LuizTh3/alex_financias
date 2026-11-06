import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { generateInstallments, type EntryInput } from '../src/domain/entries'
const state = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('../src/lib/firebase', () => ({ get db() { return state.db }, personalUid: 'Jhi9dIY92RbShnVhAVl5CaHuFJK2' }))
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
