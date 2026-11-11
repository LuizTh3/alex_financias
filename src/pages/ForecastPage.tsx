import { Link } from 'react-router'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      <Card className="forecast-card p-0">
        <Table className="forecast-table">
          <TableHeader><TableRow><TableHead scope="col">Mês</TableHead><TableHead scope="col">Renda</TableHead><TableHead scope="col">A pagar</TableHead><TableHead scope="col">Saldo previsto</TableHead><TableHead scope="col" className="informative">A receber <span>(informativo)</span></TableHead></TableRow></TableHeader>
          <TableBody>{months.map(item => <TableRow key={item.month} className={item.month === today ? 'is-current' : undefined}>
            <TableHead scope="row" className="font-medium text-foreground"><Link className="record-link" to={item.month === today ? '/' : `/?mes=${item.month}`} title="Abrir na Visão geral">{capitalize(formatMonth(item.month))}</Link></TableHead>
            <TableCell data-label="Renda">{formatMoney(item.incomeCents)}</TableCell>
            <TableCell data-label="A pagar">{formatMoney(item.payableCents)}</TableCell>
            <TableCell data-label="Saldo previsto" className={item.balanceCents < 0 ? 'is-negative' : 'is-positive'}>{formatMoney(item.balanceCents)}</TableCell>
            <TableCell data-label="A receber (informativo)" className="informative">{formatMoney(item.receivableCents)}</TableCell>
          </TableRow>)}</TableBody>
          <TableFooter><TableRow><TableHead scope="row" className="text-foreground">Total em 12 meses</TableHead><TableCell data-label="Renda">{formatMoney(totals.income)}</TableCell><TableCell data-label="A pagar">{formatMoney(totals.payable)}</TableCell>
            <TableCell data-label="Saldo previsto" className={totals.balance < 0 ? 'is-negative' : 'is-positive'}>{formatMoney(totals.balance)}</TableCell><TableCell data-label="A receber (informativo)" className="informative">{formatMoney(totals.receivable)}</TableCell></TableRow></TableFooter>
        </Table>
      </Card>
    </>}
  </main>
}
