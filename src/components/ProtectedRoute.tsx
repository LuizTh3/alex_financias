import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="p-10" role="status">Verificando sessão…</main>
  return user ? <Outlet /> : <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
}
