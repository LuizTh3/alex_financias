import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '../contexts/AuthContext'
import { shiftCompetence, todayCivil } from '../domain/calendar'
import { centsToInput, formatMoney, formatShortMonth } from '../domain/format'
import { installmentsOf, lastMonthOf } from '../domain/installments'
import { MAX_INSTALLMENTS, parseMoneyToCents } from '../domain/money'
import { receivableSchema, type Receivable } from '../domain/schemas'
import { createReceivable, updateReceivable } from '../data/store'
import { Modal } from '../components/Modal'
import { MoneyInput } from '../components/MoneyInput'
import { MonthPicker } from '../components/MonthPicker'
import { applyIssues, Field, fieldClass, FormActions, invalid, readMoney, useSubmit } from './formKit'

type Values = { title: string; amount: string; installmentCount: string; launchDate: string; firstDueMonth: string; description: string }

/** Valor que um terceiro deve. Fica isolado: não entra no saldo previsto. */
export function ReceivableForm({ receivable, onClose }: { receivable?: Receivable; onClose: () => void }) {
  const { user } = useAuth()
  const { error, run } = useSubmit()
  const today = todayCivil()
  const { register, handleSubmit, watch, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<Values>({
    defaultValues: receivable
      ? { title: receivable.title, amount: centsToInput(receivable.totalCents), installmentCount: String(receivable.installmentCount),
        launchDate: receivable.launchDate, firstDueMonth: receivable.firstDueMonth, description: receivable.description }
      : { title: '', amount: '', installmentCount: '1', launchDate: today, firstDueMonth: shiftCompetence(today.slice(0, 7), 1), description: '' },
  })
  const values = watch()
  const count = Number(values.installmentCount)
  const preview = (() => {
    try {
      const totalCents = parseMoneyToCents(values.amount)
      if (totalCents < count) return null
      const item = { totalCents, installmentCount: count, firstDueMonth: values.firstDueMonth }
      const first = installmentsOf(item)[0].amountCents
      return count === 1 ? `Recebimento único de ${formatMoney(totalCents)} em ${formatShortMonth(values.firstDueMonth)}.`
        : `${count}x de ${formatMoney(first)}, de ${formatShortMonth(values.firstDueMonth)} a ${formatShortMonth(lastMonthOf(item))}.`
    } catch { return null }
  })()
  const dropped = receivable ? receivable.receivedIndexes.filter(index => index > count).length : 0

  const submit = handleSubmit(form => run(async () => {
    const totalCents = readMoney(form.amount, 'amount', setError)
    if (totalCents === null) return
    const parsed = receivableSchema.safeParse({
      title: form.title, totalCents, installmentCount: Number(form.installmentCount), launchDate: form.launchDate,
      firstDueMonth: form.firstDueMonth, description: form.description,
      receivedIndexes: (receivable?.receivedIndexes ?? []).filter(index => index <= Number(form.installmentCount)),
    })
    if (!parsed.success) { applyIssues(parsed.error, setError, { totalCents: 'amount' }); return }
    if (receivable) await updateReceivable(user!.uid, receivable.id, parsed.data)
    else await createReceivable(user!.uid, parsed.data)
    onClose()
  }))

  return <Modal title={receivable ? 'Editar a receber' : 'Novo a receber'} busy={isSubmitting} onClose={onClose}>
    <form noValidate onSubmit={submit}>
      <fieldset disabled={isSubmitting}>
        <Field id="receivable-title" label="Título" error={errors.title?.message}>
          <Input id="receivable-title" className={fieldClass} autoFocus maxLength={120} autoComplete="off" placeholder="Ex.: nome de quem vai pagar" {...register('title')} {...invalid('receivable-title', errors.title?.message)} />
        </Field>
        <div className="form-grid">
          <Field id="receivable-amount" label="Valor total" error={errors.amount?.message}>
            <MoneyInput id="receivable-amount" {...register('amount')} {...invalid('receivable-amount', errors.amount?.message)} />
          </Field>
          <Field id="receivable-count" label="Parcelas" error={errors.installmentCount?.message}>
            <NativeSelect id="receivable-count" className="w-full" {...register('installmentCount')}>
              {Array.from({ length: MAX_INSTALLMENTS }, (_, index) => index + 1).map(value => <NativeSelectOption key={value} value={value}>{value === 1 ? 'Única' : `${value}x`}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
        </div>
        <div className="form-grid">
          <Field id="receivable-date" label="Data do lançamento" error={errors.launchDate?.message}>
            <Input id="receivable-date" className={fieldClass} type="date" {...register('launchDate')} {...invalid('receivable-date', errors.launchDate?.message)} />
          </Field>
          <Field id="receivable-first" label="1º mês de recebimento" error={errors.firstDueMonth?.message}>
            <MonthPicker label="1º mês de recebimento" value={values.firstDueMonth} onChange={month => { clearErrors('firstDueMonth'); setValue('firstDueMonth', month) }} />
          </Field>
        </div>
        {preview && <p className="notice mt-4" aria-live="polite">{preview}</p>}
        {dropped > 0 && <p className="notice mt-2">{dropped} {dropped === 1 ? 'parcela marcada como recebida deixa' : 'parcelas marcadas como recebidas deixam'} de existir com a nova quantidade.</p>}
        <Field id="receivable-description" label="Descrição (opcional)" error={errors.description?.message}>
          <Textarea id="receivable-description" maxLength={1000} {...register('description')} />
        </Field>
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <FormActions busy={isSubmitting} onCancel={onClose} submitLabel={receivable ? 'Salvar alterações' : 'Criar a receber'} />
    </form>
  </Modal>
}
