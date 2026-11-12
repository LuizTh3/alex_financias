import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Link } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { useFinanceData } from '../hooks/useCollection'
import { useMonthParam, useSearchParam } from '../hooks/useUrlState'
import { activeCards, incomeImpact, invoiceDates, invoiceRows, invoiceTotal, isInvoicePaid, type InvoiceRow, type PurchaseFilter } from '../domain/summary'
import { formatDate, formatMoney, formatMonth } from '../domain/format'
import { lastMonthOf } from '../domain/installments'
import type { Purchase } from '../domain/schemas'
import { deletePurchase } from '../data/store'
import { CreditCardVisual } from '../components/CreditCardVisual'
import { IncomeImpactChart } from '../components/IncomeImpactChart'
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
    <Label htmlFor="invoice-card" className="mb-2">Cartão</Label>
    <NativeSelect id="invoice-card" className="w-full" value={card?.id ?? ''} onChange={event => { setFilter('all'); setCardId(event.target.value || null) }}>
      <NativeSelectOption value="">Selecione o cartão</NativeSelectOption>
      {cards.map(item => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
    </NativeSelect>
  </div>

  const impact = incomeImpact(month, data)
  const impactSection = <Card className={`impact-card gap-3 p-5 ${card ? '' : 'mt-4'}`}>
    <div>
      <h2 className="text-base font-semibold">Como os cartões afetam a renda</h2>
      <p className="muted text-sm">Faturas de cada cartão por mês, a partir de {formatMonth(month)}, comparadas à renda (linha tracejada).</p>
    </div>
    {impact.length === 0
      ? <p className="muted text-sm">Nenhuma fatura nos próximos 12 meses.</p>
      : <IncomeImpactChart months={impact} cards={cards} selectedId={card?.id} onSelect={id => { setFilter('all'); setCardId(id === card?.id ? null : id) }} />}
  </Card>

  if (loading || error) return <main className="workspace"><header><div><p className="eyebrow">POR CARTÃO</p><h1>Faturas</h1></div></header><LoadState loading={loading} error={error} onRetry={retry} /></main>

  const rows = card ? invoiceRows(card.id, month, data.purchases, filter) : []
  const allRows = card ? invoiceRows(card.id, month, data.purchases) : []
  const totalCents = card ? invoiceTotal(card.id, month, data.purchases) : 0
  const paid = card ? isInvoicePaid(card.id, month, data.statuses) : false
  const counts = { all: allRows.length, single: allRows.filter(row => row.installment.count === 1).length, installment: allRows.filter(row => row.installment.count > 1).length }

  return <main className="workspace">
    <header>
      <div><p className="eyebrow">POR CARTÃO</p><h1>Faturas</h1></div>
      {cards.length > 0 && <MonthPicker value={month} onChange={setMonth} />}
    </header>
    {cards.length === 0
      ? <Card className="p-0"><EmptyState icon="▭" title="Nenhum cartão cadastrado" action={<Button asChild><Link to="/cartoes">Cadastrar cartão</Link></Button>}>As faturas aparecem depois que você cadastrar um cartão.</EmptyState></Card>
      : !card
        ? <>{selector}{impactSection}<Card className="p-0 mt-4"><EmptyState icon="▭" title="Selecione o cartão">Escolha um cartão acima ou no gráfico para visualizar a fatura.</EmptyState></Card></>
        : <>{selector}<div className="invoice-layout mt-6">
          <aside className="invoice-side">
            <CreditCardVisual size="large" card={card} invoice={{ totalCents, paid, chargeCount: allRows.length, ...invoiceDates(card, month) }} />
            <div className="invoice-buttons">
              <Button onClick={() => setEditing('new')}>+ Novo lançamento</Button>
              <Button variant="outline" disabled={!paid && totalCents === 0}
                onClick={() => setPaying({ cardId: card.id, cardName: card.name, month, totalCents, paid })}>
                {paid ? 'Desmarcar pago' : 'Marcar fatura como paga'}
              </Button>
            </div>
            {impactSection}
          </aside>
          <section className="invoice-history" aria-labelledby="history-title">
            <div className="history-heading">
              <h2 id="history-title">Lançamentos de {formatMonth(month)}</h2>
              <ToggleGroup type="single" variant="outline" aria-label="Filtrar lançamentos" value={filter} onValueChange={value => { if (value) setFilter(value as PurchaseFilter) }}>
                {FILTERS.map(([value, label]) => <ToggleGroupItem key={value} value={value} aria-label={`${label}: ${counts[value]}`}>{label}<span className="text-xs text-muted-foreground">{counts[value]}</span></ToggleGroupItem>)}
              </ToggleGroup>
            </div>
            {rows.length === 0
              ? <Card className="p-0"><EmptyState title={allRows.length ? 'Nenhum lançamento neste filtro' : 'Nenhum lançamento nesta fatura'}
                action={!allRows.length && <Button onClick={() => setEditing('new')}>Lançar compra</Button>}>
                {allRows.length ? 'Escolha outro filtro para ver os demais.' : `Não há parcelas do ${card.name} vencendo em ${formatMonth(month)}.`}
              </EmptyState></Card>
              : <ul className="installment-list">{rows.map(row => <InstallmentRow key={row.purchase.id} title={row.purchase.title} installment={row.installment}
                onOpen={() => setDetails(row)} actions={<>
                  <Button variant="outline" onClick={() => setEditing(row.purchase)}>Editar</Button>
                  <Button variant="outline" onClick={() => setRemoving(row.purchase)}>Excluir</Button>
                </>} />)}</ul>}
          </section>
        </div></>}

    {editing && card && <PurchaseForm card={card} purchase={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {paying && <InvoicePayDialog target={paying} onClose={() => setPaying(null)} />}
    {details && <DetailsModal title={details.purchase.title} description={details.purchase.description} onClose={() => setDetails(null)}
      rows={[
        ['Valor total', formatMoney(details.purchase.totalCents)],
        ['Parcela deste mês', details.installment.count === 1 ? 'À vista' : `${details.installment.index}/${details.installment.count} — ${formatMoney(details.installment.amountCents)}`],
        ['Data da compra', formatDate(details.purchase.purchaseDate)],
        ['Vencimentos', details.installment.count === 1 ? formatMonth(details.purchase.firstDueMonth) : `${formatMonth(details.purchase.firstDueMonth)} a ${formatMonth(lastMonthOf(details.purchase))}`],
      ]}
      actions={<Button variant="outline" onClick={() => { setEditing(details.purchase); setDetails(null) }}>Editar</Button>} />}
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
