import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { currentMonth, shiftMonth, formatMonth, formatMoney } from '../domain/finance'
import { subscribeTo, type RecordOf } from '../repositories/financeRepository'
import { useCatalog } from '../hooks/useCatalog'
import { buildCommitments, outstandingTotal, commitmentSituation } from '../domain/commitments'

// Consultas de lançamentos e cobranças persistidos; modelos recorrentes serão integrados em sua etapa.
export function DashboardPage() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const [entries, setEntries] = useState<RecordOf<'entries'>[]>([])
  const [installments, setInstallments] = useState<RecordOf<'installments'>[]>([])
  const [invoices, setInvoices] = useState<RecordOf<'invoices'>[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { rows: cards, error: cardsError, loading: cardsLoading } = useCatalog('cards')
  const { pathname } = useLocation()
  useEffect(() => {
    if (!user) return
    const pending = new Set(['entries', 'installments', 'invoices'])
    setLoading(true); setError(null)
    const failed = () => { setError('Não foi possível carregar seus dados. Confira a conexão e as regras do Firestore.'); setLoading(false) }
    const loaded = (name: string) => { pending.delete(name); if (!pending.size) setLoading(false) }
    const stops = [
      subscribeTo(user.uid, 'entries', rows => { setEntries(rows); loaded('entries') }, failed),
      subscribeTo(user.uid, 'installments', rows => { setInstallments(rows); loaded('installments') }, failed),
      subscribeTo(user.uid, 'invoices', rows => { setInvoices(rows); loaded('invoices') }, failed),
    ]
    return () => stops.forEach(stop => stop())
  }, [user])
  const titles: Record<string, string> = { '/': 'Visão geral', '/faturas': 'Faturas', '/despesas-fixas': 'Despesas fixas', '/a-receber': 'A receber', '/futuros': 'Compromissos futuros' }
  const { charges, invoiceRows, outgoing, incoming, all } = buildCommitments(entries, installments, invoices, cards)
  const items = pathname === '/faturas' ? invoiceRows : pathname === '/despesas-fixas' ? charges.filter(item => item.fixed && !item.income) : pathname === '/a-receber' ? incoming : all
  const visible = items.filter(item => pathname === '/futuros' ? item.competence > month && !item.paid : item.competence === month).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  // A seleção é por competência de vencimento, não pela data da compra.
  const total = (rows: typeof outgoing) => outstandingTotal(rows, month)
  const failure = error || cardsError
  const emptyText = pathname === '/despesas-fixas' ? 'Sem gastos neste mês' : pathname === '/faturas' ? 'Sem movimentação neste mês' : 'Nenhum compromisso neste período'
  return <main className="workspace">
    <header><div><p className="eyebrow">UM PASSO DE CADA VEZ</p><h1>{titles[pathname]}</h1></div>
      <div className="month-picker"><button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>←</button><span>{formatMonth(month)}</span><button aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>→</button></div>
    </header>
    <p className="muted mb-8">Acompanhe seus compromissos pelo mês de vencimento.</p>
    {failure && <p className="error mb-6" role="alert">{failure}</p>}
    {loading || cardsLoading ? <p role="status">Carregando seus dados…</p> : !failure && <>
      <section className="stats">
        <article><p>A receber no mês</p><strong>{formatMoney(total(incoming))}</strong><span>Recebimentos pendentes</span></article>
        <article><p>A pagar no mês</p><strong>{formatMoney(total(outgoing))}</strong><span>Faturas e despesas pendentes</span></article>
        <article className="highlight"><p>Saldo previsto dos compromissos</p><strong>{formatMoney(total(incoming) - total(outgoing))}</strong><span>Valores a receber menos valores a pagar</span></article>
      </section>
      <section className="panel"><div className="panel-heading"><h2>{pathname === '/futuros' ? 'Após ' + formatMonth(month) : 'Compromissos do mês'}</h2><span className="badge">{visible.length} registros</span></div>
        {visible.length ? <ul className="records">{visible.map(item => <li key={item.id}><div><strong>{item.description}</strong><p className="muted text-sm">{item.dueDate.split('-').reverse().join('/')} · {commitmentSituation(item)}</p></div><strong>{formatMoney(item.amountCents)}</strong></li>)}</ul>
          : <div className="empty"><span className="empty-icon">◎</span><h3>{emptyText}</h3><p className="muted">Seus registros aparecerão aqui quando forem adicionados.</p></div>}
      </section>
    </>}
  </main>
}
