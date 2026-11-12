import { Link } from 'react-router'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MonthBreakdown } from '../domain/summary'
import { currentMonth, formatDate, formatMoney, formatMonth, formatShortMonth } from '../domain/format'
import { installmentLabel } from '../domain/installments'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Detalhamento de um mês da previsão: rendas, faturas por cartão (com as cobranças), saldo previsto e A receber. */
export function MonthDetailsModal({ breakdown, onClose }: { breakdown: MonthBreakdown; onClose: () => void }) {
  const { summary, incomes, invoices, receivables } = breakdown
  const month = summary.month
  const withCharges = invoices.filter(invoice => invoice.totalCents > 0)
  const withoutCharges = invoices.length - withCharges.length
  const monthQuery = month === currentMonth() ? '' : `mes=${month}`

  return <Modal title={capitalize(formatMonth(month))} onClose={onClose} wide>
    <div className="month-details">
      <section className="month-details-summary" aria-label="Resumo do mês">
        <div><span>Renda</span><strong>{formatMoney(summary.incomeCents)}</strong></div>
        <span aria-hidden="true">−</span>
        <div><span>Faturas</span><strong>{formatMoney(summary.payableCents)}</strong></div>
        <span aria-hidden="true">=</span>
        <div className={`is-balance ${summary.balanceCents < 0 ? 'is-negative' : ''}`}><span>Saldo previsto</span><strong>{formatMoney(summary.balanceCents)}</strong></div>
      </section>

      <section aria-labelledby="month-incomes">
        <h3 id="month-incomes" className="month-details-title"><span>Rendas</span><span>{formatMoney(summary.incomeCents)}</span></h3>
        {incomes.length === 0
          ? <p className="muted text-sm">Nenhuma renda vigente neste mês. <Link className="record-link" to="/rendas">Cadastrar renda</Link></p>
          : <ul className="month-details-list">{incomes.map(income => <li key={income.id}>
            <span>{income.title}<small>{income.endMonth ? `até ${formatShortMonth(income.endMonth)}` : 'sem fim'}</small></span>
            <strong>{formatMoney(income.amountCents)}</strong>
          </li>)}</ul>}
      </section>

      <section aria-labelledby="month-cards">
        <h3 id="month-cards" className="month-details-title"><span>Cartões</span><span>{formatMoney(summary.payableCents)}</span></h3>
        {withCharges.length === 0
          ? <p className="muted text-sm">Nenhuma fatura com cobranças neste mês.</p>
          : <div className="month-details-cards">{withCharges.map(invoice => <details key={invoice.card.id} className="month-details-card">
            <summary>
              <span className="month-details-swatch" style={{ background: invoice.card.color }} />
              <span className="month-details-card-name">{invoice.card.name}<small>Vence {formatDate(invoice.dueDate)} · {invoice.chargeCount} {invoice.chargeCount === 1 ? 'cobrança' : 'cobranças'}</small></span>
              <StatusBadge done={invoice.paid} />
              <strong>{formatMoney(invoice.totalCents)}</strong>
              <ChevronDownIcon className="month-details-chevron" aria-hidden="true" />
            </summary>
            <ul className="month-details-list is-nested">{invoice.rows.map(row => <li key={row.purchase.id}>
              <span>{row.purchase.title}<small>{installmentLabel(row.installment)}</small></span>
              <strong>{formatMoney(row.installment.amountCents)}</strong>
            </li>)}</ul>
            <Button variant="link" size="sm" asChild className="px-0"><Link to={`/faturas?cartao=${invoice.card.id}${monthQuery ? `&${monthQuery}` : ''}`}>Abrir fatura</Link></Button>
          </details>)}</div>}
        {withoutCharges > 0 && <p className="field-hint">{withoutCharges} {withoutCharges === 1 ? 'cartão sem fatura' : 'cartões sem fatura'} neste mês.</p>}
      </section>

      <section aria-labelledby="month-receivables">
        <h3 id="month-receivables" className="month-details-title"><span>A receber <small>(informativo, fora do saldo)</small></span><span>{formatMoney(summary.receivableCents)}</span></h3>
        {receivables.length === 0
          ? <p className="muted text-sm">Nada a receber neste mês.</p>
          : <ul className="month-details-list">{receivables.map(row => <li key={`${row.receivable.id}-${row.installment.index}`}>
            <span>{row.receivable.title}<small>{installmentLabel(row.installment)}</small></span>
            <StatusBadge kind="receivable" done={row.received} />
            <strong>{formatMoney(row.installment.amountCents)}</strong>
          </li>)}</ul>}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="lg" asChild><Link to={monthQuery ? `/?${monthQuery}` : '/'}>Abrir na Visão geral</Link></Button>
        <Button size="lg" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  </Modal>
}
