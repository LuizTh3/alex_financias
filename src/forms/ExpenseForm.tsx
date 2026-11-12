import { Controller, useForm } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../contexts/AuthContext'
import { centsToInput } from '../domain/format'
import { shiftCompetence } from '../domain/calendar'
import { expenseSchema, type Expense } from '../domain/schemas'
import { createExpense, updateExpense } from '../data/store'
import { Modal } from '../components/Modal'
import { MoneyInput } from '../components/MoneyInput'
import { MonthPicker } from '../components/MonthPicker'
import { applyIssues, Field, fieldClass, FormActions, invalid, readMoney, useSubmit } from './formKit'

type Values = { title: string; category: string; amount: string; startMonth: string; hasEnd: boolean; endMonth: string }

/**
 * Despesa mensal recorrente, com ou sem fim. Editar muda o valor padrão de todos os meses, mas
 * preserva os meses que tiveram o valor trocado individualmente.
 */
export function ExpenseForm({ expense, categories, initialMonth, onClose }: {
  expense?: Expense; categories: string[]; initialMonth: string; onClose: () => void
}) {
  const { user } = useAuth()
  const { error, run } = useSubmit()
  const start = expense?.startMonth ?? initialMonth
  const { register, control, handleSubmit, watch, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<Values>({
    defaultValues: {
      title: expense?.title ?? '', category: expense?.category ?? '', amount: expense ? centsToInput(expense.amountCents) : '', startMonth: start,
      hasEnd: !!expense?.endMonth, endMonth: expense?.endMonth ?? shiftCompetence(start, 11),
    },
  })
  const values = watch()
  const changedMonths = expense ? Object.keys(expense.overrides).length : 0
  const submit = handleSubmit(form => run(async () => {
    const amountCents = readMoney(form.amount, 'amount', setError)
    if (amountCents === null) return
    const parsed = expenseSchema.safeParse({
      title: form.title, category: form.category, amountCents, startMonth: form.startMonth, endMonth: form.hasEnd ? form.endMonth : null,
      overrides: expense?.overrides ?? {},
    })
    if (!parsed.success) { applyIssues(parsed.error, setError, { amountCents: 'amount' }); return }
    if (expense) await updateExpense(user!.uid, expense.id, parsed.data)
    else await createExpense(user!.uid, parsed.data)
    onClose()
  }))
  return <Modal title={expense ? 'Editar despesa' : 'Nova despesa mensal'} busy={isSubmitting} onClose={onClose}>
    <form noValidate onSubmit={submit}>
      <fieldset disabled={isSubmitting}>
        <Field id="expense-title" label="Título" error={errors.title?.message}>
          <Input id="expense-title" className={fieldClass} autoFocus maxLength={120} autoComplete="off" placeholder="Ex.: Aluguel" {...register('title')} {...invalid('expense-title', errors.title?.message)} />
        </Field>
        <Field id="expense-category" label="Categoria" error={errors.category?.message} hint="Escolha uma já usada ou digite uma nova.">
          <Input id="expense-category" className={fieldClass} maxLength={40} autoComplete="off" placeholder="Ex.: Moradia" list="expense-categories"
            {...register('category')} {...invalid('expense-category', errors.category?.message)} />
          <datalist id="expense-categories">{categories.map(category => <option key={category} value={category} />)}</datalist>
        </Field>
        <Field id="expense-amount" label="Valor mensal" error={errors.amount?.message}>
          <MoneyInput id="expense-amount" {...register('amount')} {...invalid('expense-amount', errors.amount?.message)} />
        </Field>
        <Field id="expense-start" label="Primeiro mês" error={errors.startMonth?.message}>
          <MonthPicker label="Primeiro mês" value={values.startMonth} onChange={month => { clearErrors(); setValue('startMonth', month) }} />
        </Field>
        <Controller control={control} name="hasEnd" render={({ field }) => <div className="mt-5 flex items-center gap-2">
          <Checkbox id="expense-has-end" checked={field.value} onCheckedChange={checked => field.onChange(checked === true)} />
          <Label htmlFor="expense-has-end" className="font-normal">Esta despesa tem data para terminar</Label>
        </div>} />
        {values.hasEnd
          ? <Field id="expense-end" label="Último mês" error={errors.endMonth?.message}>
            <MonthPicker label="Último mês" value={values.endMonth} onChange={month => { clearErrors('endMonth'); setValue('endMonth', month) }} />
          </Field>
          : <p className="field-hint">Sem fim: entra em todos os meses a partir do primeiro.</p>}
        {expense && <p className="notice mt-4">O novo valor vale para todos os meses desta despesa.
          {changedMonths > 0 && <> {changedMonths === 1 ? 'O mês que teve o valor trocado continua' : `Os ${changedMonths} meses que tiveram o valor trocado continuam`} com o valor próprio.</>}
          {' '}Para mudar só um mês, use “Valor deste mês” na lista.</p>}
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <FormActions busy={isSubmitting} onCancel={onClose} submitLabel={expense ? 'Salvar alterações' : 'Criar despesa'} />
    </form>
  </Modal>
}
