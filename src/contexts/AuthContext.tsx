import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { browserSessionPersistence, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth, personalUid } from '../lib/firebase'

type AuthState = { user: User | null; loading: boolean; error: string | null; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!auth) { setLoading(false); return }
    return onAuthStateChanged(auth, (current) => {
      if (current && current.uid !== personalUid) {
        setUser(null)
        setError('Esta conta não tem acesso ao sistema.')
        void signOut(auth!).catch(() => setError('Não foi possível encerrar a sessão.'))
      } else { setUser(current) }
      setLoading(false)
    }, () => { setError('Não foi possível verificar a sessão.'); setLoading(false) })
  }, [])
  async function login(email: string, password: string) {
    if (!auth) throw new Error('Firebase indisponível.')
    setError(null)
    await setPersistence(auth, browserSessionPersistence)
    const result = await signInWithEmailAndPassword(auth, email, password)
    if (result.user.uid !== personalUid) {
      await signOut(auth)
      throw new Error('Esta conta não tem acesso ao sistema.')
    }
  }
  async function logout() { if (auth) await signOut(auth) }
  return <AuthContext.Provider value={{ user, loading, error, login, logout }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider ausente.')
  return value
}
