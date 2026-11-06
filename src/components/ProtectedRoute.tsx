import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <main className="p-10" role="status">Verificando sessão…</main>
  return user ? <Outlet /> : <Navigate to="/entrar" replace />
}
