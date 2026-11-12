import { useState } from 'react'
import { ArrowUpRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Link, useNavigate } from 'react-router'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '../contexts/AuthContext'
import { useCollection, useFinanceData } from '../hooks/useCollection'
import { useMonthParam } from '../hooks/useUrlState'
import {
  activeCards, CATEGORY_SERIES, cardInvoices, expenseCategories, expenseRows, monthSummary, receivableTotals, totalImpact,
} from '../domain/summary'
import { categoryColor, ImpactChart, type ImpactLabels, type ImpactSeries } from '../components/ImpactChart'
import { formatMoney, formatMonth } from '../domain/format'
import { setMonthClosed } from '../data/store'
import { CreditCardVisual } from '../components/CreditCardVisual'
import { MonthPicker } from '../components/MonthPicker'
import { InvoicePayDialog, type PayTarget } from '../components/InvoicePayDialog'
import { EmptyState, LoadState } from '../components/EmptyState'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const percent = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value)
const IMPACT_LABELS: ImpactLabels = {
  legend: 'Cartões e despesas',
  total: 'faturas e despesas',
  detailTitle: name => `Quanto ${name} usa da renda`,
  detailColumn: 'Valor',
  hint: 'Selecione um cartão ou uma categoria na legenda para destacar e ver os valores mês a mês.',
}

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
  const receivedShare = receivable.totalCents > 0 ? receivable.receivedCents / receivable.totalCents : 0
  const closed = closedMonths.rows.some(row => row.month === month)
  const expenseCount = expenseRows(month, data.expenses).length
  const [selectedSeries, setSelectedSeries] = useState<string | undefined>()
  const impact = totalImpact(month, data)
  const categories = expenseCategories(data.expenses)
  const series: ImpactSeries[] = [
    ...activeCards(data.cards).map(card => ({ id: card.id, name: card.name, color: card.color })),
    ...categories.map(category => ({ id: CATEGORY_SERIES + category, name: category, color: categoryColor(categories, category) })),
  ]

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
        <div className="section-heading">
          <h2 id="receivable-title">A receber</h2>
          <Badge className="bg-success-bg text-success">{capitalize(formatMonth(month))}</Badge>
        </div>
        <Card className="receivable-progress gap-0 p-0">
          <dl className="receivable-metrics">
            <div><dt>Total a receber</dt><dd>{formatMoney(receivable.totalCents)}</dd></div>
            <div><dt>Já recebido</dt><dd className="is-received">{formatMoney(receivable.receivedCents)}</dd></div>
            <div><dt>Pendente</dt><dd className="is-pending">{formatMoney(receivable.pendingCents)}</dd></div>
          </dl>
          <div className="receivable-progress-row">
            <div className="receivable-progress-info">
              <div className="receivable-progress-label"><span id="receivable-progress-label">Progresso dos recebimentos</span><strong>{percent(receivedShare)}</strong></div>
              <div className="receivable-bar" role="progressbar" aria-labelledby="receivable-progress-label"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(receivedShare * 100)} aria-valuetext={`${percent(receivedShare)} recebido`}>
                <span style={{ width: `${receivedShare * 100}%` }} />
              </div>
            </div>
            <Button variant="outline" size="lg" asChild><Link to={`/a-receber${month === defaultMonth ? '' : `?mes=${month}`}`}>Acessar <ArrowUpRightIcon aria-hidden="true" /></Link></Button>
          </div>
          <p className="receivable-footnote">Valores de terceiros · Só para consulta: não entra no saldo previsto.</p>
        </Card>
      </section>

      {impact.length > 0 && <section className="mt-8" aria-labelledby="impact-title">
        <Card className="impact-card gap-3 p-5">
          <div>
            <h2 id="impact-title" className="text-base font-semibold">Como cartões e despesas afetam a renda</h2>
            <p className="muted text-sm">Faturas de cada cartão e despesas mensais por categoria, a partir de {formatMonth(month)}, comparadas à renda (linha tracejada).</p>
          </div>
          <ImpactChart months={impact} series={series} labels={IMPACT_LABELS} selectedId={selectedSeries}
            onSelect={id => setSelectedSeries(current => current === id ? undefined : id)} />
        </Card>
      </section>}
    </>}
    {paying && <InvoicePayDialog target={paying} onClose={() => setPaying(null)} />}
  </main>
}
