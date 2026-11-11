import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { Controller, useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { civilDateSchema, suggestFirstCompetence, todayCivil } from '../domain/calendar'
import { centsToInput, formatMoney, formatShortMonth } from '../domain/format'
import { installmentsOf, lastMonthOf } from '../domain/installments'
import { MAX_INSTALLMENTS, parseMoneyToCents } from '../domain/money'
import { purchaseSchema, type Card, type Purchase } from '../domain/schemas'
import { createPurchase, updatePurchase } from '../data/store'
import { Modal } from '../components/Modal'
import { MoneyInput } from '../components/MoneyInput'
import { MonthPicker } from '../components/MonthPicker'
import { applyIssues, Field, fieldClass, FormActions, invalid, readMoney, useSubmit } from './formKit'

type Values = { title: string; amount: string; installment: boolean; installmentCount: string; purchaseDate: string; firstDueMonth: string; description: string }

const suggestion = (card: Card, date: string) =>
  civilDateSchema.safeParse(date).success ? suggestFirstCompetence(date, card.closingDay, card.dueDay).competence : null

/** Compra no cartão: à vista (1 parcela) ou parcelada. O 1º mês de vencimento é sugerido pelo fechamento e pode ser trocado. */
export function PurchaseForm({ card, purchase, onClose }: { card: Card; purchase?: Purchase; onClose: () => void }) {
  const { user } = useAuth()
  const { error, run } = useSubmit()
  const today = todayCivil()
  const [dueTouched, setDueTouched] = useState(!!purchase)
  const { register, control, handleSubmit, watch, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<Values>({
    defaultValues: purchase
      ? { title: purchase.title, amount: centsToInput(purchase.totalCents), installment: purchase.installmentCount > 1, installmentCount: String(purchase.installmentCount),
        purchaseDate: purchase.purchaseDate, firstDueMonth: purchase.firstDueMonth, description: purchase.description }
      : { title: '', amount: '', installment: false, installmentCount: '2', purchaseDate: today, firstDueMonth: suggestion(card, today) ?? today.slice(0, 7), description: '' },
  })
  const values = watch()
  const count = values.installment ? Number(values.installmentCount) : 1
  const preview = (() => {
    try {
      const totalCents = parseMoneyToCents(values.amount)
      if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS || totalCents < count) return null
      const item = { totalCents, installmentCount: count, firstDueMonth: values.firstDueMonth }
      const parts = installmentsOf(item)
      const same = parts.every(part => part.amountCents === parts[0].amountCents)
      return count === 1
        ? `À vista: ${formatMoney(totalCents)} na fatura de ${formatShortMonth(values.firstDueMonth)}.`
        : `${count}x de ${formatMoney(parts[0].amountCents)}${same ? '' : ` (as demais de ${formatMoney(parts[count - 1].amountCents)})`}, de ${formatShortMonth(values.firstDueMonth)} a ${formatShortMonth(lastMonthOf(item))}.`
    } catch { return null }
  })()

  const submit = handleSubmit(form => run(async () => {
    const totalCents = readMoney(form.amount, 'amount', setError)
    if (totalCents === null) return
    const parsed = purchaseSchema.safeParse({
      cardId: card.id, title: form.title, totalCents, installmentCount: form.installment ? Number(form.installmentCount) : 1,
      purchaseDate: form.purchaseDate, firstDueMonth: form.firstDueMonth, description: form.description,
    })
    if (!parsed.success) { applyIssues(parsed.error, setError, { totalCents: 'amount' }); return }
    if (purchase) await updatePurchase(user!.uid, purchase.id, parsed.data)
    else await createPurchase(user!.uid, parsed.data)
    onClose()
  }))

  return <Modal title={purchase ? 'Editar lançamento' : `Novo lançamento — ${card.name}`} busy={isSubmitting} onClose={onClose}>
    <form noValidate onSubmit={submit}>
      <fieldset disabled={isSubmitting}>
        <Field id="purchase-title" label="Título da compra" error={errors.title?.message}>
          <Input id="purchase-title" className={fieldClass} autoFocus maxLength={120} autoComplete="off" placeholder="Ex.: Compra sofá" {...register('title')} {...invalid('purchase-title', errors.title?.message)} />
        </Field>
        <Field id="purchase-amount" label={values.installment ? 'Valor total da compra' : 'Valor'} error={errors.amount?.message}>
          <MoneyInput id="purchase-amount" {...register('amount')} {...invalid('purchase-amount', errors.amount?.message)} />
        </Field>
        <Controller control={control} name="installment" render={({ field }) => <div className="mt-4 flex items-center gap-2">
          <Checkbox id="purchase-installment" checked={field.value} onCheckedChange={checked => field.onChange(checked === true)} />
          <Label htmlFor="purchase-installment" className="font-normal">Compra parcelada</Label>
        </div>} />
        {values.installment && <Field id="purchase-count" label="Quantidade de parcelas" error={errors.installmentCount?.message}>
          <NativeSelect id="purchase-count" className="w-full" {...register('installmentCount')}>
            {Array.from({ length: MAX_INSTALLMENTS - 1 }, (_, index) => index + 2).map(value => <NativeSelectOption key={value} value={value}>{value}x</NativeSelectOption>)}
          </NativeSelect>
        </Field>}
        <div className="form-grid">
          <Field id="purchase-date" label="Data da compra" error={errors.purchaseDate?.message}>
            <Input id="purchase-date" className={fieldClass} type="date" {...register('purchaseDate', {
              onChange: event => { const next = suggestion(card, event.target.value); if (!dueTouched && next) setValue('firstDueMonth', next) },
            })} {...invalid('purchase-date', errors.purchaseDate?.message)} />
          </Field>
          <Field id="purchase-first" label="1º mês de vencimento" error={errors.firstDueMonth?.message}>
            <MonthPicker label="1º mês de vencimento" value={values.firstDueMonth} onChange={month => { setDueTouched(true); clearErrors('firstDueMonth'); setValue('firstDueMonth', month) }} />
          </Field>
        </div>
        {!dueTouched && <p className="field-hint">Sugerido pelo fechamento do cartão (dia {card.closingDay}). Ajuste se o banco usar outro mês.</p>}
        {preview && <p className="notice mt-4" aria-live="polite">{preview}</p>}
        <Field id="purchase-description" label="Descrição (opcional)" error={errors.description?.message}>
          <Textarea id="purchase-description" maxLength={1000} {...register('description')} />
        </Field>
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <FormActions busy={isSubmitting} onCancel={onClose} submitLabel={purchase ? 'Salvar alterações' : 'Lançar compra'} />
    </form>
  </Modal>
}
