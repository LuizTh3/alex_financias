import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { useFinanceData } from '../hooks/useCollection'
import { useMonthParam, useSearchParam } from '../hooks/useUrlState'
import { activeCards, invoiceDates, invoiceRows, invoiceTotal, isInvoicePaid, type InvoiceRow, type PurchaseFilter } from '../domain/summary'
import { formatDate, formatMoney, formatMonth } from '../domain/format'
import { lastMonthOf } from '../domain/installments'
import type { Purchase } from '../domain/schemas'
import { deletePurchase } from '../data/store'
import { CreditCardVisual } from '../components/CreditCardVisual'
import { MonthPicker } from '../components/MonthPicker'
import { InstallmentRow } from '../components/InstallmentRow'
import { DetailsModal } from '../components/DetailsModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InvoicePayDialog, type PayTarget } from '../components/InvoicePayDialog'
import { EmptyState, LoadState } from '../components/EmptyState'
import { PurchaseForm } from '../forms/PurchaseForm'

const FILTERS: [PurchaseFilter, string][] = [['all', 'Todos'], ['single', 'À vista'], ['installment', 'Parcelado']]

export function InvoicesPage() {
  const { user } = useAuth()
  const { data, loading, error, retry } = useFinanceData()
  const [cardId, setCardId] = useSearchParam('cartao')
  const [month, setMonth] = useMonthParam()
  const [filter, setFilter] = useState<PurchaseFilter>('all')
  const [editing, setEditing] = useState<Purchase | 'new' | null>(null)
  const [details, setDetails] = useState<InvoiceRow | null>(null)
  const [removing, setRemoving] = useState<Purchase | null>(null)
  const [paying, setPaying] = useState<PayTarget | null>(null)
  const cards = activeCards(data.cards)
  const card = cards.find(item => item.id === cardId)

  const selector = <div className="field invoice-card-select">
    <label htmlFor="invoice-card">Cartão</label>
    <select id="invoice-card" value={card?.id ?? ''} onChange={event => { setFilter('all'); setCardId(event.target.value || null) }}>
      <option value="">Selecione o cartão</option>
      {cards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </div>

  if (loading || error) return <main className="workspace"><header><div><p className="eyebrow">POR CARTÃO</p><h1>Faturas</h1></div></header><LoadState loading={loading} error={error} onRetry={retry} /></main>

  const rows = card ? invoiceRows(card.id, month, data.purchases, filter) : []
  const allRows = card ? invoiceRows(card.id, month, data.purchases) : []
  const totalCents = card ? invoiceTotal(card.id, month, data.purchases) : 0
  const paid = card ? isInvoicePaid(card.id, month, data.statuses) : false
  const counts = { all: allRows.length, single: allRows.filter(row => row.installment.count === 1).length, installment: allRows.filter(row => row.installment.count > 1).length }

  return <main className="workspace">
    <header>
      <div><p className="eyebrow">POR CARTÃO</p><h1>Faturas</h1></div>
      {card && <MonthPicker value={month} onChange={setMonth} />}
    </header>
    {cards.length === 0
      ? <div className="panel"><EmptyState icon="▭" title="Nenhum cartão cadastrado" action={<Link className="primary inline-block" to="/cartoes">Cadastrar cartão</Link>}>As faturas aparecem depois que você cadastrar um cartão.</EmptyState></div>
      : !card
        ? <>{selector}<div className="panel mt-4"><EmptyState icon="▭" title="Selecione o cartão">Escolha um cartão acima para visualizar a fatura.</EmptyState></div></>
        : <div className="invoice-layout">
          <aside className="invoice-side">
            {selector}
            <CreditCardVisual size="large" card={card} invoice={{ totalCents, paid, ...invoiceDates(card, month) }} />
            <div className="invoice-buttons">
              <button type="button" className="primary" onClick={() => setEditing('new')}>+ Novo lançamento</button>
              <button type="button" className={paid ? 'secondary' : 'secondary pay-button'} disabled={!paid && totalCents === 0}
                onClick={() => setPaying({ cardId: card.id, cardName: card.name, month, totalCents, paid })}>
                {paid ? 'Desmarcar pago' : 'Marcar fatura como paga'}
              </button>
            </div>
          </aside>
          <section className="invoice-history" aria-labelledby="history-title">
            <div className="history-heading">
              <h2 id="history-title">Lançamentos de {formatMonth(month)}</h2>
              <div className="filter-tabs" role="group" aria-label="Filtrar lançamentos">
                {FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{counts[value]}</span></button>)}
              </div>
            </div>
            {rows.length === 0
              ? <div className="panel"><EmptyState title={allRows.length ? 'Nenhum lançamento neste filtro' : 'Nenhum lançamento nesta fatura'}
                action={!allRows.length && <button type="button" className="primary" onClick={() => setEditing('new')}>Lançar compra</button>}>
                {allRows.length ? 'Escolha outro filtro para ver os demais.' : `Não há parcelas do ${card.name} vencendo em ${formatMonth(month)}.`}
              </EmptyState></div>
              : <ul className="installment-list">{rows.map(row => <InstallmentRow key={row.purchase.id} title={row.purchase.title} installment={row.installment}
                onOpen={() => setDetails(row)} actions={<>
                  <button type="button" className="secondary" onClick={() => setEditing(row.purchase)}>Editar</button>
                  <button type="button" className="secondary" onClick={() => setRemoving(row.purchase)}>Excluir</button>
                </>} />)}</ul>}
          </section>
        </div>}

    {editing && card && <PurchaseForm card={card} purchase={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {paying && <InvoicePayDialog target={paying} onClose={() => setPaying(null)} />}
    {details && <DetailsModal title={details.purchase.title} description={details.purchase.description} onClose={() => setDetails(null)}
      rows={[
        ['Valor total', formatMoney(details.purchase.totalCents)],
        ['Parcela deste mês', details.installment.count === 1 ? 'À vista' : `${details.installment.index}/${details.installment.count} — ${formatMoney(details.installment.amountCents)}`],
        ['Data da compra', formatDate(details.purchase.purchaseDate)],
        ['Vencimentos', details.installment.count === 1 ? formatMonth(details.purchase.firstDueMonth) : `${formatMonth(details.purchase.firstDueMonth)} a ${formatMonth(lastMonthOf(details.purchase))}`],
      ]}
      actions={<button type="button" className="secondary" onClick={() => { setEditing(details.purchase); setDetails(null) }}>Editar</button>} />}
    {removing && <ConfirmDialog danger title={removing.installmentCount > 1 ? 'Excluir todas as parcelas?' : 'Excluir lançamento?'}
      confirmLabel={removing.installmentCount > 1 ? `Excluir as ${removing.installmentCount} parcelas` : 'Excluir'}
      onClose={() => setRemoving(null)} onConfirm={() => deletePurchase(user!.uid, removing.id)}>
      {removing.installmentCount > 1
        ? <><p>Deseja excluir todas as parcelas geradas por <strong>{removing.title}</strong> ({removing.installmentCount}x, total de {formatMoney(removing.totalCents)})?</p>
          <p>As parcelas de todos os meses, anteriores e próximos, serão excluídas.</p></>
        : <p>Excluir <strong>{removing.title}</strong> ({formatMoney(removing.totalCents)})?</p>}
    </ConfirmDialog>}
  </main>
}
