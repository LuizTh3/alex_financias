import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCollection } from '../hooks/useCollection'
import { incomeActiveIn, incomeInMonth } from '../domain/summary'
import { currentMonth, formatMoney, formatMonth, formatShortMonth } from '../domain/format'
import type { Income } from '../domain/schemas'
import { deleteIncome } from '../data/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, LoadState } from '../components/EmptyState'
import { IncomeForm } from '../forms/IncomeForm'

type Situation = 'active' | 'future' | 'ended'
const SITUATIONS: Record<Situation, string> = { active: 'Vigente', future: 'Futura', ended: 'Encerrada' }
const situationOf = (income: Income, month: string): Situation =>
  incomeActiveIn(income, month) ? 'active' : income.startMonth > month ? 'future' : 'ended'
const ORDER: Situation[] = ['active', 'future', 'ended']

export function IncomesPage() {
  const { user } = useAuth()
  const incomes = useCollection('incomes')
  const [editing, setEditing] = useState<Income | 'new' | null>(null)
  const [removing, setRemoving] = useState<Income | null>(null)
  const month = currentMonth()
  const sorted = [...incomes.rows].sort((a, b) =>
    ORDER.indexOf(situationOf(a, month)) - ORDER.indexOf(situationOf(b, month)) || b.startMonth.localeCompare(a.startMonth) || a.title.localeCompare(b.title, 'pt-BR'))

  return <main className="workspace">
    <header>
      <div><p className="eyebrow">ENTRADAS MENSAIS</p><h1>Rendas</h1></div>
      <button type="button" className="primary" onClick={() => setEditing('new')}>+ Nova renda</button>
    </header>
    <LoadState loading={incomes.loading} error={incomes.error} onRetry={incomes.retry} />
    {!incomes.loading && !incomes.error && <>
      <p className="muted mb-6 max-w-2xl">As rendas entram no cálculo do saldo previsto: renda do mês menos o valor das faturas. Renda de {formatMonth(month)}: <strong className="text-[var(--text)]">{formatMoney(incomeInMonth(month, incomes.rows))}</strong>.</p>
      {sorted.length === 0
        ? <div className="panel"><EmptyState icon="↗" title="Nenhuma renda cadastrada" action={<button type="button" className="primary" onClick={() => setEditing('new')}>Cadastrar renda</button>}>
          Cadastre seu salário e outras entradas mensais para calcular o saldo previsto.
        </EmptyState></div>
        : <>
          <h2 className="mb-3">Histórico de rendas</h2>
          <ul className="installment-list">{sorted.map(income => {
            const situation = situationOf(income, month)
            return <li key={income.id} className="installment-row">
              <div className="installment-main">
                <span className="installment-title">{income.title}</span>
                <span className="installment-meta">{formatShortMonth(income.startMonth)} → {income.endMonth ? formatShortMonth(income.endMonth) : 'sem fim'}</span>
              </div>
              <div className="installment-side">
                <strong className="installment-amount">{formatMoney(income.amountCents)}<span className="muted text-xs font-normal">/mês</span></strong>
                <span className={`status-badge ${situation === 'active' ? 'is-done' : 'is-muted'}`}>{SITUATIONS[situation]}</span>
                <div className="row-actions">
                  <button type="button" className="secondary" onClick={() => setEditing(income)}>Editar</button>
                  <button type="button" className="secondary" onClick={() => setRemoving(income)}>Excluir</button>
                </div>
              </div>
            </li>
          })}</ul>
        </>}
    </>}
    {editing && <IncomeForm income={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {removing && <ConfirmDialog danger title="Excluir renda?" confirmLabel="Excluir de todos os meses" onClose={() => setRemoving(null)}
      onConfirm={() => deleteIncome(user!.uid, removing.id)}>
      <p>Deseja excluir <strong>{removing.title}</strong> ({formatMoney(removing.amountCents)}/mês)?</p>
      <p>Tudo o que esta renda gerou será removido, nos meses anteriores e nos próximos. O saldo previsto desses meses será recalculado.</p>
    </ConfirmDialog>}
  </main>
}
