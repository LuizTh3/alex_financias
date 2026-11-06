import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { currentMonth, shiftMonth, formatMoney, formatMonth, formatTimestamp } from '../domain/finance'
import { monthlyInvoices } from '../domain/invoices'
import { useRecurringMonth } from '../hooks/useRecurringMonth'
import { useCatalog } from '../hooks/useCatalog'
import { useFinancialRecords } from '../hooks/useFinancialRecords'
import { newMutationId } from '../repositories/entryRepository'
import { changeInvoicePayment, invoiceErrorMessage, type InvoiceCommand } from '../repositories/invoiceRepository'
import { Modal } from '../components/Modal'

type InvoiceView = ReturnType<typeof monthlyInvoices>[number]
const dateLabel = (date: string) => date.split('-').reverse().join('/')
export function InvoicesPage() {
  const { user } = useAuth()
  const cards = useCatalog('cards')
  const invoices = useFinancialRecords('invoices')
  const installments = useFinancialRecords('installments')
  const entries = useFinancialRecords('entries')
  const events = useFinancialRecords('invoiceEvents')
  const [params, setParams] = useSearchParams()
  const [month, setMonth] = useState(currentMonth)
  const [status, setStatus] = useState('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{ name: string; dueDate: string; command: InvoiceCommand } | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const locked = useRef(false)
  const sources = [cards, invoices, installments, entries, events]
  const loading = sources.some(source => source.loading)
  const loadError = sources.find(source => source.error)?.error
  const history = params.get('visao') === 'historico'
  const recurring = useRecurringMonth(month, !history)
  const selectedCard = params.get('cartao') ?? ''
  function setParameter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  const monthly = monthlyInvoices(month, cards.rows, invoices.rows, installments.rows)
  const historical = [...new Set(invoices.rows.map(invoice => invoice.competence))].sort().reverse()
    .flatMap(competence => monthlyInvoices(competence, cards.rows, invoices.rows, installments.rows).filter(row => row.header))
  const base = (history ? historical : monthly).filter(row => !selectedCard || row.cardId === selectedCard)
  const filtered = base.filter(row => status === 'all' || (status === 'paid' ? row.situation === 'Paga' : status === 'pending' ? row.situation === 'Pendente' : status === 'overdue' ? row.situation === 'Atrasada' : row.situation === 'Sem movimentação'))
  const details = detailId ? [...historical, ...monthly].find(row => row.id === detailId) : null
  const pendingTotal = base.filter(row => row.header?.status !== 'paid').reduce((sum, row) => sum + row.totalCents, 0)
  const paidTotal = base.filter(row => row.header?.status === 'paid').reduce((sum, row) => sum + (row.header?.paidAmountCents ?? 0), 0)
  const entryMap = new Map(entries.rows.map(entry => [entry.id, entry]))
  const latest = confirmation ? invoices.rows.find(invoice => invoice.id === confirmation.command.invoiceId) : null
  const confirmationStale = !!confirmation && (!latest || latest.revision !== confirmation.command.expectedRevision)
  function openConfirmation(row: InvoiceView, action: InvoiceCommand['action']) {
    if (!row.header || !row.consistent) return
    setMessage(''); setActionError(null)
    setConfirmation({ name: row.name, dueDate: row.header.dueDate, command: {
      invoiceId: row.id, mutationId: newMutationId(), expectedRevision: row.header.revision,
      expectedTotalCents: row.header.totalCents, action,
    } })
  }
  const historyFor = (invoiceKey: string) => events.rows.filter(event => event.invoiceId === invoiceKey).sort((a, b) => b.invoiceRevision - a.invoiceRevision)
  return <main className="workspace">
    <header><div><p className="eyebrow">CARTÕES E FATURAS</p><h1>{history ? 'Histórico de faturas' : 'Faturas do mês'}</h1></div>
      {!history && <div className="month-picker"><button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>←</button><span>{formatMonth(month)}</span><button aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>→</button></div>}
    </header>
    <p className="muted mb-6">Confira as cobranças, confirme o pagamento integral e consulte suas confirmações anteriores.</p>
    <div className="catalog-toolbar">
      <div className="filter-tabs" role="group" aria-label="Visualização de faturas"><button aria-pressed={!history} onClick={() => setParameter('visao', '')}>Mês selecionado</button><button aria-pressed={history} onClick={() => setParameter('visao', 'historico')}>Histórico</button></div>
      <Link className="secondary" to="/cartoes">Gerenciar cartões</Link>
    </div>
    <div className="invoice-filters">
      <div><label htmlFor="invoice-card">Cartão</label><select id="invoice-card" value={selectedCard} onChange={event => setParameter('cartao', event.target.value)}><option value="">Todos os cartões</option>{cards.rows.map(card => <option key={card.id} value={card.id}>{card.name}{card.active ? '' : ' (arquivado)'}</option>)}</select></div>
      <div><label htmlFor="invoice-status">Situação</label><select id="invoice-status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todas</option><option value="pending">Pendentes</option><option value="overdue">Atrasadas</option><option value="paid">Pagas</option><option value="empty">Sem movimentação</option></select></div>
    </div>
    <p role="status" className={message ? 'success mb-5' : 'sr-only'}>{message}</p>
    {recurring.error && <p className="error mb-5" role="alert">{recurring.error}<button className="secondary ml-3" onClick={recurring.retry}>Tentar gerar novamente</button></p>}
    {loading || recurring.loading ? <p role="status">Carregando faturas…</p> : loadError ? <div className="error" role="alert"><p>{loadError}</p><button className="secondary mt-3" onClick={() => sources.forEach(source => source.retry())}>Tentar novamente</button></div> : <>
      <section className="stats"><article><p>{history ? 'A pagar no histórico' : 'A pagar no mês'}</p><strong>{formatMoney(pendingTotal)}</strong><span>Faturas pendentes e atrasadas</span></article><article><p>Pagamentos vigentes</p><strong>{formatMoney(paidTotal)}</strong><span>Confirmações que não foram desfeitas</span></article><article className="highlight"><p>Faturas com movimentação</p><strong>{base.filter(row => row.chargeCount > 0).length}</strong><span>{history ? 'Competências registradas' : formatMonth(month)}</span></article></section>
      <section className="invoice-grid" aria-label="Faturas">
        {filtered.length === 0 ? <div className="panel empty"><h2>Nenhuma fatura neste filtro</h2><p className="muted mt-2">Escolha outro cartão ou situação para consultar.</p></div> : filtered.map(row => <article className="panel invoice-card" key={row.id}>
          <div className="invoice-card-heading"><span className="card-swatch" style={{ backgroundColor: row.color }} aria-hidden="true">▰</span><div><h2>{row.name}</h2><p className="muted text-sm">{formatMonth(row.competence)}{row.archived ? ' · Cartão arquivado' : ''}</p></div><span className={`badge invoice-state ${row.situation === 'Paga' ? 'state-paid' : row.situation === 'Atrasada' ? 'state-overdue' : ''}`}>{row.situation}</span></div>
          <strong className="invoice-total">{formatMoney(row.totalCents)}</strong>
          <p className="muted text-sm">{row.dueDate ? `Vencimento: ${dateLabel(row.dueDate)}` : 'Sem vencimento registrado'} · {row.chargeCount} cobrança(s)</p>
          {row.header?.status === 'paid' && <p className="text-sm mt-3">Pago {formatMoney(row.header.paidAmountCents ?? 0)}{invoices.rows.find(invoice => invoice.id === row.id)?.paidAt ? ` em ${formatTimestamp(invoices.rows.find(invoice => invoice.id === row.id)!.paidAt!.toDate())}` : ''}</p>}
          {!row.consistent && <p className="notice mt-3" role="status">Atualizando cobranças. Aguarde para confirmar uma operação.</p>}
          <div className="invoice-actions"><button className="secondary" onClick={() => setDetailId(row.id)}>Cobranças e histórico</button>
            {row.header?.status === 'paid' ? <button className="secondary" disabled={!row.consistent} onClick={() => openConfirmation(row, 'reversal')}>Desfazer pagamento</button>
              : row.chargeCount > 0 && <button className="primary" disabled={!row.consistent} onClick={() => openConfirmation(row, 'payment')}>Pagar integralmente</button>}
          </div>
        </article>)}
      </section>
    </>}
    {detailId && details && <Modal title={`${details.name} · ${formatMonth(details.competence)}`} onClose={() => setDetailId(null)}>
      <p className="muted mt-4">{details.situation} · {details.dueDate ? `Vence em ${dateLabel(details.dueDate)}` : 'Sem movimentação'}</p>
      <section className="installment-preview mt-5"><h3>Cobranças desta competência</h3>{details.charges.length ? <table><thead><tr><th>Descrição</th><th>Parcela</th><th>Valor</th></tr></thead><tbody>{details.charges.map(part => <tr key={part.id}><td>{entryMap.get(part.entryId)?.description ?? 'Cobrança recorrente'}</td><td>{part.index}/{part.count}</td><td>{formatMoney(part.amountCents)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Total</th><td>{formatMoney(details.totalCents)}</td></tr></tfoot></table> : <p className="muted mt-3">Sem movimentação nesta competência.</p>}</section>
      <h3 className="mt-6">Histórico de pagamentos e reversões</h3>
      {historyFor(details.id).length ? <ol className="invoice-timeline">{historyFor(details.id).map(event => <li key={event.id}><strong>{event.type === 'payment' ? 'Pagamento integral confirmado' : 'Pagamento desfeito'} · {formatMoney(event.amountCents)}</strong><p className="muted text-sm">{formatTimestamp((event.type === 'payment' ? event.paidAt : event.createdAt).toDate())}</p><p className="muted text-sm">Vencimento registrado: {dateLabel(event.dueDate)}{event.type === 'reversal' ? ` · Pagamento original: ${formatTimestamp(event.paidAt.toDate())}` : ''}</p></li>)}</ol> : <p className="muted text-sm mt-3">Nenhuma confirmação de pagamento neste período.</p>}
      <div className="modal-actions"><button className="secondary" onClick={() => setDetailId(null)}>Fechar</button></div>
    </Modal>}
    {confirmation && <Modal title={confirmation.command.action === 'payment' ? 'Confirmar pagamento integral?' : 'Desfazer pagamento?'} busy={saving} onClose={() => setConfirmation(null)}>
      {confirmation.command.action === 'payment' && <label className="checkbox-label"><input type="checkbox" disabled={saving} checked={confirmation.command.affectAccount ?? false} onChange={event => setConfirmation({ ...confirmation, command: { ...confirmation.command, affectAccount: event.target.checked } })} />Descontar de Minha conta</label>}
      <p className="mt-5"><strong>{confirmation.name}</strong> · Vencimento em {dateLabel(confirmation.dueDate)}</p><p className="invoice-total">{formatMoney(confirmation.command.expectedTotalCents)}</p>
      <p className="muted">{confirmation.command.action === 'payment' ? 'Confirme apenas se você já pagou a fatura integralmente. A confirmação liquida estas cobranças e preserva o valor pago no histórico.' : 'A fatura voltará a ficar pendente e suas cobranças poderão ser alteradas. A confirmação original será mantida no histórico junto com esta reversão.'}</p>
      {confirmationStale && <p className="error" role="alert">A fatura mudou. Feche esta confirmação e confira os dados atualizados.</p>}
      {actionError && <p className="error" role="alert">{actionError}</p>}
      <div className="modal-actions"><button className="secondary" disabled={saving} onClick={() => setConfirmation(null)}>Cancelar</button><button className="primary" disabled={saving || confirmationStale} onClick={async () => {
        if (locked.current) return
        locked.current = true; setSaving(true); setActionError(null)
        try { await changeInvoicePayment(user!.uid, confirmation.command); setMessage(confirmation.command.action === 'payment' ? 'Pagamento integral confirmado.' : 'Pagamento desfeito. A fatura voltou a ficar pendente.'); setConfirmation(null) }
        catch (error) { setActionError(invoiceErrorMessage(error)) }
        finally { locked.current = false; setSaving(false) }
      }}>{saving ? 'Confirmando…' : confirmation.command.action === 'payment' ? 'Confirmar pagamento integral' : 'Sim, desfazer pagamento'}</button></div>
    </Modal>}
  </main>
}
