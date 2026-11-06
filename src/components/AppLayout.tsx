import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
const pages = [
  ['/', 'Visão geral'], ['/cartoes', 'Cartões'], ['/categorias', 'Categorias'],
  ['/faturas', 'Faturas'], ['/despesas-fixas', 'Despesas fixas'],
  ['/a-receber', 'A receber'], ['/futuros', 'Compromissos futuros'],
]
export function AppLayout() {
  const { user, logout } = useAuth()
  const [error, setError] = useState<string | null>(null)
  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink to="/" className="brand">alex<span>finanças pessoais</span></NavLink>
      <p className="eyebrow mt-12">SEU PLANEJAMENTO</p>
      <nav aria-label="Navegação principal">
        {pages.map(([path, title]) => <NavLink key={path} to={path} end>{title}</NavLink>)}
      </nav>
      <div className="sidebar-footer">
        <p className="text-sm truncate" title={user?.email || ''}>{user?.email}</p>
        <button className="text-sm mt-3" onClick={() => void logout().catch(() => setError('Não foi possível sair. Tente novamente.'))}>Sair da conta ↗</button>
        {error && <p role="alert" className="error">{error}</p>}
      </div>
    </aside>
    <Outlet />
  </div>
}
