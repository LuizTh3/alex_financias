import { initializeAccount } from '../src/repositories/accountRepository'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, updateDoc, deleteDoc, setDoc, getDocs, collection, serverTimestamp, type Firestore } from 'firebase/firestore'
const state = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('../src/lib/firebase', () => ({ get db() { return state.db }, auth: { currentUser: { uid: 'Jhi9dIY92RbShnVhAVl5CaHuFJK2' } } }))
import { saveEntry, deleteEntry } from '../src/repositories/entryRepository'
import { changeSettlement } from '../src/repositories/settlementRepository'
const uid = 'Jhi9dIY92RbShnVhAVl5CaHuFJK2'
const input = { type: 'income' as const, description: 'Reembolso', totalCents: 10000, categoryId: 'income', purchaseDate: '2027-01-01', paymentMethod: 'direct' as const, cardId: null, installmentCount: 3, firstCompetence: '2027-01', dueDay: 31 }
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('recebimentos parcelados e confirmações diretas', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-alex-settlements', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); state.db = env.authenticatedContext(uid).firestore() })
  beforeEach(async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `users/${uid}/categories/income`), { name: 'Reembolso', scope: 'income', active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
    await saveEntry(uid, { entryId: 'entry', mutationId: 'create', expectedRevision: 0, input })
  })
  afterAll(async () => { await env?.cleanup() })
  const ref = (name: string, id: string) => doc(state.db!, `users/${uid}/${name}/${id}`)
  const command = { installmentId: 'entry__1', mutationId: 'receive', expectedEntryRevision: 1, expectedSettlementRevision: 0, expectedAmountCents: 3334, action: 'confirm' as const }
  it('recebe uma parcela, sem alterar as outras e mantendo soma exata', async () => {
    await changeSettlement(uid, command)
    expect((await getDoc(ref('installments', 'entry__1'))).data()!.status).toBe('received')
    expect((await getDoc(ref('installments', 'entry__2'))).data()!.status).toBe('pending')
    expect((await getDoc(ref('settlementEvents', 'receive'))).data()!.amountCents).toBe(3334)
    await expect(saveEntry(uid, { entryId: 'entry', mutationId: 'edit', expectedRevision: 1, input: { ...input, totalCents: 20000 } })).rejects.toThrow('confirmações')
    await expect(deleteEntry(uid, 'entry', 1, 'delete')).rejects.toThrow('confirmações')
  })
  it('desfaz, edita o conjunto e recebe novamente sem perder histórico', async () => {
    await changeSettlement(uid, command)
    await changeSettlement(uid, { ...command, mutationId: 'undo', expectedSettlementRevision: 1, action: 'reverse' })
    await saveEntry(uid, { entryId: 'entry', mutationId: 'edit', expectedRevision: 1, input: { ...input, totalCents: 12000 } })
    await changeSettlement(uid, { ...command, mutationId: 'receive2', expectedEntryRevision: 2, expectedSettlementRevision: 2, expectedAmountCents: 4000 })
    expect((await getDocs(collection(state.db!, `users/${uid}/settlementEvents`))).size).toBe(3)
    expect((await getDoc(ref('settlementEvents', 'receive'))).data()!.amountCents).toBe(3334)
  })
  it('tentativas repetidas e concorrentes não duplicam a confirmação', async () => {
    await Promise.all([changeSettlement(uid, command), changeSettlement(uid, command)])
    await changeSettlement(uid, command)
    expect((await getDocs(collection(state.db!, `users/${uid}/settlementEvents`))).size).toBe(1)
    await changeSettlement(uid, { ...command, mutationId: 'undo', expectedSettlementRevision: 1, action: 'reverse' })
    await changeSettlement(uid, command)
    expect((await getDoc(ref('installments', 'entry__1'))).data()!.status).toBe('pending')
  })
  it('movimenta a conta uma vez e reverte junto com a confirmação', async () => {
    await initializeAccount(10000)
    await changeSettlement(uid, { ...command, affectAccount: true })
    await changeSettlement(uid, { ...command, affectAccount: true })
    expect((await getDocs(collection(state.db!, 'users', uid, 'accountMovements'))).size).toBe(1)
    expect((await getDoc(ref('accountMovements', 'settlementEvents_receive'))).data()!.amountCents).toBe(3334)
    await changeSettlement(uid, { ...command, mutationId: 'undo', expectedSettlementRevision: 1, action: 'reverse' })
    expect((await getDoc(ref('accountMovements', 'settlementEvents_undo'))).data()!.amountCents).toBe(-3334)
    await assertFails(updateDoc(ref('accountMovements', 'settlementEvents_receive'), { amountCents: 1 }))
    await assertFails(deleteDoc(ref('accountMovements', 'settlementEvents_receive')))
  })
  it('recebimento fora da conta não cria movimentação', async () => {
    await initializeAccount(0)
    await changeSettlement(uid, command)
    expect((await getDocs(collection(state.db!, 'users', uid, 'accountMovements'))).size).toBe(0)
  })
  it('nega liquidação parcial, isolada ou edição do histórico', async () => {
    await assertFails(updateDoc(ref('installments', 'entry__1'), { status: 'received', settledAt: serverTimestamp(), updatedAt: serverTimestamp() }))
    await expect(changeSettlement(uid, { ...command, expectedAmountCents: 1 })).rejects.toThrow('mudou')
    await changeSettlement(uid, command)
    await assertFails(updateDoc(ref('settlementEvents', 'receive'), { amountCents: 1 }))
    await assertFails(deleteDoc(ref('settlementEvents', 'receive')))
    const other = env.authenticatedContext('other').firestore()
    await assertFails(getDoc(doc(other, `users/${uid}/settlementEvents/receive`)))
  })
})
