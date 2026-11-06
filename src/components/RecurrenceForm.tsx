import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../contexts/AuthContext'
import { currentMonth } from '../domain/finance'
import { competenceSchema } from '../domain/calendar'
import { recurrenceInputSchema, type RecurrenceInput } from '../domain/recurrences'
import { parseMoneyToCents } from '../domain/money'
import { newMutationId } from '../repositories/entryRepository'
import { newRecurrenceId, saveRecurrence, recurrenceErrorMessage } from '../repositories/recurrenceRepository'
import type { FinancialRecord } from '../repositories/financialSchemas'
import type { CardRecord, CategoryRecord } from '../repositories/catalogRepository'
import { Modal } from './Modal'
const schema = z.object({ type: z.enum(['expense', 'income']), description: z.string(), amount: z.string(), categoryId: z.string(), paymentMethod: z.enum(['direct', 'card']), cardId: z.string(), dueDay: z.number(), effectiveFrom: competenceSchema }).transform((fields, context) => {
  let amountCents = 0
  try { amountCents = parseMoneyToCents(fields.amount) } catch (error) { context.addIssue({ code: 'custom', path: ['amount'], message: error instanceof Error ? error.message : 'Valor inválido.' }) }
  const { amount: _, effectiveFrom, ...rest } = fields
  const input = recurrenceInputSchema.safeParse({ ...rest, amountCents, cardId: fields.paymentMethod === 'card' ? fields.cardId || null : null })
  if (!input.success) { for (const issue of input.error.issues) context.addIssue({ code: 'custom', path: issue.path, message: issue.message }); return z.NEVER }
  return { input: input.data, effectiveFrom }
})
export function RecurrenceForm({ root, previous, categories, cards, initialMonth, onClose }: { root?: FinancialRecord<'recurrences'>; previous?: FinancialRecord<'recurrenceVersions'>; categories: CategoryRecord[]; cards: CardRecord[]; initialMonth: string; onClose: () => void }) {
  const { user } = useAuth()
  const [id] = useState(() => root?.id ?? newRecurrenceId(user!.uid))
  const operation = useRef<{ signature: string; mutationId: string } | null>(null)
  const locked = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const minimum = root ? [currentMonth(), root.latestFrom].sort().at(-1)! : '1900-01'
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, unknown, { input: RecurrenceInput; effectiveFrom: string }>({
    resolver: zodResolver(schema), defaultValues: previous ? { type: previous.type ?? 'expense', description: previous.description, amount: `${Math.floor(previous.amountCents / 100)},${String(previous.amountCents % 100).padStart(2, '0')}`, categoryId: previous.categoryId, paymentMethod: previous.paymentMethod, cardId: previous.cardId ?? '', dueDay: previous.dueDay, effectiveFrom: minimum }
      : { type: 'expense', description: '', amount: '', categoryId: '', paymentMethod: 'direct', cardId: '', dueDay: 10, effectiveFrom: initialMonth },
  })
  const kind = watch('type')
  const selectedCard = watch('cardId'); const method = watch('paymentMethod')
  useEffect(() => {
    const card = cards.find(item => item.id === selectedCard)
    if (method === 'card' && card) setValue('dueDay', card.dueDay)
  }, [selectedCard, method, cards, previous, setValue])
  return <Modal title={root ? 'Nova versão da recorrência' : 'Nova recorrência mensal'} busy={isSubmitting} onClose={onClose}>
    <form noValidate onSubmit={handleSubmit(async values => {
      if (locked.current) return
      locked.current = true; setError(null)
      const signature = JSON.stringify(values)
      if (operation.current?.signature !== signature) operation.current = { signature, mutationId: newMutationId() }
      try { await saveRecurrence(user!.uid, { id, mutationId: operation.current!.mutationId, expectedRevision: root?.revision ?? 0, effectiveFrom: values.effectiveFrom, action: 'configure', input: values.input }); onClose() }
      catch (failure) { setError(recurrenceErrorMessage(failure)) }
      finally { locked.current = false }
    })}>
      <fieldset disabled={isSubmitting}>
        <label htmlFor="rec-type">Tipo</label><select id="rec-type" disabled={!!root} {...register('type')} onChange={event => { setValue('type', event.target.value as 'income' | 'expense'); setValue('categoryId', ''); setValue('paymentMethod', 'direct'); setValue('cardId', '') }}><option value="expense">Despesa mensal</option><option value="income">Renda mensal líquida</option></select>
        <label htmlFor="rec-description">Descrição</label><input id="rec-description" autoFocus maxLength={240} {...register('description')} />
        <div className="form-grid"><div><label htmlFor="rec-amount">Valor mensal (R$)</label><input id="rec-amount" inputMode="decimal" {...register('amount')} /></div><div><label htmlFor="rec-from">Início da vigência</label><input id="rec-from" type="month" min={minimum} max="9999-12" {...register('effectiveFrom')} /></div></div>
        <label htmlFor="rec-category">Categoria</label><select id="rec-category" {...register('categoryId')}><option value="">Selecione…</option>{categories.filter(category => category.id === previous?.categoryId || category.active && [kind, 'both'].includes(category.scope)).map(category => <option key={category.id} value={category.id}>{category.name}{category.active ? '' : ' (arquivada)'}</option>)}</select>
        <label htmlFor="rec-method">Forma de pagamento</label><select id="rec-method" {...register('paymentMethod')}><option value="direct">Pagamento direto</option>{kind === 'expense' && <option value="card">Cobrança em cartão</option>}</select>
        {method === 'card' && <><label htmlFor="rec-card">Cartão</label><select id="rec-card" {...register('cardId')}><option value="">Selecione…</option>{cards.filter(card => card.active || card.id === previous?.cardId).map(card => <option key={card.id} value={card.id}>{card.name}{card.active ? '' : ' (arquivado)'}</option>)}</select><p className="muted text-sm mt-3">As novas faturas usam o vencimento padrão atual do cartão. Faturas existentes preservam seu vencimento.</p></>}
        <label htmlFor="rec-day">Dia padrão de vencimento</label><input id="rec-day" type="number" min={1} max={31} readOnly={method === 'card'} {...register('dueDay', { valueAsNumber: true })} />
        <p className="notice mt-5">Recorrência mensal. Dias 29, 30 e 31 ajustam ao último dia válido. Ocorrências já geradas, inclusive pendentes e personalizadas, serão preservadas. Esta versão afeta apenas competências ainda não geradas.</p>
      </fieldset>
      {!!Object.keys(errors).length && <div className="error" role="alert">{Object.entries(errors).map(([key, value]) => <p key={key}>{value?.message?.toString() ?? 'Confira os campos informados.'}</p>)}</div>}{error && <p className="error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="secondary" type="button" disabled={isSubmitting} onClick={onClose}>Cancelar</button><button className="primary" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar versão'}</button></div>
    </form>
  </Modal>
}
