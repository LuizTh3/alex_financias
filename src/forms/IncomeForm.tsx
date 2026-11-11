import { Controller, useForm } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../contexts/AuthContext'
import { centsToInput, currentMonth } from '../domain/format'
import { shiftCompetence } from '../domain/calendar'
import { incomeSchema, type Income } from '../domain/schemas'
import { createIncome, updateIncome } from '../data/store'
import { Modal } from '../components/Modal'
import { MoneyInput } from '../components/MoneyInput'
import { MonthPicker } from '../components/MonthPicker'
import { applyIssues, Field, fieldClass, FormActions, invalid, readMoney, useSubmit } from './formKit'

type Values = { title: string; amount: string; startMonth: string; hasEnd: boolean; endMonth: string }

/** Renda mensal recorrente. Editar altera todos os meses; para mudar o valor a partir de um mês, encerre e crie outra. */
export function IncomeForm({ income, onClose }: { income?: Income; onClose: () => void }) {
  const { user } = useAuth()
  const { error, run } = useSubmit()
  const start = income?.startMonth ?? currentMonth()
  const { register, control, handleSubmit, watch, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<Values>({
    defaultValues: {
      title: income?.title ?? '', amount: income ? centsToInput(income.amountCents) : '', startMonth: start,
      hasEnd: !!income?.endMonth, endMonth: income?.endMonth ?? shiftCompetence(start, 11),
    },
  })
  const values = watch()
  const submit = handleSubmit(form => run(async () => {
    const amountCents = readMoney(form.amount, 'amount', setError)
    if (amountCents === null) return
    const parsed = incomeSchema.safeParse({ title: form.title, amountCents, startMonth: form.startMonth, endMonth: form.hasEnd ? form.endMonth : null })
    if (!parsed.success) { applyIssues(parsed.error, setError, { amountCents: 'amount' }); return }
    if (income) await updateIncome(user!.uid, income.id, parsed.data)
    else await createIncome(user!.uid, parsed.data)
    onClose()
  }))
  return <Modal title={income ? 'Editar renda' : 'Nova renda'} busy={isSubmitting} onClose={onClose}>
    <form noValidate onSubmit={submit}>
      <fieldset disabled={isSubmitting}>
        <Field id="income-title" label="Título" error={errors.title?.message}>
          <Input id="income-title" className={fieldClass} autoFocus maxLength={120} autoComplete="off" placeholder="Ex.: Salário" {...register('title')} {...invalid('income-title', errors.title?.message)} />
        </Field>
        <Field id="income-amount" label="Valor mensal" error={errors.amount?.message}>
          <MoneyInput id="income-amount" {...register('amount')} {...invalid('income-amount', errors.amount?.message)} />
        </Field>
        <Field id="income-start" label="Início da vigência" error={errors.startMonth?.message}>
          <MonthPicker label="Início da vigência" value={values.startMonth} onChange={month => { clearErrors(); setValue('startMonth', month) }} />
        </Field>
        <Controller control={control} name="hasEnd" render={({ field }) => <div className="mt-5 flex items-center gap-2">
          <Checkbox id="income-has-end" checked={field.value} onCheckedChange={checked => field.onChange(checked === true)} />
          <Label htmlFor="income-has-end" className="font-normal">Esta renda tem data para terminar</Label>
        </div>} />
        {values.hasEnd
          ? <Field id="income-end" label="Último mês" error={errors.endMonth?.message}>
            <MonthPicker label="Último mês" value={values.endMonth} onChange={month => { clearErrors('endMonth'); setValue('endMonth', month) }} />
          </Field>
          : <p className="field-hint">Sem fim: entra em todos os meses a partir do início.</p>}
        {income && <p className="notice mt-4">A alteração vale para todos os meses desta renda. Se o valor mudou a partir de um mês (ex.: aumento), marque o fim desta renda e cadastre uma nova.</p>}
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <FormActions busy={isSubmitting} onCancel={onClose} submitLabel={income ? 'Salvar alterações' : 'Criar renda'} />
    </form>
  </Modal>
}
