import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
const state = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('../src/lib/firebase', () => ({ get db() { return state.db }, personalUid: 'Jhi9dIY92RbShnVhAVl5CaHuFJK2' }))
import { saveRecurrence, materializeOccurrence } from '../src/repositories/recurrenceRepository'
import { saveEntry, deleteEntry } from '../src/repositories/entryRepository'
import { changeSettlement } from '../src/repositories/settlementRepository'
import { changeInvoicePayment } from '../src/repositories/invoiceRepository'
import { financialSchemas, type FinancialRecord } from '../src/repositories/financialSchemas'
import { occurrenceInput } from '../src/domain/recurrences'
import type { RecurrenceInput } from '../src/domain/recurrences'
const uid = 'Jhi9dIY92RbShnVhAVl5CaHuFJK2'
const value: RecurrenceInput = { description: 'Internet', amountCents: 10000, categoryId: 'expense', paymentMethod: 'direct', cardId: null, dueDay: 31 }
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('recorrências e ocorrências no Firestore', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-alex-recurrences', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); state.db = env.authenticatedContext(uid).firestore() })
  beforeEach(async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore(); const audit = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      await setDoc(doc(db, `users/${uid}/categories/expense`), { name: 'Casa', scope: 'expense', active: true, ...audit })
      await setDoc(doc(db, `users/${uid}/cards/card`), { name: 'Pessoal', color: '#153f35', closingDay: 5, dueDay: 12, active: true, ...audit })
    })
  })
  afterAll(async () => { await env?.cleanup() })
  const ref = (name: string, id: string) => doc(state.db!, `users/${uid}/${name}/${id}`)
  async function version(id = 'rec__1'): Promise<FinancialRecord<'recurrenceVersions'>> { const snap = await getDoc(ref('recurrenceVersions', id)); return { ...financialSchemas.recurrenceVersions.parse(snap.data()), id } }
  const create = (input = value) => saveRecurrence(uid, { id: 'rec', mutationId: 'create', expectedRevision: 0, effectiveFrom: '2027-01', action: 'configure', input })
  it('cria versões atômicas e fecha a anterior sem mudar seu valor', async () => {
    await create()
    await saveRecurrence(uid, { id: 'rec', mutationId: 'edit', expectedRevision: 1, effectiveFrom: '2027-03', action: 'configure', input: { ...value, amountCents: 12000 } })
    expect((await version()).amountCents).toBe(10000); expect((await version()).validUntil).toBe('2027-03')
    expect((await version('rec__2')).amountCents).toBe(12000)
    await expect(saveRecurrence(uid, { id: 'rec', mutationId: 'old', expectedRevision: 1, effectiveFrom: '2027-04', action: 'pause' })).rejects.toThrow('outra aba')
  })
  it('duas abas materializam apenas uma ocorrência mensal', async () => {
    await create()
    const v = await version()
    await Promise.all([materializeOccurrence(uid, v, '2027-02'), materializeOccurrence(uid, v, '2027-02')])
    const rows = await getDocs(collection(state.db!, `users/${uid}/installments`))
    expect(rows.size).toBe(1); expect(rows.docs[0].data().dueDate).toBe('2027-02-28')
    expect(rows.docs[0].data().recurrenceId).toBe('rec')
  })
  it('preserva ocorrências personalizadas e excluídas mesmo após nova versão', async () => {
    await create(); const old = await version(); await materializeOccurrence(uid, old, '2027-02')
    await saveEntry(uid, { entryId: 'occ_rec_2027-02', mutationId: 'individual', expectedRevision: 1, input: { ...occurrenceInput(old, '2027-02'), totalCents: 9000 } })
    await saveRecurrence(uid, { id: 'rec', mutationId: 'new', expectedRevision: 1, effectiveFrom: '2027-02', action: 'configure', input: { ...value, amountCents: 15000 } })
    await materializeOccurrence(uid, await version('rec__2'), '2027-02')
    expect((await getDoc(ref('entries', 'occ_rec_2027-02'))).data()!.totalCents).toBe(9000)
    await deleteEntry(uid, 'occ_rec_2027-02', 2, 'delete')
    await materializeOccurrence(uid, await version('rec__2'), '2027-02')
    expect((await getDoc(ref('entries', 'occ_rec_2027-02'))).data()!.deletedAt).toBeTruthy()
    expect((await getDocs(collection(state.db!, `users/${uid}/installments`))).size).toBe(0)
  })
  it('pausa, retoma e encerra preservando o passado e as ocorrências existentes', async () => {
    await create(); await materializeOccurrence(uid, await version(), '2027-03')
    await saveRecurrence(uid, { id: 'rec', mutationId: 'pause', expectedRevision: 1, effectiveFrom: '2027-02', action: 'pause' })
    await expect(materializeOccurrence(uid, await version('rec__2'), '2027-04')).rejects.toThrow()
    await saveRecurrence(uid, { id: 'rec', mutationId: 'resume', expectedRevision: 2, effectiveFrom: '2027-04', action: 'configure', input: value })
    await materializeOccurrence(uid, await version('rec__3'), '2027-04')
    await saveRecurrence(uid, { id: 'rec', mutationId: 'end', expectedRevision: 3, effectiveFrom: '2027-05', action: 'end' })
    expect((await getDoc(ref('entries', 'occ_rec_2027-03'))).exists()).toBe(true)
    await expect(saveRecurrence(uid, { id: 'rec', mutationId: 'resume2', expectedRevision: 4, effectiveFrom: '2027-06', action: 'configure', input: value })).rejects.toThrow('encerrada')
  })
  it('pagamento de ocorrência direta exige documento persistido e não altera modelo', async () => {
    await create(); await materializeOccurrence(uid, await version(), '2027-01')
    await changeSettlement(uid, { installmentId: 'occ_rec_2027-01__1', mutationId: 'pay', expectedEntryRevision: 1, expectedSettlementRevision: 0, expectedAmountCents: 10000, action: 'confirm' })
    expect((await getDoc(ref('installments', 'occ_rec_2027-01__1'))).data()!.status).toBe('paid')
    expect((await version()).amountCents).toBe(10000)
    await saveRecurrence(uid, { id: 'rec', mutationId: 'version', expectedRevision: 1, effectiveFrom: '2027-02', action: 'configure', input: { ...value, amountCents: 13000 } })
    expect((await getDoc(ref('entries', 'occ_rec_2027-01'))).data()!.totalCents).toBe(10000)
  })
  it('cobrança recorrente no cartão deriva pagamento da fatura e não aceita quitação própria', async () => {
    await create({ ...value, paymentMethod: 'card', cardId: 'card', dueDay: 12 })
    await materializeOccurrence(uid, await version(), '2027-01')
    const invoice = (await getDoc(ref('invoices', 'card__2027-01'))).data()!
    expect(invoice.totalCents).toBe(10000)
    await expect(changeSettlement(uid, { installmentId: 'occ_rec_2027-01__1', mutationId: 'direct', expectedEntryRevision: 1, expectedSettlementRevision: 0, expectedAmountCents: 10000, action: 'confirm' })).rejects.toThrow('fatura')
    await changeInvoicePayment(uid, { invoiceId: 'card__2027-01', mutationId: 'pay', action: 'payment', expectedRevision: invoice.revision, expectedTotalCents: 10000 })
    await expect(deleteEntry(uid, 'occ_rec_2027-01', 1, 'delete')).rejects.toThrow('faturas')
  })
  it('regras negam alterações retroativas, versões avulsas e mudanças no histórico', async () => {
    await create()
    await assertFails(updateDoc(ref('recurrenceVersions', 'rec__1'), { amountCents: 1, updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(ref('recurrenceVersions', 'rec__1')))
    const batch = writeBatch(state.db!)
    batch.update(ref('recurrences', 'rec'), { latestFrom: '2026-01', revision: 2, latestVersionId: 'rec__2', mutationId: 'bad', updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
    const { id: _, ...v } = await version()
    await assertFails(setDoc(ref('recurrenceVersions', 'other__1'), { ...v, recurrenceId: 'other', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
  })
  it('um novo vencimento do cartão vale para faturas ainda não materializadas', async () => {
    await create({ ...value, paymentMethod: 'card', cardId: 'card', dueDay: 12 })
    const v = await version(); await materializeOccurrence(uid, v, '2027-01')
    await updateDoc(ref('cards', 'card'), { dueDay: 20, active: false, updatedAt: serverTimestamp() })
    await updateDoc(ref('categories', 'expense'), { active: false, updatedAt: serverTimestamp() })
    await materializeOccurrence(uid, v, '2027-02')
    expect((await getDoc(ref('installments', 'occ_rec_2027-01__1'))).data()!.dueDate).toBe('2027-01-12')
    expect((await getDoc(ref('installments', 'occ_rec_2027-02__1'))).data()!.dueDate).toBe('2027-02-20')
    await saveRecurrence(uid, { id: 'rec', mutationId: 'current-day', expectedRevision: 1, effectiveFrom: '2027-03', action: 'configure', input: { ...value, paymentMethod: 'card', cardId: 'card', dueDay: 20 } })
    expect((await version('rec__2')).dueDay).toBe(20)
  })
  it('substitui uma vigência ainda não materializada no mesmo mês sem apagar versões', async () => {
    await create()
    await saveRecurrence(uid, { id: 'rec', mutationId: 'same-month', expectedRevision: 1, effectiveFrom: '2027-01', action: 'configure', input: { ...value, amountCents: 14000 } })
    expect((await version()).validUntil).toBe('2027-01')
    await materializeOccurrence(uid, await version('rec__2'), '2027-01')
    expect((await getDoc(ref('entries', 'occ_rec_2027-01'))).data()!.totalCents).toBe(14000)
  })
  it('outra conta não acessa modelos, versões ou ocorrências', async () => {
    await create()
    const db = env.authenticatedContext('other').firestore()
    for (const path of ['recurrences/rec', 'recurrenceVersions/rec__1', 'entries/occ_rec_2027-01']) await assertFails(getDoc(doc(db, `users/${uid}/${path}`)))
  })

})
