import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
const owner = 'Jhi9dIY92RbShnVhAVl5CaHuFJK2'
const card = { name: 'Pessoal', closingDay: 5, dueDay: 12 }
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('isolamento do Firestore', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-alex-financias', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }) })
  beforeEach(async () => { await env.clearFirestore() })
  afterAll(async () => { await env.cleanup() })
  it('permite leitura, escrita e exclusão pelo titular em seu caminho', async () => {
    const ref = doc(env.authenticatedContext(owner).firestore(), `users/${owner}/cards/test`)
    await assertSucceeds(setDoc(ref, card)); await assertSucceeds(getDoc(ref)); await assertSucceeds(deleteDoc(ref))
  })
  it('nega usuários anônimos e outros UIDs, inclusive no próprio caminho', async () => {
    for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('intruso').firestore()]) {
      await assertFails(getDoc(doc(db, `users/${owner}/cards/test`)))
      await assertFails(setDoc(doc(db, 'users/intruso/cards/test'), card))
      await assertFails(setDoc(doc(db, `users/${owner}/cards/test`), card))
    }
  })
  it('nega ao titular caminhos alheios, coleções desconhecidas e senhas', async () => {
    const db = env.authenticatedContext(owner).firestore()
    await assertFails(setDoc(doc(db, 'users/outro/cards/test'), card))
    await assertFails(getDoc(doc(db, 'users/outro/cards/test')))
    await assertFails(setDoc(doc(db, `users/${owner}/secrets/test`), { password: 'invalid' }))
    await assertFails(setDoc(doc(db, `users/${owner}/cards/test`), { ...card, password: 'invalid' }))
    await assertFails(setDoc(doc(db, `users/${owner}/cards/test`), { ...card, dueDay: 32 }))
  })
  it('valida centavos inteiros e formato dos compromissos', async () => {
    const db = env.authenticatedContext(owner).firestore()
    const item = { description: 'Aluguel', amountCents: 150000, dueDate: '2026-11-10', paid: false }
    for (const name of ['fixedExpenses', 'receivables', 'invoices']) {
      const value = name === 'invoices' ? { ...item, cardId: 'card' } : item
      const ref = doc(db, `users/${owner}/${name}/test`)
      await assertSucceeds(setDoc(ref, value))
      await assertFails(setDoc(ref, { ...value, amountCents: 1.5 }))
      await assertFails(setDoc(ref, { ...value, amountCents: -1 }))
      await assertFails(setDoc(ref, { ...value, senha: 'invalid' }))
    }
  })
})
