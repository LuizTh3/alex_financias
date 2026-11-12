import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Link, useNavigate } from 'react-router'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '../contexts/AuthContext'
import { useCollection, useFinanceData } from '../hooks/useCollection'
import { useMonthParam } from '../hooks/useUrlState'
import { cardInvoices, expenseRows, monthSummary, receivableTotals } from '../domain/summary'
import { formatMoney, formatMonth } from '../domain/format'
import { setMonthClosed } from '../data/store'
import { CreditCardVisual } from '../components/CreditCardVisual'
import { MonthPicker } from '../components/MonthPicker'
import { InvoicePayDialog, type PayTarget } from '../components/InvoicePayDialog'
import { EmptyState, LoadState } from '../components/EmptyState'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function OverviewPage() {
  const { user } = useAuth()
  const { data, loading, error, retry } = useFinanceData()
  const [month, setMonth, { defaultMonth, pinMonth }] = useMonthParam()
  const closedMonths = useCollection('closedMonths')
  const [paying, setPaying] = useState<PayTarget | null>(null)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const navigate = useNavigate()
  const monthQuery = month === defaultMonth ? '' : `&mes=${month}`
  const summary = monthSummary(month, data)
  const invoices = cardInvoices(month, data)
  const receivable = receivableTotals(month, data.receivables)
  const closed = closedMonths.rows.some(row => row.month === month)
  const expenseCount = expenseRows(month, data.expenses).length

  /** Marcar mantém este mês na tela; nas próximas aberturas a Visão geral já começa no mês seguinte. */
  async function toggleClosed(next: boolean) {
    setCloseError(null); setClosing(true)
    if (next) pinMonth(month)
    try { await setMonthClosed(user!.uid, month, next) } catch { setCloseError('Não foi possível salvar. Tente novamente.') } finally { setClosing(false) }
  }

  return <main className="workspace">
    <header>
      <div><p className="eyebrow">RESUMO DO MÊS</p><h1>Visão geral</h1></div>
      <div className="header-actions">
        <div className="month-closed">
          <Label htmlFor="month-closed" className="font-normal">Mês concluído</Label>
          <Switch id="month-closed" checked={closed} disabled={closing || closedMonths.loading || !!closedMonths.error} onCheckedChange={toggleClosed}
            title={closed ? 'Desmarcar: a tela inicial volta a abrir neste mês' : 'Marcar: a tela inicial passa a abrir no mês seguinte'} />
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
    </header>
    {closeError && <p role="alert" className="error mb-4">{closeError}</p>}
    {closed && <p className="field-hint mb-4">{capitalize(formatMonth(month))} está concluído: ao abrir o sistema, a Visão geral começa em {formatMonth(defaultMonth)}.</p>}
    <LoadState loading={loading} error={error} onRetry={retry} />
    {!loading && !error && <>
      <section className="stats" aria-label={`Resumo de ${formatMonth(month)}`}>
        <Card className="gap-0 p-6"><p>Renda</p><strong>{formatMoney(summary.incomeCents)}</strong>
          <span>{summary.incomeCents ? 'Rendas vigentes no mês' : <Link className="record-link" to="/rendas">Cadastrar renda</Link>}</span></Card>
        <Card className="gap-0 p-6"><p>A pagar</p><strong>{formatMoney(summary.payableCents)}</strong>
          <span>{summary.expensesCents > 0
            ? `Faturas ${formatMoney(summary.invoicesCents)} + despesas mensais ${formatMoney(summary.expensesCents)}`
            : `Soma das faturas de ${invoices.length} ${invoices.length === 1 ? 'cartão' : 'cartões'}`}</span></Card>
        <Card className={`highlight gap-0 bg-(--highlight) p-6 text-[#f7f9f1] ${summary.balanceCents < 0 ? 'is-negative' : ''}`}><p>Saldo previsto</p><strong>{formatMoney(summary.balanceCents)}</strong>
          <span>Renda menos faturas e despesas mensais</span></Card>
      </section>

      <section aria-labelledby="cards-title">
        <div className="section-heading"><h2 id="cards-title">Cartões</h2><Link className="record-link text-sm" to="/cartoes">Gerenciar cartões</Link></div>
        {invoices.length === 0
          ? <Card className="p-0"><EmptyState icon="▭" title="Nenhum cartão cadastrado" action={<Button asChild><Link to="/cartoes">Cadastrar cartão</Link></Button>}>Cadastre seus cartões para ver as faturas do mês aqui.</EmptyState></Card>
          : <div className="card-grid">
            {invoices.map(invoice => {
              const open = () => navigate(`/faturas?cartao=${invoice.card.id}${monthQuery}`)
              return <CreditCardVisual key={invoice.card.id} card={invoice.card} invoice={invoice} onOpen={open} actions={<>
                <Button onClick={open}>Acessar</Button>
                <Button variant="outline" disabled={!invoice.paid && invoice.totalCents === 0}
                  title={!invoice.paid && invoice.totalCents === 0 ? 'Sem lançamentos neste mês' : undefined}
                  onClick={() => setPaying({ cardId: invoice.card.id, cardName: invoice.card.name, month, totalCents: invoice.totalCents, paid: invoice.paid })}>
                  {invoice.paid ? 'Desmarcar' : 'Pagar'}
                </Button>
              </>} />
            })}
          </div>}
      </section>

      <section className="mt-8" aria-labelledby="expenses-title">
        <div className="section-heading"><h2 id="expenses-title">Despesas mensais</h2></div>
        <Card className="receivable-card">
          <div>
            <p className="muted text-sm">Despesas fora dos cartões em {formatMonth(month)}</p>
            <strong className="receivable-total">{formatMoney(summary.expensesCents)}</strong>
            <p className="text-sm">{expenseCount === 0 ? 'Nenhuma despesa vigente neste mês' : `${expenseCount} ${expenseCount === 1 ? 'despesa vigente' : 'despesas vigentes'}`}</p>
            <p className="field-hint">Entram no valor a pagar e no saldo previsto.</p>
          </div>
          <Link className="secondary" to={`/despesas${month === defaultMonth ? '' : `?mes=${month}`}`}>Acessar</Link>
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="receivable-title">
        <div className="section-heading"><h2 id="receivable-title">A receber</h2></div>
        <Card className="receivable-card">
          <div>
            <p className="muted text-sm">Valores de terceiros em {formatMonth(month)}</p>
            <strong className="receivable-total">{formatMoney(receivable.totalCents)}</strong>
            <p className="text-sm">Recebido {formatMoney(receivable.receivedCents)} · Falta {formatMoney(receivable.pendingCents)}</p>
            <p className="field-hint">Só para consulta: não entra no saldo previsto.</p>
          </div>
          <Link className="secondary" to={`/a-receber${month === defaultMonth ? '' : `?mes=${month}`}`}>Acessar</Link>
        </Card>
      </section>
    </>}
    {paying && <InvoicePayDialog target={paying} onClose={() => setPaying(null)} />}
  </main>
}
