import { Controller, useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { cardSchema, type Card } from '../domain/schemas'
import { createCard, updateCard } from '../data/store'
import { Modal } from '../components/Modal'
import { CreditCardVisual } from '../components/CreditCardVisual'
import { applyIssues, Field, FormActions, invalid, useSubmit } from './formKit'

type Values = { name: string; color: string; closingDay: string; dueDay: string }
const COLORS = ['#8a05be', '#ff7a00', '#e11d48', '#1d4ed8', '#0f766e', '#153f35', '#1f2937', '#b45309']

export function CardForm({ card, onClose }: { card?: Card; onClose: () => void }) {
  const { user } = useAuth()
  const { error, run } = useSubmit()
  const { register, control, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    defaultValues: card
      ? { name: card.name, color: card.color, closingDay: String(card.closingDay), dueDay: String(card.dueDay) }
      : { name: '', color: COLORS[0], closingDay: '', dueDay: '' },
  })
  const values = watch()
  const preview = { name: values.name.trim() || 'Nome do cartão', color: /^#[0-9a-f]{6}$/i.test(values.color) ? values.color : COLORS[0], closingDay: Number(values.closingDay) || 0, dueDay: Number(values.dueDay) || 0 }
  const submit = handleSubmit(form => run(async () => {
    const parsed = cardSchema.safeParse({ ...form, closingDay: Number(form.closingDay) || 0, dueDay: Number(form.dueDay) || 0 })
    if (!parsed.success) { applyIssues(parsed.error, setError); return }
    if (card) await updateCard(user!.uid, card.id, parsed.data)
    else await createCard(user!.uid, parsed.data)
    onClose()
  }))
  return <Modal title={card ? 'Editar cartão' : 'Novo cartão'} busy={isSubmitting} onClose={onClose}>
    <form noValidate onSubmit={submit}>
      <div className="form-preview"><CreditCardVisual card={preview} /></div>
      <fieldset disabled={isSubmitting}>
        <Field id="card-name" label="Nome do cartão" error={errors.name?.message}>
          <input id="card-name" autoFocus maxLength={120} autoComplete="off" placeholder="Ex.: Nubank" {...register('name')} {...invalid('card-name', errors.name?.message)} />
        </Field>
        <Field id="card-color" label="Cor" error={errors.color?.message}>
          <Controller control={control} name="color" render={({ field }) => <div className="color-choices">
            {COLORS.map(color => <button key={color} type="button" className="color-choice" style={{ background: color }} aria-label={`Cor ${color}`}
              aria-pressed={field.value.toLowerCase() === color} onClick={() => field.onChange(color)} />)}
            <input id="card-color" type="color" className="color-input" title="Outra cor" value={field.value} onChange={event => field.onChange(event.target.value)} />
          </div>} />
        </Field>
        <div className="form-grid">
          <Field id="card-closing" label="Dia de fechamento" error={errors.closingDay?.message}>
            <input id="card-closing" type="number" inputMode="numeric" min={1} max={31} {...register('closingDay')} {...invalid('card-closing', errors.closingDay?.message)} />
          </Field>
          <Field id="card-due" label="Dia de vencimento" error={errors.dueDay?.message}>
            <input id="card-due" type="number" inputMode="numeric" min={1} max={31} {...register('dueDay')} {...invalid('card-due', errors.dueDay?.message)} />
          </Field>
        </div>
        <p className="field-hint">Dias 29, 30 e 31 viram o último dia nos meses mais curtos.</p>
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <FormActions busy={isSubmitting} onCancel={onClose} submitLabel={card ? 'Salvar alterações' : 'Criar cartão'} />
    </form>
  </Modal>
}
