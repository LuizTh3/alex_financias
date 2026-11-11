import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import { useCollection } from '../hooks/useCollection'
import { useMonthParam } from '../hooks/useUrlState'
import { receivableRows, receivableTotals, type ReceivableRow } from '../domain/summary'
import { formatDate, formatMoney, formatMonth } from '../domain/format'
import { lastMonthOf } from '../domain/installments'
import type { Receivable } from '../domain/schemas'
import { deleteReceivable, setInstallmentReceived } from '../data/store'
import { MonthPicker } from '../components/MonthPicker'
import { InstallmentRow } from '../components/InstallmentRow'
import { StatusBadge } from '../components/StatusBadge'
import { DetailsModal } from '../components/DetailsModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, LoadState } from '../components/EmptyState'
import { ReceivableForm } from '../forms/ReceivableForm'

export function ReceivablesPage() {
  const { user } = useAuth()
  const receivables = useCollection('receivables')
  const [month, setMonth] = useMonthParam()
  const [editing, setEditing] = useState<Receivable | 'new' | null>(null)
  const [details, setDetails] = useState<ReceivableRow | null>(null)
  const [removing, setRemoving] = useState<Receivable | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState('')
  const rows = receivableRows(month, receivables.rows)
  const totals = receivableTotals(month, receivables.rows)

  async function toggle(row: ReceivableRow) {
    const key = `${row.receivable.id}-${row.installment.index}`
    setToggling(key); setToggleError('')
    try { await setInstallmentReceived(user!.uid, row.receivable.id, row.installment.index, !row.received) }
    catch { setToggleError('Não foi possível atualizar o recebimento. Tente novamente.') }
    finally { setToggling(null) }
  }

  return <main className="workspace">
    <header>
      <div><p className="eyebrow">DE TERCEIROS</p><h1>A receber</h1></div>
      <div className="header-actions"><MonthPicker value={month} onChange={setMonth} />
        <Button onClick={() => setEditing('new')}>+ Novo a receber</Button></div>
    </header>
    <p className="notice mb-6">Os valores a receber são só para acompanhamento: não entram na renda nem no saldo previsto.</p>
    <LoadState loading={receivables.loading} error={receivables.error} onRetry={receivables.retry} />
    {!receivables.loading && !receivables.error && <>
      <section className="stats" aria-label={`A receber em ${formatMonth(month)}`}>
        <Card className="gap-0 p-6"><p>Total do mês</p><strong>{formatMoney(totals.totalCents)}</strong><span>{rows.length} {rows.length === 1 ? 'parcela' : 'parcelas'}</span></Card>
        <Card className="gap-0 p-6"><p>Recebido</p><strong>{formatMoney(totals.receivedCents)}</strong><span>Marcado como recebido</span></Card>
        <Card className="highlight gap-0 bg-(--highlight) p-6 text-[#f7f9f1]"><p>Falta receber</p><strong>{formatMoney(totals.pendingCents)}</strong><span>Em {formatMonth(month)}</span></Card>
      </section>
      {toggleError && <p className="error mb-4" role="alert">{toggleError}</p>}
      <h2 className="mb-3">Histórico de {formatMonth(month)}</h2>
      {rows.length === 0
        ? <Card className="p-0"><EmptyState icon="↙" title="Nada a receber neste mês" action={<Button onClick={() => setEditing('new')}>Novo a receber</Button>}>
          {receivables.rows.length ? 'Use o seletor de mês para ver os outros meses.' : 'Cadastre os valores que outras pessoas devem a você.'}
        </EmptyState></Card>
        : <ul className="installment-list">{rows.map(row => {
          const key = `${row.receivable.id}-${row.installment.index}`
          return <InstallmentRow key={key} title={row.receivable.title} installment={row.installment} onOpen={() => setDetails(row)}
            status={<StatusBadge kind="receivable" done={row.received} />}
            actions={<>
              <Button variant="outline" disabled={toggling === key} onClick={() => void toggle(row)}>{row.received ? 'Desmarcar' : 'Recebido'}</Button>
              <Button variant="outline" onClick={() => setEditing(row.receivable)}>Editar</Button>
              <Button variant="outline" onClick={() => setRemoving(row.receivable)}>Excluir</Button>
            </>} />
        })}</ul>}
    </>}
    {editing && <ReceivableForm receivable={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {details && <DetailsModal title={details.receivable.title} description={details.receivable.description} onClose={() => setDetails(null)}
      rows={[
        ['Valor total', formatMoney(details.receivable.totalCents)],
        ['Parcela deste mês', details.installment.count === 1 ? `Única — ${formatMoney(details.installment.amountCents)}` : `${details.installment.index}/${details.installment.count} — ${formatMoney(details.installment.amountCents)}`],
        ['Data do lançamento', formatDate(details.receivable.launchDate)],
        ['Recebimentos', details.installment.count === 1 ? formatMonth(details.receivable.firstDueMonth) : `${formatMonth(details.receivable.firstDueMonth)} a ${formatMonth(lastMonthOf(details.receivable))}`],
        ['Parcelas recebidas', `${details.receivable.receivedIndexes.length} de ${details.receivable.installmentCount}`],
      ]}
      actions={<Button variant="outline" onClick={() => { setEditing(details.receivable); setDetails(null) }}>Editar</Button>} />}
    {removing && <ConfirmDialog danger title="Excluir a receber?" confirmLabel={removing.installmentCount > 1 ? `Excluir as ${removing.installmentCount} parcelas` : 'Excluir'}
      onClose={() => setRemoving(null)} onConfirm={() => deleteReceivable(user!.uid, removing.id)}>
      <p>Deseja excluir <strong>{removing.title}</strong> ({formatMoney(removing.totalCents)}{removing.installmentCount > 1 ? ` em ${removing.installmentCount}x` : ''})?</p>
      {removing.installmentCount > 1 && <p>Todas as parcelas geradas por este lançamento serão excluídas, nos meses anteriores e nos próximos.</p>}
    </ConfirmDialog>}
  </main>
}
