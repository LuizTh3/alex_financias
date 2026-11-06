import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../contexts/AuthContext'
import { todayCivil, suggestFirstCompetence } from '../domain/calendar'
import { entryInputSchema, generateInstallments, invoiceId, type EntryInput } from '../domain/entries'
import { parseMoneyToCents, MAX_INSTALLMENTS } from '../domain/money'
import { formatMoney, formatMonth } from '../domain/finance'
import type { CardRecord, CategoryRecord } from '../repositories/catalogRepository'
import type { FinancialRecord } from '../repositories/financialSchemas'
import { newEntryId, newMutationId, saveEntry, financialErrorMessage } from '../repositories/entryRepository'
import { Modal } from './Modal'
const formSchema = z.object({
  type: z.enum(['expense', 'income']), description: z.string(), totalAmount: z.string(),
  categoryId: z.string(), purchaseDate: z.string(), paymentMethod: z.enum(['direct', 'card']), cardId: z.string(),
  installmentCount: z.number(), firstCompetence: z.string(), dueDay: z.number(),
}).transform((fields, context) => {
  let totalCents = 0
  try { totalCents = parseMoneyToCents(fields.totalAmount) }
  catch (error) { context.addIssue({ code: 'custom', path: ['totalAmount'], message: error instanceof Error ? error.message : 'Valor inválido.' }) }
  const { totalAmount: _, ...rest } = fields
  return { ...rest, totalCents, cardId: fields.paymentMethod === 'card' ? fields.cardId || null : null }
}).pipe(entryInputSchema)
type FormFields = z.input<typeof formSchema>
export function EntryForm({ record, cards, categories, invoices, initialMonth, onClose, onSaved }: {
  record?: FinancialRecord<'entries'>; cards: CardRecord[]; categories: CategoryRecord[]; invoices: FinancialRecord<'invoices'>[];
  initialMonth: string; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth()
  const [entryId] = useState(() => record?.id ?? newEntryId(user!.uid))
  const locked = useRef(false)
  const operation = useRef<{ signature: string; id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormFields, unknown, EntryInput>({
    resolver: zodResolver(formSchema),
    defaultValues: record ? {
      type: record.type, description: record.description, totalAmount: `${Math.floor(record.totalCents / 100)},${String(record.totalCents % 100).padStart(2, '0')}`,
      categoryId: record.categoryId, purchaseDate: record.purchaseDate, paymentMethod: record.paymentMethod, cardId: record.cardId ?? '',
      installmentCount: record.installmentCount, firstCompetence: record.firstCompetence, dueDay: record.dueDay,
    } : { type: 'expense', description: '', totalAmount: '', categoryId: '', purchaseDate: todayCivil(), paymentMethod: 'direct', cardId: '', installmentCount: 1, firstCompetence: initialMonth, dueDay: Number(todayCivil().slice(-2)) },
  })
  const fields = watch()
  const card = cards.find(item => item.id === fields.cardId)
  useEffect(() => {
    if (fields.type === 'income') { setValue('paymentMethod', 'direct'); setValue('cardId', '') }
  }, [fields.type, setValue])
  useEffect(() => {
    if (fields.paymentMethod === 'card' && card) setValue('dueDay', record?.cardId === card.id ? record.dueDay : card.dueDay)
  }, [fields.paymentMethod, card, record, setValue])
  let suggestion: ReturnType<typeof suggestFirstCompetence> | null = null
  try { if (fields.paymentMethod === 'card' && card) suggestion = suggestFirstCompetence(fields.purchaseDate, card.closingDay, card.dueDay) } catch { /* Data incompleta durante digitação. */ }
  const valid = formSchema.safeParse(fields)
  const preview = valid.success ? generateInstallments(entryId, valid.data).map(part => ({
    ...part, dueDate: part.cardId ? invoices.find(invoice => invoiceId(invoice.cardId, invoice.competence) === invoiceId(part.cardId!, part.competence))?.dueDate ?? part.dueDate : part.dueDate,
  })) : []
  const options = categories.filter(category => (category.active && (category.scope === 'both' || category.scope === fields.type))
    || (category.id === record?.categoryId && fields.type === record.type))
  const cardOptions = cards.filter(item => item.active || item.id === record?.cardId)
  useEffect(() => {
    if (fields.categoryId && !categories.some(category => category.id === fields.categoryId && (
      (category.active && (category.scope === 'both' || category.scope === fields.type))
      || (category.id === record?.categoryId && fields.type === record.type)
    ))) setValue('categoryId', '')
  }, [categories, fields.categoryId, fields.type, record, setValue])

  return <Modal title={record ? 'Editar lançamento' : 'Novo lançamento'} busy={isSubmitting} onClose={onClose}>
    <form noValidate onSubmit={handleSubmit(async input => {
      if (locked.current) return
      locked.current = true; setError(null)
      const signature = JSON.stringify(input)
      if (operation.current?.signature !== signature) operation.current = { signature, id: newMutationId() }
      try {
        await saveEntry(user!.uid, { entryId, mutationId: operation.current!.id, expectedRevision: record?.revision ?? 0, input })
        onSaved()
      } catch (failure) { setError(financialErrorMessage(failure)) }
      finally { locked.current = false }
    })}>
      <fieldset disabled={isSubmitting}>
        <div className="form-grid"><div><label htmlFor="entry-type">Tipo</label><select id="entry-type" {...register('type')}><option value="expense">Despesa</option><option value="income">Recebimento</option></select></div>
          <div><label htmlFor="entry-method">Forma de pagamento</label><select id="entry-method" {...register('paymentMethod')}><option value="direct">Direto</option>{fields.type === 'expense' && <option value="card">Cartão</option>}</select></div></div>
        <label htmlFor="entry-description">Descrição</label><input id="entry-description" autoFocus maxLength={240} {...register('description')} aria-invalid={!!errors.description} />
        <label htmlFor="entry-category">Categoria</label><select id="entry-category" {...register('categoryId')}><option value="">Selecione…</option>{options.map(category => <option key={category.id} value={category.id}>{category.name}{!category.active ? ' (arquivada)' : ''}</option>)}</select>
        {fields.paymentMethod === 'card' && <><label htmlFor="entry-card">Cartão</label><select id="entry-card" {...register('cardId')}><option value="">Selecione…</option>{cardOptions.map(item => <option key={item.id} value={item.id}>{item.name}{!item.active ? ' (arquivado)' : ''}</option>)}</select></>}
        <div className="form-grid"><div><label htmlFor="entry-total">Valor TOTAL (R$)</label><input id="entry-total" inputMode="decimal" placeholder="100,00" {...register('totalAmount')} aria-invalid={!!errors.totalAmount} /></div>
          <div><label htmlFor="entry-count">Quantidade de parcelas</label><input id="entry-count" type="number" min={1} max={MAX_INSTALLMENTS} step={1} {...register('installmentCount', { valueAsNumber: true })} /><p className="muted text-sm mt-2">Até {MAX_INSTALLMENTS} parcelas.</p></div></div>
        <label htmlFor="entry-date">{fields.type === 'expense' ? 'Data da compra' : 'Data do lançamento'}</label><input id="entry-date" type="date" min="1900-01-01" max="9999-12-31" {...register('purchaseDate')} />
        {suggestion && <div className="notice mt-4"><p>Sugestão da primeira competência: <strong>{formatMonth(suggestion.competence)}</strong>.</p>
          {suggestion.ambiguousClosingDate && <p>Compra na data de fechamento: confira a competência com seu banco.</p>}
          <button type="button" className="secondary mt-2" onClick={() => setValue('firstCompetence', suggestion!.competence, { shouldDirty: true, shouldValidate: true })}>Usar sugestão</button></div>}
        <div className="form-grid"><div><label htmlFor="entry-competence">Primeiro mês de vencimento</label><input id="entry-competence" type="month" min="1900-01" max="9999-12" {...register('firstCompetence')} /><p className="muted text-sm mt-2">Confira e ajuste antes de salvar.</p></div>
          <div><label htmlFor="entry-day">Dia do vencimento</label><input id="entry-day" type="number" min={1} max={31} readOnly={fields.paymentMethod === 'card'} {...register('dueDay', { valueAsNumber: true })} /></div></div>
        <p className="muted text-sm mt-4">{fields.paymentMethod === 'card' ? 'Uma parcela no cartão é uma cobrança na fatura. A fatura continua aguardando pagamento.' : 'As parcelas serão registradas como pendentes.'}</p>
        {preview.length > 0 && <section className="installment-preview mt-5" aria-label="Prévia das parcelas"><h3>Confira antes de salvar</h3>
          <table><caption className="sr-only">Parcelas, vencimentos e valores</caption><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead><tbody>{preview.map(part => <tr key={part.id}><td>{part.index}/{part.count}</td><td>{part.dueDate.split('-').reverse().join('/')}</td><td>{formatMoney(part.amountCents)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Total</th><td>{formatMoney(preview.reduce((sum, part) => sum + part.amountCents, 0))}</td></tr></tfoot></table></section>}
        {record && <p className="notice mt-4">Esta edição substituirá todas as {record.installmentCount} parcelas do lançamento pela prévia acima. Parcelas removidas deixarão de ser cobradas. Pagamentos afetados precisam ser desfeitos antes.</p>}
      </fieldset>
      {Object.keys(errors).length > 0 && <div role="alert" className="error">{Object.entries(errors).map(([key, value]) => <p key={key}>{value?.message?.toString() ?? 'Confira os campos informados.'}</p>)}</div>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary" disabled={isSubmitting} onClick={onClose}>Cancelar</button><button className="primary" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar lançamento'}</button></div>
    </form>
  </Modal>
}
