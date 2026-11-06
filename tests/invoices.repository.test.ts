import { initializeAccount } from '../src/repositories/accountRepository'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, Timestamp, type Firestore } from 'firebase/firestore'
import type { EntryInput } from '../src/domain/entries'
const state = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('../src/lib/firebase', () => ({ get db() { return state.db }, auth: { currentUser: { uid: 'Jhi9dIY92RbShnVhAVl5CaHuFJK2' } } }))
import { saveEntry, deleteEntry } from '../src/repositories/entryRepository'
import { changeInvoicePayment, type InvoiceCommand } from '../src/repositories/invoiceRepository'
const uid = 'Jhi9dIY92RbShnVhAVl5CaHuFJK2'
const key = 'card__2026-11'
const input: EntryInput = { type: 'expense', description: 'Compra', totalCents: 10000, categoryId: 'expense', purchaseDate: '2026-10-30', paymentMethod: 'card', cardId: 'card', installmentCount: 1, firstCompetence: '2026-11', dueDay: 12 }
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('pagamento integral e histórico de faturas', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-alex-invoices', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); state.db = env.authenticatedContext(uid).firestore() })
  beforeEach(async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore(); const audit = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      await setDoc(doc(db, `users/${uid}/categories/expense`), { name: 'Compras', scope: 'expense', active: true, ...audit })
      await setDoc(doc(db, `users/${uid}/cards/card`), { name: 'Pessoal', color: '#153f35', closingDay: 5, dueDay: 12, active: true, ...audit })
    })
    await saveEntry(uid, { entryId: 'entry', mutationId: 'create', input, expectedRevision: 0 })
  })
  afterAll(async () => { await env?.cleanup() })
  const ref = (name: string, id: string) => doc(state.db!, `users/${uid}/${name}/${id}`)
  async function data(name = 'invoices', id = key) { return (await getDoc(ref(name, id))).data()! }
  async function command(action: InvoiceCommand['action'] = 'payment', mutationId = 'pay'): Promise<InvoiceCommand> {
    const invoice = await data()
    return { invoiceId: key, mutationId, expectedRevision: invoice.revision, expectedTotalCents: invoice.totalCents, action }
  }
  async function docs(name: string) { return (await getDocs(collection(state.db!, `users/${uid}/${name}`))).docs }
  it('desconta a fatura uma vez e devolve saldo ao reverter', async () => {
    await initializeAccount(20000)
    const pay = { ...await command(), affectAccount: true }
    await changeInvoicePayment(uid, pay)
    await changeInvoicePayment(uid, pay)
    expect(await docs('accountMovements')).toHaveLength(1)
    expect((await data('accountMovements', 'invoiceEvents_pay')).amountCents).toBe(-10000)
    await changeInvoicePayment(uid, await command('reversal', 'undo'))
    expect((await data('accountMovements', 'invoiceEvents_undo')).amountCents).toBe(10000)
  })
  it('paga o valor integral e registra histórico sem criar outra despesa', async () => {
    await saveEntry(uid, { entryId: 'second', mutationId: 'second', expectedRevision: 0, input: { ...input, totalCents: 12345 } })
    const before = await data()
    expect(before.totalCents).toBe(22345); expect(before.chargeCount).toBe(2)
    await changeInvoicePayment(uid, await command())
    const invoice = await data(); const event = await data('invoiceEvents', 'pay')
    expect(invoice.status).toBe('paid'); expect(invoice.paidAmountCents).toBe(22345)
    expect(invoice.paidAt).toBeInstanceOf(Timestamp); expect(event.amountCents).toBe(22345)
    expect(event.dueDate).toBe('2026-11-12'); expect(event.type).toBe('payment')
    expect(invoice.createdAt.isEqual(before.createdAt)).toBe(true)
    expect(await docs('entries')).toHaveLength(2); expect(await docs('installments')).toHaveLength(2)
    expect((await data('installments', 'entry__1')).status).toBeNull()
  })
  it('desfaz, permite corrigir e pagar novamente preservando todas as confirmações', async () => {
    await changeInvoicePayment(uid, await command())
    const original = await data('invoiceEvents', 'pay')
    await changeInvoicePayment(uid, await command('reversal', 'undo'))
    const reversed = await data(); const undo = await data('invoiceEvents', 'undo')
    expect(reversed.status).toBe('pending'); expect(reversed.paidAt).toBeNull(); expect(reversed.paidAmountCents).toBeNull()
    expect(undo.paymentEventId).toBe('pay'); expect(undo.paidAt.isEqual(original.paidAt)).toBe(true)
    await saveEntry(uid, { entryId: 'entry', mutationId: 'correct', expectedRevision: 1, input: { ...input, totalCents: 20000 } })
    await changeInvoicePayment(uid, await command('payment', 'repay'))
    expect((await data()).paidAmountCents).toBe(20000)
    expect((await data('invoiceEvents', 'pay')).amountCents).toBe(10000)
    expect(await docs('invoiceEvents')).toHaveLength(3)
  })
  it('repetir a mesma confirmação é idempotente, inclusive em duas abas', async () => {
    const pay = await command()
    await Promise.all([changeInvoicePayment(uid, pay), changeInvoicePayment(uid, pay)])
    await changeInvoicePayment(uid, pay)
    expect(await docs('invoiceEvents')).toHaveLength(1)
    const reverse = await command('reversal', 'undo')
    await Promise.all([changeInvoicePayment(uid, reverse), changeInvoicePayment(uid, reverse)])
    expect(await docs('invoiceEvents')).toHaveLength(2)
    await changeInvoicePayment(uid, pay) // Replay antigo não refaz o pagamento após reversão.
    expect((await data()).status).toBe('pending')
  })
  it('uma confirmação vencida detecta novas cobranças e versões antigas', async () => {
    const stale = await command()
    await saveEntry(uid, { entryId: 'second', mutationId: 'second', expectedRevision: 0, input })
    await expect(changeInvoicePayment(uid, stale)).rejects.toThrow('mudou')
    expect(await docs('invoiceEvents')).toHaveLength(0)
    await changeInvoicePayment(uid, await command())
    await expect(changeInvoicePayment(uid, { ...stale, mutationId: 'old' })).rejects.toThrow('mudou')
  })
  it('bloqueia alterações enquanto paga e mantém cabeçalho vazio após desfazer e excluir', async () => {
    await changeInvoicePayment(uid, await command())
    await expect(deleteEntry(uid, 'entry', 1, 'delete')).rejects.toThrow('faturas')
    await expect(saveEntry(uid, { entryId: 'another', mutationId: 'another', expectedRevision: 0, input })).rejects.toThrow('faturas')
    await changeInvoicePayment(uid, await command('reversal', 'undo'))
    await deleteEntry(uid, 'entry', 1, 'delete')
    const empty = await data()
    expect(empty.totalCents).toBe(0); expect(empty.chargeCount).toBe(0)
    await expect(changeInvoicePayment(uid, await command('payment', 'empty'))).rejects.toThrow('movimentação')
    expect(await docs('invoiceEvents')).toHaveLength(2)
  })
  it('continua permitindo quitar e reverter faturas de cartões arquivados', async () => {
    await updateDoc(ref('cards', 'card'), { active: false, dueDay: 20, updatedAt: serverTimestamp() })
    await changeInvoicePayment(uid, await command())
    await changeInvoicePayment(uid, await command('reversal', 'undo'))
    expect((await data()).dueDate).toBe('2026-11-12')
    expect((await data('invoiceEvents', 'pay')).dueDate).toBe('2026-11-12')
  })
  it('nega pagamento parcial, timestamp falso e alteração de vencimento por SDK', async () => {
    const current = await data()
    const event = { invoiceId: key, cardId: 'card', competence: '2026-11', dueDate: current.dueDate, type: 'payment', amountCents: 5000, invoiceRevision: current.revision + 1, paymentEventId: 'partial', paidAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    const batch = writeBatch(state.db!)
    batch.update(ref('invoices', key), { status: 'paid', paidAt: serverTimestamp(), paidAmountCents: 5000, revision: current.revision + 1, lastMutationId: 'partial', lastEventId: 'partial', updatedAt: serverTimestamp() })
    batch.set(ref('invoiceEvents', 'partial'), event)
    await assertFails(batch.commit())
    await assertFails(updateDoc(ref('invoices', key), { status: 'paid', paidAt: Timestamp.fromMillis(0), paidAmountCents: 10000, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref('invoices', key), { dueDate: '2026-11-20', updatedAt: serverTimestamp() }))
  })
  it('nega alteração do saldo isolada e confirmações sem histórico atômico', async () => {
    const current = await data()
    await assertFails(updateDoc(ref('invoices', key), { totalCents: 1, revision: current.revision + 1, lastMutationId: 'fake', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref('invoices', key), { status: 'paid', paidAt: serverTimestamp(), paidAmountCents: 10000, revision: current.revision + 1, lastMutationId: 'fake', lastEventId: 'fake', updatedAt: serverTimestamp() }))
  })
  it('histórico é imutável, não pode ser forjado ou acessado por outro usuário', async () => {
    await changeInvoicePayment(uid, await command())
    await assertFails(updateDoc(ref('invoiceEvents', 'pay'), { amountCents: 1 }))
    await assertFails(deleteDoc(ref('invoiceEvents', 'pay')))
    await assertFails(setDoc(ref('invoiceEvents', 'fake'), { ...(await data('invoiceEvents', 'pay')), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
    for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('other').firestore()]) {
      await assertFails(getDoc(doc(db, `users/${uid}/invoiceEvents/pay`)))
      await assertFails(getDoc(doc(db, `users/${uid}/invoices/${key}`)))
    }
  })
  it('pagamento concorrente com uma nova cobrança não confirma valor desatualizado', async () => {
    const paying = await command()
    const results = await Promise.allSettled([
      changeInvoicePayment(uid, paying),
      saveEntry(uid, { entryId: 'racing', mutationId: 'racing', expectedRevision: 0, input }),
    ])
    const invoice = await data()
    expect(results.some(result => result.status === 'fulfilled')).toBe(true)
    const parts = await docs('installments')
    const sum = parts.reduce((total, part) => total + part.data().amountCents, 0)
    expect(invoice.totalCents).toBe(sum)
    if (invoice.status === 'paid') expect(invoice.paidAmountCents).toBe(sum)
    else expect(invoice.paidAmountCents).toBeNull()
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  })
  it('paga faturas com muitas cobranças sem gravar quitações individuais', async () => {
    for (let index = 0; index < 12; index++) await saveEntry(uid, { entryId: `extra${index}`, mutationId: `extra${index}`, expectedRevision: 0, input })
    await changeInvoicePayment(uid, await command())
    const invoice = await data()
    expect(invoice.chargeCount).toBe(13); expect(invoice.paidAmountCents).toBe(130000)
    expect(await docs('invoiceEvents')).toHaveLength(1)
    expect((await docs('installments')).every(part => part.data().status === null)).toBe(true)
  })
  it('nega uma reversão combinada com alteração das cobranças no mesmo lote', async () => {
    await changeInvoicePayment(uid, await command())
    const current = await data()
    const batch = writeBatch(state.db!)
    batch.update(ref('entries', 'entry'), { totalCents: 20000, revision: 2, mutationId: 'mixed', updatedAt: serverTimestamp() })
    batch.update(ref('installments', 'entry__1'), { amountCents: 20000, revision: 2, updatedAt: serverTimestamp() })
    batch.update(ref('invoices', key), { status: 'pending', paidAt: null, paidAmountCents: null, totalCents: 20000,
      revision: current.revision + 1, lastMutationId: 'mixed', lastEventId: 'mixed', lastEntryRevision: 2, updatedAt: serverTimestamp() })
    batch.set(ref('invoiceEvents', 'mixed'), { invoiceId: key, cardId: 'card', competence: current.competence, dueDate: current.dueDate,
      type: 'reversal', amountCents: current.paidAmountCents, invoiceRevision: current.revision + 1, paymentEventId: 'pay',
      paidAt: current.paidAt, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
    expect((await data()).status).toBe('paid'); expect((await data()).totalCents).toBe(10000)
  })

})
