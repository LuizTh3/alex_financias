import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, type Firestore } from 'firebase/firestore'
const state = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('../src/lib/firebase', () => ({ get db() { return state.db }, auth: { currentUser: { uid: 'Jhi9dIY92RbShnVhAVl5CaHuFJK2' } } }))
import { CatalogConflictError, saveCatalog, setCatalogActive, type CardRecord } from '../src/repositories/catalogRepository'
const owner = 'Jhi9dIY92RbShnVhAVl5CaHuFJK2'
const card = { name: 'Pessoal', color: '#153f35', closingDay: 5, dueDay: 12 }
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('transações dos cadastros', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-alex-repository', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
    state.db = env.authenticatedContext(owner).firestore()
  })
  beforeEach(async () => { await env.clearFirestore() })
  afterAll(async () => { await env?.cleanup() })
  async function readCard(): Promise<CardRecord> {
    const snapshot = await getDoc(doc(state.db!, `users/${owner}/cards/stable-id`))
    return { ...snapshot.data(), id: snapshot.id } as CardRecord
  }
  it('repetir o cadastro com o mesmo ID não duplica nem altera createdAt', async () => {
    await saveCatalog(owner, 'cards', 'stable-id', card)
    const original = await readCard()
    await saveCatalog(owner, 'cards', 'stable-id', card)
    expect((await getDocs(collection(state.db!, `users/${owner}/cards`))).size).toBe(1)
    expect((await readCard()).createdAt.isEqual(original.createdAt)).toBe(true)
  })
  it('preserva createdAt e rejeita edições baseadas em uma versão antiga', async () => {
    await saveCatalog(owner, 'cards', 'stable-id', card)
    const original = await readCard()
    await saveCatalog(owner, 'cards', original.id, { ...card, dueDay: 31 }, original.updatedAt)
    const updated = await readCard()
    expect(updated.createdAt.isEqual(original.createdAt)).toBe(true)
    expect(updated.dueDay).toBe(31)
    await expect(saveCatalog(owner, 'cards', original.id, { ...card, dueDay: 20 }, original.updatedAt)).rejects.toBeInstanceOf(CatalogConflictError)
  })
  it('duas edições concorrentes não sobrescrevem silenciosamente a mesma versão', async () => {
    await saveCatalog(owner, 'cards', 'stable-id', card)
    const original = await readCard()
    const results = await Promise.allSettled([
      saveCatalog(owner, 'cards', original.id, { ...card, name: 'Aba A' }, original.updatedAt),
      saveCatalog(owner, 'cards', original.id, { ...card, name: 'Aba B' }, original.updatedAt),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  })
  it('arquiva e reativa sem apagar o cadastro nem mudar sua criação', async () => {
    await saveCatalog(owner, 'cards', 'stable-id', card)
    const original = await readCard()
    await setCatalogActive(owner, 'cards', original, false)
    const archived = await readCard()
    expect(archived.active).toBe(false)
    expect(archived.createdAt.isEqual(original.createdAt)).toBe(true)
    await setCatalogActive(owner, 'cards', archived, true)
    expect((await readCard()).active).toBe(true)
  })
})
