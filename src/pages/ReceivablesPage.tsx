import { useState } from 'react'
import { Link } from 'react-router'
import { currentMonth, shiftMonth, formatMonth, formatMoney, formatTimestamp } from '../domain/finance'
import { todayCivil } from '../domain/calendar'
import { useFinancialRecords } from '../hooks/useFinancialRecords'
import { SettlementButton } from '../components/SettlementButton'
export function ReceivablesPage() {
  const [month, setMonth] = useState(currentMonth)
  const [all, setAll] = useState(false)
  const entries = useFinancialRecords('entries')
  const parts = useFinancialRecords('installments')
  const events = useFinancialRecords('settlementEvents')
  const sources = [entries, parts, events]
  const entryMap = new Map(entries.rows.filter(entry => entry.type === 'income').map(entry => [entry.id, entry]))
  const visible = parts.rows.filter(part => entryMap.has(part.entryId) && !part.cardId && (all || part.competence === month)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
  const failure = sources.find(source => source.error)?.error
  const receiptIds = new Set(events.rows.filter(event => event.type === 'receipt').map(event => event.id))
  const receiptHistory = events.rows.filter(event => (event.type === 'receipt' || event.type === 'reversal' && receiptIds.has(event.confirmationEventId))
    && (all || event.dueDate.slice(0, 7) === month)).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  const received = visible.filter(part => part.status === 'received').reduce((sum, part) => sum + part.amountCents, 0)
  const pending = visible.filter(part => part.status === 'pending').reduce((sum, part) => sum + part.amountCents, 0)
  return <main className="workspace"><header><div><p className="eyebrow">RECEBIMENTOS PARCELADOS</p><h1>A receber</h1></div><Link className="primary" to="/lancamentos?tipo=income">+ Novo recebimento</Link></header>
    <p className="muted mb-6">Cada parcela tem seu próprio vencimento e confirmação, mantendo a soma do valor total.</p>
    <div className="catalog-toolbar"><div className="month-picker"><button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>←</button><span>{formatMonth(month)}</span><button aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>→</button></div><label className="checkbox-label"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} /> Todos os meses</label></div>
    {failure ? <div className="error" role="alert">{failure}<button className="secondary ml-3" onClick={() => sources.forEach(source => source.retry())}>Tentar novamente</button></div> : sources.some(source => source.loading) ? <p role="status">Carregando recebimentos…</p> : <>
      <section className="stats"><article><p>A receber</p><strong>{formatMoney(pending)}</strong><span>Parcelas pendentes</span></article><article><p>Recebido</p><strong>{formatMoney(received)}</strong><span>Confirmações vigentes</span></article><article className="highlight"><p>Total do período</p><strong>{formatMoney(pending + received)}</strong><span>{visible.length} parcela(s)</span></article></section>
      <section className="panel"><div className="panel-heading"><h2>{all ? 'Todos os recebimentos' : 'Parcelas do mês'}</h2><span className="badge">{visible.length} registros</span></div>
        {visible.length ? <ul className="catalog-list">{visible.map(part => {
          const entry = entryMap.get(part.entryId)!
          const history = events.rows.filter(event => event.installmentId === part.id).sort((a, b) => b.settlementRevision - a.settlementRevision)
          return <li key={part.id}><div><h3>{entry.description}</h3><p className="muted text-sm">Parcela {part.index}/{part.count} · Vence {part.dueDate.split('-').reverse().join('/')} · {part.status === 'received' ? 'Recebido' : part.dueDate < todayCivil() ? 'Atrasado' : 'Pendente'}</p><strong>{formatMoney(part.amountCents)}</strong>
            {part.settledAt && <p className="muted text-sm">Recebido em {formatTimestamp(part.settledAt.toDate())}</p>}
            {!!history.length && <details className="mt-3"><summary>Histórico desta parcela</summary><ol className="invoice-timeline">{history.map(event => <li key={event.id}><strong>{event.type === 'receipt' ? 'Recebimento confirmado' : 'Confirmação desfeita'} · {formatMoney(event.amountCents)}</strong><p className="muted text-sm">{formatTimestamp(event.createdAt.toDate())}</p></li>)}</ol></details>}
          </div><div className="row-actions"><SettlementButton part={part} type="income" description={entry.description} /></div></li>
        })}</ul> : <div className="empty"><h3>Nenhum recebimento neste período</h3><p className="muted">Cadastre um recebimento informando o valor total e a quantidade de parcelas.</p></div>}
      </section>
      <section className="panel mt-6"><details className="p-6"><summary>Histórico de recebimentos e reversões ({receiptHistory.length})</summary>
        {receiptHistory.length ? <ol className="invoice-timeline">{receiptHistory.map(event => <li key={event.id}><strong>{event.description} · {event.type === 'receipt' ? 'Recebido' : 'Recebimento desfeito'} · {formatMoney(event.amountCents)}</strong><p className="muted text-sm">{formatTimestamp(event.createdAt.toDate())} · Vencimento original: {event.dueDate.split('-').reverse().join('/')}</p></li>)}</ol> : <p className="muted mt-3">Nenhuma confirmação neste período.</p>}
      </details></section>
    </>}
  </main>
}
