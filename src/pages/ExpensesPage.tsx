import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import { useCollection } from '../hooks/useCollection'
import { useMonthParam } from '../hooks/useUrlState'
import { expenseActiveIn, expenseCategories, expenseImpact, expenseRows, type ExpenseRow } from '../domain/summary'
import { formatMoney, formatMonth, formatShortMonth } from '../domain/format'
import type { Expense } from '../domain/schemas'
import { deleteExpense } from '../data/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, LoadState } from '../components/EmptyState'
import { MonthPicker } from '../components/MonthPicker'
import { categoryColor, ImpactChart, type ImpactLabels } from '../components/ImpactChart'
import { ExpenseForm } from '../forms/ExpenseForm'
import { ExpenseMonthForm } from '../forms/ExpenseMonthForm'

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const period = (expense: Expense) => `${formatShortMonth(expense.startMonth)} → ${expense.endMonth ? formatShortMonth(expense.endMonth) : 'sem fim'}`
const LABELS: ImpactLabels = {
  legend: 'Categorias',
  total: 'despesas mensais',
  detailTitle: name => `Quanto ${name} usa da renda`,
  detailColumn: 'Despesas',
  hint: 'Selecione uma categoria na legenda para destacar e ver os valores dela mês a mês.',
}

export function ExpensesPage() {
  const { user } = useAuth()
  const expenses = useCollection('expenses')
  const incomes = useCollection('incomes')
  const [month, setMonth] = useMonthParam()
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [changingMonth, setChangingMonth] = useState<Expense | null>(null)
  const [removing, setRemoving] = useState<Expense | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()

  const rows = expenseRows(month, expenses.rows)
  const totalCents = sum(rows.map(row => row.amountCents))
  const byCategory = [...rows.reduce((map, row) => map.set(row.expense.category, (map.get(row.expense.category) ?? 0) + row.amountCents), new Map<string, number>())]
  const others = expenses.rows.filter(expense => !expenseActiveIn(expense, month))
    .sort((a, b) => b.startMonth.localeCompare(a.startMonth) || a.title.localeCompare(b.title, 'pt-BR'))
  const categories = expenseCategories(expenses.rows)
  const colorOf = (category: string) => categoryColor(categories, category)
  const impact = expenseImpact(month, { expenses: expenses.rows, incomes: incomes.rows })

  const actions = (expense: Expense, row?: ExpenseRow) => <div className="row-actions">
    {row && <Button variant="outline" onClick={() => setChangingMonth(expense)}>Valor deste mês</Button>}
    <Button variant="outline" onClick={() => setEditing(expense)}>Editar</Button>
    <Button variant="outline" onClick={() => setRemoving(expense)}>Excluir</Button>
  </div>

  return <main className="workspace">
    <header>
      <div><p className="eyebrow">SAÍDAS MENSAIS</p><h1>Despesas mensais</h1></div>
      <div className="invoice-header-actions">
        <MonthPicker value={month} onChange={setMonth} />
        <Button size="lg" onClick={() => setEditing('new')}>+ Nova despesa</Button>
      </div>
    </header>
    <LoadState loading={expenses.loading} error={expenses.error} onRetry={expenses.retry} />
    {!expenses.loading && !expenses.error && <>
      <p className="muted mb-6 max-w-2xl">Despesas que se repetem todo mês fora dos cartões (aluguel, escola, academia…). Elas entram no valor a pagar e no saldo previsto.
        Total de {formatMonth(month)}: <strong className="text-[var(--text)]">{formatMoney(totalCents)}</strong>.</p>
      {expenses.rows.length === 0
        ? <Card className="p-0"><EmptyState icon="↘" title="Nenhuma despesa mensal cadastrada" action={<Button onClick={() => setEditing('new')}>Cadastrar despesa</Button>}>
          Cadastre as despesas que se repetem todo mês para que entrem no saldo previsto.
        </EmptyState></Card>
        : <>
          {byCategory.length > 0 && <ul className="category-totals" aria-label={`Total por categoria em ${formatMonth(month)}`}>
            {byCategory.map(([category, cents]) => <li key={category}><span className="impact-swatch" style={{ background: colorOf(category) }} /><span>{category}</span><strong>{formatMoney(cents)}</strong></li>)}
          </ul>}
          {impact.length > 0 && <Card className="impact-card mb-8 gap-3 p-5">
            <div>
              <h2 className="text-base font-semibold">Como as despesas afetam a renda</h2>
              <p className="muted text-sm">Despesas mensais por categoria, a partir de {formatMonth(month)}, comparadas à renda (linha tracejada).</p>
            </div>
            <ImpactChart months={impact} labels={LABELS} selectedId={selectedCategory}
              series={categories.map(category => ({ id: category, name: category, color: colorOf(category) }))}
              onSelect={category => setSelectedCategory(current => current === category ? undefined : category)} />
          </Card>}
          <h2 className="mb-3">Despesas de {formatMonth(month)}</h2>
          {rows.length === 0
            ? <Card className="p-0"><EmptyState title="Nenhuma despesa neste mês">Nenhuma despesa mensal vigente em {formatMonth(month)}.</EmptyState></Card>
            : <ul className="installment-list">{rows.map(row => <li key={row.expense.id} className="installment-row">
              <div className="installment-main">
                <span className="installment-title">{row.expense.title}</span>
                <span className="installment-meta">{row.expense.category} · {period(row.expense)}</span>
              </div>
              <div className="installment-side">
                <strong className="installment-amount">{formatMoney(row.amountCents)}</strong>
                {row.changed && <Badge variant="secondary" title={`Valor padrão: ${formatMoney(row.expense.amountCents)}`}>Só neste mês</Badge>}
                {actions(row.expense, row)}
              </div>
            </li>)}</ul>}

          {others.length > 0 && <>
            <h2 className="mb-3 mt-8">Fora de {formatMonth(month)}</h2>
            <ul className="installment-list">{others.map(expense => <li key={expense.id} className="installment-row">
              <div className="installment-main">
                <span className="installment-title">{expense.title}</span>
                <span className="installment-meta">{expense.category} · {period(expense)}</span>
              </div>
              <div className="installment-side">
                <strong className="installment-amount">{formatMoney(expense.amountCents)}<span className="muted text-xs font-normal">/mês</span></strong>
                <Badge variant="secondary">{expense.startMonth > month ? 'Futura' : 'Encerrada'}</Badge>
                {actions(expense)}
              </div>
            </li>)}</ul>
          </>}
        </>}
    </>}
    {editing && <ExpenseForm expense={editing === 'new' ? undefined : editing} categories={categories} initialMonth={month} onClose={() => setEditing(null)} />}
    {changingMonth && <ExpenseMonthForm expense={changingMonth} month={month} onClose={() => setChangingMonth(null)} />}
    {removing && <ConfirmDialog danger title="Excluir despesa?" confirmLabel="Excluir de todos os meses" onClose={() => setRemoving(null)}
      onConfirm={() => deleteExpense(user!.uid, removing.id)}>
      <p>Deseja excluir <strong>{removing.title}</strong> ({formatMoney(removing.amountCents)}/mês)?</p>
      <p>A despesa sai de todos os meses, anteriores e próximos, e o saldo previsto desses meses será recalculado.</p>
    </ConfirmDialog>}
  </main>
}
