import { Link } from 'react-router'
import { useFinanceData } from '../hooks/useCollection'
import { useMonthParam } from '../hooks/useUrlState'
import { forecast } from '../domain/summary'
import { currentMonth, formatMoney, formatMonth } from '../domain/format'
import { MonthPicker } from '../components/MonthPicker'
import { LoadState } from '../components/EmptyState'

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function ForecastPage() {
  const { data, loading, error, retry } = useFinanceData()
  const [start, setStart] = useMonthParam('inicio')
  const months = forecast(start, data)
  const today = currentMonth()
  const totals = {
    income: sum(months.map(item => item.incomeCents)), payable: sum(months.map(item => item.payableCents)),
    balance: sum(months.map(item => item.balanceCents)), receivable: sum(months.map(item => item.receivableCents)),
  }
  const negative = months.filter(item => item.balanceCents < 0).length

  return <main className="workspace">
    <header>
      <div><p className="eyebrow">PRÓXIMOS 12 MESES</p><h1>Previsão dos meses</h1></div>
      <div className="field-inline"><span className="muted text-sm">A partir de</span><MonthPicker label="Mês inicial da previsão" value={start} onChange={setStart} /></div>
    </header>
    <LoadState loading={loading} error={error} onRetry={retry} />
    {!loading && !error && <>
      <p className="muted mb-4 max-w-3xl">Saldo previsto = renda − faturas dos cartões. A coluna <strong>A receber</strong> é só informativa e não entra no saldo.
        {negative > 0 && <> <strong className="text-[var(--danger)]">{negative} {negative === 1 ? 'mês fica' : 'meses ficam'} negativo{negative === 1 ? '' : 's'}.</strong></>}</p>
      <div className="table-scroll panel">
        <table className="forecast-table">
          <thead><tr><th scope="col">Mês</th><th scope="col">Renda</th><th scope="col">A pagar</th><th scope="col">Saldo previsto</th><th scope="col" className="informative">A receber <span>(informativo)</span></th></tr></thead>
          <tbody>{months.map(item => <tr key={item.month} className={item.month === today ? 'is-current' : undefined}>
            <th scope="row"><Link className="record-link" to={item.month === today ? '/' : `/?mes=${item.month}`} title="Abrir na Visão geral">{capitalize(formatMonth(item.month))}</Link></th>
            <td>{formatMoney(item.incomeCents)}</td>
            <td>{formatMoney(item.payableCents)}</td>
            <td className={item.balanceCents < 0 ? 'is-negative' : 'is-positive'}>{formatMoney(item.balanceCents)}</td>
            <td className="informative">{formatMoney(item.receivableCents)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row">Total em 12 meses</th><td>{formatMoney(totals.income)}</td><td>{formatMoney(totals.payable)}</td>
            <td className={totals.balance < 0 ? 'is-negative' : 'is-positive'}>{formatMoney(totals.balance)}</td><td className="informative">{formatMoney(totals.receivable)}</td></tr></tfoot>
        </table>
      </div>
    </>}
  </main>
}
