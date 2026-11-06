import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
const pages = [
  ['/', 'Visão geral'], ['/lancamentos', 'Lançamentos'], ['/cartoes', 'Cartões'], ['/categorias', 'Categorias'],
  ['/faturas', 'Faturas'], ['/despesas-fixas', 'Rendas e despesas mensais'], ['/conta', 'Minha conta'],
  ['/a-receber', 'A receber'], ['/futuros', 'Compromissos futuros'],
]
export function AppLayout() {
  const { user, logout } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  return <div className="app-shell">
    <a className="skip-link" href="#page-content">Pular para o conteúdo</a>
    <aside className="sidebar">
      <NavLink to="/" className="brand">alex<span>finanças pessoais</span></NavLink>
      <p className="eyebrow mt-12">SEU PLANEJAMENTO</p>
      <nav aria-label="Navegação principal">
        {pages.map(([path, title]) => <NavLink key={path} to={path} end>{title}</NavLink>)}
      </nav>
      <div className="sidebar-footer">
        <p className="text-sm truncate" title={user?.email || ''}>{user?.email}</p>
        <button className="text-sm mt-3" disabled={signingOut} onClick={() => { setError(null); setSigningOut(true); void logout().catch(() => setError('Não foi possível sair. Tente novamente.')).finally(() => setSigningOut(false)) }}>{signingOut ? 'Saindo…' : 'Sair da conta'}</button>
        {error && <p role="alert" className="error">{error}</p>}
      </div>
    </aside>
    <div id="page-content" className="page-content" tabIndex={-1}><Outlet /></div>
  </div>
}
