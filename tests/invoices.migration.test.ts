import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, Timestamp as AdminTimestamp, type Firestore as AdminFirestore } from 'firebase-admin/firestore'
import { doc, getDoc, type Firestore } from 'firebase/firestore'
const state = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('../src/lib/firebase', () => ({ get db() { return state.db }, auth: { currentUser: { uid: 'Jhi9dIY92RbShnVhAVl5CaHuFJK2' } } }))
import { changeInvoicePayment } from '../src/repositories/invoiceRepository'
import { migrateInvoiceBalances } from '../scripts/migrate-invoice-balances.mjs'
const uid = 'Jhi9dIY92RbShnVhAVl5CaHuFJK2'
const projectId = 'demo-alex-migration'
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('migração administrativa de faturas antigas', () => {
  let env: RulesTestEnvironment; let app: App; let database: AdminFirestore
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId, firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
    state.db = env.authenticatedContext(uid).firestore()
    app = initializeApp({ projectId }, 'invoice-migration-tests'); database = getFirestore(app)
  })
  beforeEach(async () => {
    await env.clearFirestore()
    const createdAt = AdminTimestamp.fromDate(new Date('2026-11-01T12:00:00Z'))
    const audit = { createdAt, updatedAt: createdAt }
    const root = database.collection('users').doc(uid)
    await root.collection('entries').doc('entry').set({ type: 'expense', description: 'Compra antiga', totalCents: 12345, categoryId: 'expense', purchaseDate: '2026-10-30', paymentMethod: 'card', cardId: 'card', installmentCount: 1, firstCompetence: '2026-11', dueDay: 12, revision: 1, mutationId: 'create', deletedAt: null, ...audit })
    await root.collection('installments').doc('entry__1').set({ entryId: 'entry', revision: 1, index: 1, count: 1, amountCents: 12345, competence: '2026-11', dueDate: '2026-11-12', cardId: 'card', recurrenceId: null, status: null, settledAt: null, ...audit })
    await root.collection('invoices').doc('card__2026-11').set({ cardId: 'card', competence: '2026-11', dueDate: '2026-11-12', status: 'pending', paidAt: null, paidAmountCents: null, originInstallmentId: 'entry__1', ...audit })
  })
  afterAll(async () => { await env?.cleanup(); if (app) await deleteApp(app) })
  const invoiceRef = () => database.doc(`users/${uid}/invoices/card__2026-11`)
  it('confere sem gravar por padrão', async () => {
    const report = await migrateInvoiceBalances(database, uid)
    expect(report[0].action).toBe('would-migrate')
    expect((await invoiceRef().get()).data()!.revision).toBeUndefined()
  })
  it('preserva vencimento e criação, permite quitar e é repetível', async () => {
    const before = (await invoiceRef().get()).data()!
    await migrateInvoiceBalances(database, uid, { apply: true })
    const migrated = (await invoiceRef().get()).data()!
    expect(migrated.totalCents).toBe(12345); expect(migrated.createdAt.isEqual(before.createdAt)).toBe(true)
    expect(migrated.dueDate).toBe(before.dueDate)
    expect((await migrateInvoiceBalances(database, uid, { apply: true }))[0].action).toBe('already-current')
    await changeInvoicePayment(uid, { invoiceId: 'card__2026-11', action: 'payment', mutationId: 'newpay', expectedRevision: 1, expectedTotalCents: 12345 })
    expect((await getDoc(doc(state.db!, `users/${uid}/invoices/card__2026-11`))).data()!.status).toBe('paid')
  })
  it('preserva confirmação antiga e permite reversão mantendo o evento original', async () => {
    const paidAt = AdminTimestamp.fromDate(new Date('2026-11-05T13:45:00Z'))
    await invoiceRef().update({ status: 'paid', paidAt, paidAmountCents: 12345 })
    await migrateInvoiceBalances(database, uid, { apply: true })
    const migrated = (await invoiceRef().get()).data()!
    const eventRef = database.doc(`users/${uid}/invoiceEvents/${migrated.lastEventId}`)
    expect((await eventRef.get()).data()!.paidAt.isEqual(paidAt)).toBe(true)
    await changeInvoicePayment(uid, { invoiceId: 'card__2026-11', action: 'reversal', mutationId: 'undo', expectedRevision: 1, expectedTotalCents: 12345 })
    expect((await invoiceRef().get()).data()!.status).toBe('pending')
    expect((await eventRef.get()).data()!.amountCents).toBe(12345)
  })
  it('recusa divergências sem modificar cabeçalho ou criar histórico', async () => {
    await invoiceRef().update({ status: 'paid', paidAt: AdminTimestamp.now(), paidAmountCents: 999 })
    await expect(migrateInvoiceBalances(database, uid, { apply: true })).rejects.toThrow('Liquidação divergente')
    expect((await invoiceRef().get()).data()!.revision).toBeUndefined()
    expect((await database.collection(`users/${uid}/invoiceEvents`).get()).size).toBe(0)
  })
})
