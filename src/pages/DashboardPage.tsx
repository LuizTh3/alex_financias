import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { currentMonth, shiftMonth, formatMonth, formatMoney, monthlyTotal, type Commitment } from '../domain/finance'
import { subscribeTo, type RecordOf } from '../repositories/financeRepository'
export function DashboardPage() {
  const { user, logout } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const [cards, setCards] = useState<RecordOf<'cards'>[]>([])
  const [invoices, setInvoices] = useState<RecordOf<'invoices'>[]>([])
  const [fixed, setFixed] = useState<RecordOf<'fixedExpenses'>[]>([])
  const [receivables, setReceivables] = useState<RecordOf<'receivables'>[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { pathname } = useLocation()
  useEffect(() => {
    if (!user) return
    const pending = new Set(['cards', 'invoices', 'fixedExpenses', 'receivables'])
    setLoading(true); setError(null)
    const failed = () => { setError('Não foi possível carregar seus dados. Confira a conexão e as regras do Firestore.'); setLoading(false) }
    const loaded = (name: string) => { pending.delete(name); if (!pending.size) setLoading(false) }
    const stops = [
      subscribeTo(user.uid, 'cards', rows => { setCards(rows); loaded('cards') }, failed),
      subscribeTo(user.uid, 'invoices', rows => { setInvoices(rows); loaded('invoices') }, failed),
      subscribeTo(user.uid, 'fixedExpenses', rows => { setFixed(rows); loaded('fixedExpenses') }, failed),
      subscribeTo(user.uid, 'receivables', rows => { setReceivables(rows); loaded('receivables') }, failed),
    ]
    return () => stops.forEach(stop => stop())
  }, [user])
  const pages = [{ path: '/', title: 'Visão geral' }, { path: '/cartoes', title: 'Cartões' }, { path: '/faturas', title: 'Faturas' }, { path: '/despesas-fixas', title: 'Despesas fixas' }, { path: '/a-receber', title: 'A receber' }, { path: '/futuros', title: 'Compromissos futuros' }]
  const title = pages.find(page => page.path === pathname)?.title || 'Visão geral'
  const outgoing = monthlyTotal(invoices, month) + monthlyTotal(fixed, month)
  const incoming = monthlyTotal(receivables, month)
  const items: Commitment[] = pathname === '/faturas' ? invoices : pathname === '/despesas-fixas' ? fixed : pathname === '/a-receber' ? receivables : [...invoices, ...fixed, ...receivables]
  const visible = items.filter(item => pathname === '/futuros' ? item.dueDate.slice(0, 7) > month && !item.paid : item.dueDate.startsWith(`${month}-`)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return <div className="app-shell"><aside className="sidebar"><a href="/" className="brand">alex<span>finanças pessoais</span></a><p className="eyebrow mt-12">SEU PLANEJAMENTO</p><nav>{pages.map(page => <NavLink key={page.path} to={page.path} end>{page.title}</NavLink>)}</nav><div className="sidebar-footer"><p className="text-sm truncate" title={user?.email || ''}>{user?.email}</p><button className="text-sm mt-3" onClick={() => void logout().catch(() => setError('Não foi possível sair. Tente novamente.'))}>Sair da conta ↗</button></div></aside><main className="workspace"><header><div><p className="eyebrow">UM PASSO DE CADA VEZ</p><h1>{title}</h1></div><div className="month-picker"><button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>←</button><span>{formatMonth(month)}</span><button aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>→</button></div></header><p className="muted mb-8">Acompanhe seus compromissos e planeje os próximos meses.</p>{error && <p className="error mb-6" role="alert">{error}</p>}{loading ? <p role="status">Carregando seus dados…</p> : !error && <><section className="stats"><article><p>A receber no mês</p><strong>{formatMoney(incoming)}</strong><span>Recebimentos pendentes</span></article><article><p>A pagar no mês</p><strong>{formatMoney(outgoing)}</strong><span>Faturas e despesas pendentes</span></article><article className="highlight"><p>Saldo previsto dos compromissos</p><strong>{formatMoney(incoming - outgoing)}</strong><span>Valores a receber menos valores a pagar</span></article></section><section className="panel"><div className="panel-heading"><h2>{pathname === '/cartoes' ? 'Seus cartões' : pathname === '/futuros' ? 'Após ' + formatMonth(month) : 'Compromissos do mês'}</h2><span className="badge">{pathname === '/cartoes' ? cards.length : visible.length} registros</span></div>{pathname === '/cartoes' ? cards.length ? <ul className="records">{cards.map(card => <li key={card.id}><strong>{card.name}</strong><span>Fechamento: dia {card.closingDay} · Vencimento: dia {card.dueDay}</span></li>)}</ul> : <Empty text="Nenhum cartão cadastrado" /> : visible.length ? <ul className="records">{visible.map((item, index) => <li key={`${item.id}-${index}`}><div><strong>{item.description}</strong><p className="muted text-sm">{item.dueDate.split('-').reverse().join('/')} · {item.paid ? 'Concluído' : 'Pendente'}</p></div><strong>{formatMoney(item.amountCents)}</strong></li>)}</ul> : <Empty text="Nenhum compromisso neste período" />}</section></>}</main></div>
}
function Empty({ text }: { text: string }) { return <div className="empty"><span className="empty-icon">◎</span><h3>{text}</h3><p className="muted">Seus registros aparecerão aqui quando forem adicionados.</p></div> }
