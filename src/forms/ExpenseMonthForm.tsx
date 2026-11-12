import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { useAuth } from '../contexts/AuthContext'
import { centsToInput, formatMoney, formatMonth } from '../domain/format'
import { parseMoneyToCents } from '../domain/money'
import type { Expense } from '../domain/schemas'
import { setExpenseMonthAmount } from '../data/store'
import { Modal } from '../components/Modal'
import { MoneyInput } from '../components/MoneyInput'
import { Field, FormActions, invalid, useSubmit } from './formKit'

/** Troca o valor da despesa só em um mês, sem alterar os meses anteriores nem os seguintes. */
export function ExpenseMonthForm({ expense, month, onClose }: { expense: Expense; month: string; onClose: () => void }) {
  const { user } = useAuth()
  const { error, run } = useSubmit()
  const [resetting, setResetting] = useState(false)
  const current = expense.overrides[month]
  const changed = current !== undefined
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<{ amount: string }>({
    defaultValues: { amount: centsToInput(current ?? expense.amountCents) },
  })
  const busy = isSubmitting || resetting
  const submit = handleSubmit(form => run(async () => {
    let amountCents: number
    const zero = /^(R\$\s*)?0*(,0*)?$/.test(form.amount.trim())
    try { amountCents = zero ? 0 : parseMoneyToCents(form.amount) } catch (failure) { setError('amount', { message: (failure as Error).message }); return }
    await setExpenseMonthAmount(user!.uid, expense.id, month, amountCents === expense.amountCents ? null : amountCents)
    onClose()
  }))
  const reset = () => { setResetting(true); void run(async () => { await setExpenseMonthAmount(user!.uid, expense.id, month, null); onClose() }).finally(() => setResetting(false)) }

  return <Modal title={`Valor de ${formatMonth(month)}`} busy={busy} onClose={onClose}>
    <form noValidate onSubmit={submit}>
      <p className="muted text-sm"><strong className="text-[var(--text)]">{expense.title}</strong> · valor padrão {formatMoney(expense.amountCents)}/mês</p>
      <fieldset disabled={busy}>
        <Field id="expense-month-amount" label={`Valor só em ${formatMonth(month)}`} error={errors.amount?.message}
          hint="Os outros meses continuam com o valor padrão. Deixe 0,00 se não houver cobrança neste mês.">
          <MoneyInput id="expense-month-amount" autoFocus {...register('amount')} {...invalid('expense-month-amount', errors.amount?.message)} />
        </Field>
      </fieldset>
      {changed && <Button type="button" variant="link" size="sm" className="mt-2 px-0" disabled={busy} onClick={reset}>Voltar ao valor padrão ({formatMoney(expense.amountCents)})</Button>}
      {error && <p role="alert" className="error">{error}</p>}
      <FormActions busy={busy} onCancel={onClose} submitLabel="Salvar valor do mês" />
    </form>
  </Modal>
}
