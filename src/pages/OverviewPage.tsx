import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Link, useNavigate } from 'react-router'
import { useFinanceData } from '../hooks/useCollection'
import { useMonthParam } from '../hooks/useUrlState'
import { cardInvoices, monthSummary, receivableTotals } from '../domain/summary'
import { currentMonth, formatMoney, formatMonth } from '../domain/format'
import { CreditCardVisual } from '../components/CreditCardVisual'
import { MonthPicker } from '../components/MonthPicker'
import { InvoicePayDialog, type PayTarget } from '../components/InvoicePayDialog'
import { EmptyState, LoadState } from '../components/EmptyState'

export function OverviewPage() {
  const { data, loading, error, retry } = useFinanceData()
  const [month, setMonth] = useMonthParam()
  const [paying, setPaying] = useState<PayTarget | null>(null)
  const navigate = useNavigate()
  const monthQuery = month === currentMonth() ? '' : `&mes=${month}`
  const summary = monthSummary(month, data)
  const invoices = cardInvoices(month, data)
  const receivable = receivableTotals(month, data.receivables)

  return <main className="workspace">
    <header>
      <div><p className="eyebrow">RESUMO DO MÊS</p><h1>Visão geral</h1></div>
      <MonthPicker value={month} onChange={setMonth} />
    </header>
    <LoadState loading={loading} error={error} onRetry={retry} />
    {!loading && !error && <>
      <section className="stats" aria-label={`Resumo de ${formatMonth(month)}`}>
        <Card className="gap-0 p-6"><p>Renda</p><strong>{formatMoney(summary.incomeCents)}</strong>
          <span>{summary.incomeCents ? 'Rendas vigentes no mês' : <Link className="record-link" to="/rendas">Cadastrar renda</Link>}</span></Card>
        <Card className="gap-0 p-6"><p>A pagar</p><strong>{formatMoney(summary.payableCents)}</strong>
          <span>Soma das faturas de {invoices.length} {invoices.length === 1 ? 'cartão' : 'cartões'}</span></Card>
        <Card className={`highlight gap-0 bg-(--highlight) p-6 text-[#f7f9f1] ${summary.balanceCents < 0 ? 'is-negative' : ''}`}><p>Saldo previsto</p><strong>{formatMoney(summary.balanceCents)}</strong>
          <span>Renda menos o valor a pagar</span></Card>
      </section>

      <section aria-labelledby="cards-title">
        <div className="section-heading"><h2 id="cards-title">Cartões</h2><Link className="record-link text-sm" to="/cartoes">Gerenciar cartões</Link></div>
        {invoices.length === 0
          ? <Card className="p-0"><EmptyState icon="▭" title="Nenhum cartão cadastrado" action={<Button asChild><Link to="/cartoes">Cadastrar cartão</Link></Button>}>Cadastre seus cartões para ver as faturas do mês aqui.</EmptyState></Card>
          : <div className="card-grid">
            {invoices.map(invoice => {
              const open = () => navigate(`/faturas?cartao=${invoice.card.id}${monthQuery}`)
              return <CreditCardVisual key={invoice.card.id} card={invoice.card} invoice={invoice} onOpen={open} actions={<>
                <Button variant="outline" onClick={open}>Acessar</Button>
                <Button variant={invoice.paid ? 'outline' : 'default'} disabled={!invoice.paid && invoice.totalCents === 0}
                  title={!invoice.paid && invoice.totalCents === 0 ? 'Sem lançamentos neste mês' : undefined}
                  onClick={() => setPaying({ cardId: invoice.card.id, cardName: invoice.card.name, month, totalCents: invoice.totalCents, paid: invoice.paid })}>
                  {invoice.paid ? 'Desmarcar' : 'Pagar'}
                </Button>
              </>} />
            })}
          </div>}
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
          <Link className="secondary" to={`/a-receber${month === currentMonth() ? '' : `?mes=${month}`}`}>Acessar</Link>
        </Card>
      </section>
    </>}
    {paying && <InvoicePayDialog target={paying} onClose={() => setPaying(null)} />}
  </main>
}
