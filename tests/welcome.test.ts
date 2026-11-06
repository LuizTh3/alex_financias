import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ exists: false, read: vi.fn(), write: vi.fn() }))
vi.mock('../src/lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  getDocFromServer: () => state.read(),
  serverTimestamp: () => 'server-time',
  runTransaction: async (_db: unknown, callback: (tx: unknown) => Promise<void>) => callback({ get: async () => ({ exists: () => state.exists }), set: state.write }),
}))
import { completeWelcome, needsWelcome } from '../src/repositories/userRepository'
describe('apresentação inicial', () => {
  beforeEach(() => { state.exists = false; state.write.mockClear(); state.read.mockReset(); state.read.mockResolvedValue({ exists: () => state.exists }) })
  it('mostra a apresentação somente quando o documento não existe', async () => {
    expect(await needsWelcome('user')).toBe(true)
    state.exists = true
    expect(await needsWelcome('user')).toBe(false)
  })
  it('não confunde erro de leitura com ausência de documento', async () => {
    state.read.mockRejectedValue(new Error('offline'))
    await expect(needsWelcome('user')).rejects.toThrow('offline')
  })
  it('cria o documento do usuário ao concluir sem sobrescrever perfil existente', async () => {
    await completeWelcome('user')
    expect(state.write).toHaveBeenCalledWith('users/user', { createdAt: 'server-time', welcomeSeenAt: 'server-time' })
    state.write.mockClear(); state.exists = true
    await completeWelcome('user')
    expect(state.write).not.toHaveBeenCalled()
  })
})
