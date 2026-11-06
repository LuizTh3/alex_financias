import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../contexts/AuthContext'
import { cardSchema, categorySchema, scopeLabels, type CardInput, type CategoryInput } from '../domain/catalog'
import { catalogErrorMessage, newCatalogId, saveCatalog, type CardRecord, type CategoryRecord } from '../repositories/catalogRepository'
import { Modal } from './Modal'

export function CardForm({ record, onClose, onSaved }: { record?: CardRecord; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const [id] = useState(() => record?.id ?? newCatalogId(user!.uid, 'cards'))
  const locked = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CardInput>({
    resolver: zodResolver(cardSchema),
    defaultValues: record ? { name: record.name, color: record.color, closingDay: record.closingDay, dueDay: record.dueDay }
      : { name: '', color: '#153f35', closingDay: 5, dueDay: 12 },
  })
  return <Modal title={record ? 'Editar cartão' : 'Novo cartão'} busy={isSubmitting} onClose={onClose}>
    <form noValidate onSubmit={handleSubmit(async values => {
      if (locked.current) return
      locked.current = true; setError(null)
      try { await saveCatalog(user!.uid, 'cards', id, values, record?.updatedAt); onSaved() }
      catch (failure) { setError(catalogErrorMessage(failure)) }
      finally { locked.current = false }
    })}>
      <fieldset disabled={isSubmitting}>
        <label htmlFor="card-name">Nome do cartão</label>
        <input id="card-name" autoFocus maxLength={120} autoComplete="off" {...register('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'card-name-error' : undefined} />
        {errors.name && <p id="card-name-error" className="field-error">{errors.name.message}</p>}
        <label htmlFor="card-color">Cor de identificação</label>
        <input id="card-color" type="color" className="color-input" {...register('color')} aria-invalid={!!errors.color} />
        {errors.color && <p className="field-error">{errors.color.message}</p>}
        <div className="form-grid">
          <div><label htmlFor="closing-day">Dia de fechamento</label>
            <input id="closing-day" type="number" min={1} max={31} step={1} {...register('closingDay', { valueAsNumber: true })} aria-invalid={!!errors.closingDay} aria-describedby={errors.closingDay ? 'closing-day-error' : undefined} />
            {errors.closingDay && <p id="closing-day-error" className="field-error">{errors.closingDay.message}</p>}
          </div>
          <div><label htmlFor="due-day">Dia de vencimento</label>
            <input id="due-day" type="number" min={1} max={31} step={1} {...register('dueDay', { valueAsNumber: true })} aria-invalid={!!errors.dueDay} aria-describedby={errors.dueDay ? 'due-day-error' : undefined} />
            {errors.dueDay && <p id="due-day-error" className="field-error">{errors.dueDay.message}</p>}
          </div>
        </div>
        <p className="muted text-sm mt-4">Dias 29, 30 e 31 serão ajustados ao último dia válido em meses mais curtos.</p>
        {record && <p className="notice mt-4">A alteração vale para novos lançamentos e faturas ainda não materializadas. Competências, vencimentos e pagamentos já registrados são preservados.</p>}
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary" disabled={isSubmitting} onClick={onClose}>Cancelar</button>
        <button type="submit" className="primary" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar cartão'}</button></div>
    </form>
  </Modal>
}
export function CategoryForm({ record, onClose, onSaved }: { record?: CategoryRecord; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const [id] = useState(() => record?.id ?? newCatalogId(user!.uid, 'categories'))
  const locked = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: record ? { name: record.name, scope: record.scope } : { name: '', scope: 'expense' },
  })
  return <Modal title={record ? 'Editar categoria' : 'Nova categoria'} busy={isSubmitting} onClose={onClose}>
    <form noValidate onSubmit={handleSubmit(async values => {
      if (locked.current) return
      locked.current = true; setError(null)
      try { await saveCatalog(user!.uid, 'categories', id, values, record?.updatedAt); onSaved() }
      catch (failure) { setError(catalogErrorMessage(failure)) }
      finally { locked.current = false }
    })}>
      <fieldset disabled={isSubmitting}>
        <label htmlFor="category-name">Nome da categoria</label>
        <input id="category-name" autoFocus autoComplete="off" maxLength={120} {...register('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'category-name-error' : undefined} />
        {errors.name && <p id="category-name-error" className="field-error">{errors.name.message}</p>}
        <label htmlFor="category-scope">Usar em</label>
        <select id="category-scope" {...register('scope')} aria-invalid={!!errors.scope}>
          {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {errors.scope && <p className="field-error">{errors.scope.message}</p>}
        {record && <p className="notice mt-4">A aplicação da categoria vale para novas escolhas. Os vínculos com lançamentos existentes são preservados.</p>}
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary" disabled={isSubmitting} onClick={onClose}>Cancelar</button>
        <button type="submit" className="primary" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar categoria'}</button></div>
    </form>
  </Modal>
}
