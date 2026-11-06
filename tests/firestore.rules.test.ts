import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
const owner = 'Jhi9dIY92RbShnVhAVl5CaHuFJK2'
const card = () => ({ name: 'Pessoal', color: '#153f35', closingDay: 5, dueDay: 12, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
const category = () => ({ name: 'Casa', scope: 'expense', active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('segurança dos cadastros', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-alex-financias', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }) })
  beforeEach(async () => { await env.clearFirestore() })
  afterAll(async () => { await env?.cleanup() })
  it('permite criar, listar, editar, arquivar e reativar os próprios cadastros', async () => {
    const db = env.authenticatedContext(owner).firestore()
    for (const [name, data] of [['cards', card()], ['categories', category()]] as const) {
      const ref = doc(db, `users/${owner}/${name}/test`)
      await assertSucceeds(setDoc(ref, data))
      await assertSucceeds(getDoc(ref))
      await assertSucceeds(getDocs(collection(db, `users/${owner}/${name}`)))
      await assertSucceeds(updateDoc(ref, { name: 'Novo nome', updatedAt: serverTimestamp() }))
      await assertSucceeds(updateDoc(ref, { active: false, updatedAt: serverTimestamp() }))
      await assertSucceeds(updateDoc(ref, { active: true, updatedAt: serverTimestamp() }))
    }
  })
  it('nega acesso anônimo, outro UID e caminhos alheios', async () => {
    for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('intruso').firestore()]) {
      for (const [name, data] of [['cards', card()], ['categories', category()]] as const) {
        await assertFails(getDoc(doc(db, `users/${owner}/${name}/test`)))
        await assertFails(getDocs(collection(db, `users/${owner}/${name}`)))

        await assertFails(setDoc(doc(db, `users/${owner}/${name}/test`), data))
      }
    }
    await assertSucceeds(setDoc(doc(env.authenticatedContext('intruso').firestore(), 'users/intruso/cards/test'), card()))
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'users/intruso/cards/test'), card()))
    await assertFails(setDoc(doc(env.authenticatedContext(owner).firestore(), 'users/outro/cards/test'), card()))
    await assertFails(getDoc(doc(env.authenticatedContext(owner).firestore(), 'users/outro/categories/test')))
  })
  it('permite apresentação inicial somente no próprio documento', async () => {
    const db = env.authenticatedContext(owner).firestore()
    const ref = doc(db, 'users', owner)
    await assertSucceeds(getDoc(ref))
    await assertFails(setDoc(ref, {}))
    await assertSucceeds(setDoc(ref, { createdAt: serverTimestamp(), welcomeSeenAt: serverTimestamp() }))
    await assertFails(updateDoc(ref, { welcomeSeenAt: serverTimestamp() }))
    await assertFails(deleteDoc(ref))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', owner)))
    await assertFails(getDoc(doc(env.authenticatedContext('other').firestore(), 'users', owner)))
  })
  it('valida os dias 1 a 31 e a cor do cartão', async () => {
    const ref = doc(env.authenticatedContext(owner).firestore(), `users/${owner}/cards/test`)
    await assertSucceeds(setDoc(ref, { ...card(), closingDay: 31, dueDay: 1 }))
    for (const invalid of [{ closingDay: 0 }, { dueDay: 32 }, { dueDay: 2.5 }, { closingDay: '10' }, { color: 'red' }]) {
      await assertFails(setDoc(ref, { ...card(), ...invalid }))
    }
  })
  it('valida nomes, escopo, campos extras e active booleano', async () => {
    const db = env.authenticatedContext(owner).firestore()
    for (const scope of ['expense', 'income', 'both']) {
      await assertSucceeds(setDoc(doc(db, `users/${owner}/categories/${scope}`), { ...category(), scope }))
    }
    for (const [name, data] of [['cards', card()], ['categories', category()]] as const) {
      const ref = doc(db, `users/${owner}/${name}/invalid`)
      for (const invalid of [{ name: '' }, { name: '   ' }, { name: ' Casa' }, { name: 'Casa ' }, { name: 'x'.repeat(121) }, { active: 'true' }, { active: false }, { password: 'invalid' }]) {
        await assertFails(setDoc(ref, { ...data, ...invalid }))
      }
    }
    await assertFails(setDoc(doc(db, `users/${owner}/categories/invalid`), { ...category(), scope: 'invalid' }))
  })
  it('exige timestamps de servidor e preserva createdAt', async () => {
    const ref = doc(env.authenticatedContext(owner).firestore(), `users/${owner}/cards/test`)
    await assertFails(setDoc(ref, { ...card(), createdAt: Timestamp.fromMillis(0) }))
    await assertFails(setDoc(ref, { ...card(), updatedAt: Timestamp.fromMillis(0) }))
    await assertSucceeds(setDoc(ref, card()))
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref, { name: 'Sem timestamp' }))
    await assertFails(updateDoc(ref, { updatedAt: Timestamp.fromMillis(0) }))
  })
  it('impede exclusão, senhas e campos indevidos inclusive em edição', async () => {
    const db = env.authenticatedContext(owner).firestore()
    for (const [name, data] of [['cards', card()], ['categories', category()]] as const) {
      const ref = doc(db, `users/${owner}/${name}/test`)
      await setDoc(ref, data)
      await assertFails(deleteDoc(ref))
      await assertFails(updateDoc(ref, { senha: 'invalid', updatedAt: serverTimestamp() }))
      await assertFails(updateDoc(ref, { totalCents: 1000, updatedAt: serverTimestamp() }))
    }
  })
  it('mantém gravações financeiras e caminhos desconhecidos bloqueados', async () => {
    const db = env.authenticatedContext(owner).firestore()
    for (const name of ['entries', 'installments', 'invoices', 'recurrences']) {
      await assertSucceeds(getDoc(doc(db, `users/${owner}/${name}/test`)))
      await assertFails(setDoc(doc(db, `users/${owner}/${name}/test`), { amountCents: 100 }))
    }
    for (const path of [`users/${owner}/secrets/test`, `users/${owner}/cards/test/nested/test`]) {
      await assertFails(getDoc(doc(db, path)))
      await assertFails(setDoc(doc(db, path), {}))
    }
  })
})

