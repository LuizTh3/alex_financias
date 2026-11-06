import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { currentMonth, shiftMonth, formatMoney, formatMonth } from '../domain/finance'
import { invoiceId } from '../domain/entries'
import { todayCivil } from '../domain/calendar'
import { useRecurringMonth } from '../hooks/useRecurringMonth'
import { useCatalog } from '../hooks/useCatalog'
import { useFinancialRecords } from '../hooks/useFinancialRecords'
import { EntryForm } from '../components/EntryForm'
import { Modal } from '../components/Modal'
import type { FinancialRecord } from '../repositories/financialSchemas'
import { deleteEntry, newMutationId, financialErrorMessage } from '../repositories/entryRepository'
export function EntriesPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const entries = useFinancialRecords('entries')
  const installments = useFinancialRecords('installments')
  const invoices = useFinancialRecords('invoices')
  const cards = useCatalog('cards')
  const categories = useCatalog('categories')
  const [month, setMonth] = useState(currentMonth)
  const recurring = useRecurringMonth(month)
  const [all, setAll] = useState(false)
  const [editor, setEditor] = useState<{ record?: FinancialRecord<'entries'> } | null>(null)
  const [deleting, setDeleting] = useState<{ record: FinancialRecord<'entries'>; mutationId: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const locked = useRef(false)
  const openedFromQuery = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const sources = [entries, installments, invoices, cards, categories]
  const loading = sources.some(source => source.loading) || recurring.loading
  const loadError = sources.find(source => source.error)?.error
  useEffect(() => {
    if (params.get('tipo') === 'income' && !loading && !loadError && !openedFromQuery.current) { openedFromQuery.current = true; setEditor({}) }
  }, [params, loading, loadError])
  const affectedIds = new Set(installments.rows.filter(part => part.competence === month).map(part => part.entryId))
  const visible = entries.rows.filter(entry => all || affectedIds.has(entry.id)).sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate) || a.id.localeCompare(b.id))
  function isLocked(entry: FinancialRecord<'entries'>) {
    return installments.rows.filter(part => part.entryId === entry.id).some(part => part.status === 'paid' || part.status === 'received' || part.settledAt !== null
      || (part.cardId && invoices.rows.some(invoice => invoiceId(invoice.cardId, invoice.competence) === invoiceId(part.cardId!, part.competence) && invoice.status === 'paid')))
  }
  return <main className="workspace"><header><div><p className="eyebrow">DESPESAS E RECEBIMENTOS</p><h1>Lançamentos</h1></div><button className="primary" disabled={loading || !!loadError || !categories.rows.some(category => category.active)} onClick={() => { setMessage(''); setEditor({}) }}>+ Novo lançamento</button></header>
    <p className="muted mb-6">Informe o valor total e confira as parcelas pelo mês de vencimento.</p>
    <div className="catalog-toolbar"><div className="month-picker"><button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>←</button><span>{formatMonth(month)}</span><button aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>→</button></div>
      <label className="checkbox-label"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} /> Todos os lançamentos</label></div>
    <p role="status" className={message ? 'success mb-4' : 'sr-only'}>{message}</p>
    {recurring.error && <p className="error mb-5" role="alert">{recurring.error}<button className="secondary ml-3" onClick={recurring.retry}>Tentar novamente</button></p>}
    {loadError ? <div className="error" role="alert">{loadError}<button className="secondary ml-3" onClick={() => sources.forEach(source => source.retry())}>Tentar novamente</button></div> : loading ? <p role="status">Carregando lançamentos…</p> : <>
      {!categories.rows.some(category => category.active) && <p className="notice mb-5">Crie uma <Link className="underline" to="/categorias">categoria ativa</Link> para começar.</p>}
      <section className="panel"><div className="panel-heading"><h2>{all ? 'Todos os lançamentos' : 'Lançamentos com vencimento no mês'}</h2><span className="badge">{visible.length} registros</span></div>
        {visible.length ? <ul className="catalog-list">{visible.map(entry => {
          const blocked = isLocked(entry)
          const parts = installments.rows.filter(part => part.entryId === entry.id)
          const overdue = parts.some(part => part.competence === month && part.dueDate < todayCivil() && part.status === 'pending')
          return <li key={entry.id}><div className="catalog-details"><div><h3>{entry.description}</h3><p className="muted text-sm">{entry.type === 'income' ? 'Recebimento' : 'Despesa'} · {entry.installmentCount} parcela(s) · Total {formatMoney(entry.totalCents)}</p>
            <p className="muted text-sm">{entry.cardId ? `Cartão: ${cards.rows.find(card => card.id === entry.cardId)?.name ?? 'Cartão'}` : 'Pagamento direto'} · Primeira competência: {formatMonth(entry.firstCompetence)}</p>
            {blocked && <p className="notice mt-2">Há liquidações vinculadas. Desfaça os pagamentos afetados para editar ou excluir.</p>}{overdue && <span className="badge">Atrasado</span>}</div></div>
            <div className="row-actions"><button className="secondary" disabled={blocked} onClick={() => setEditor({ record: entry })}>Editar</button><button className="secondary" disabled={blocked} onClick={() => { setError(null); setDeleting({ record: entry, mutationId: newMutationId() }) }}>Excluir</button></div></li>
        })}</ul> : <div className="empty"><h3>Nenhum lançamento neste período</h3><p className="muted">Adicione uma despesa ou um recebimento para começar.</p></div>}
      </section>
    </>}
    {editor && <EntryForm record={editor.record} cards={cards.rows} categories={categories.rows} invoices={invoices.rows} initialMonth={month} initialType={params.get('tipo') === 'income' ? 'income' : 'expense'} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setMessage('Lançamento e parcelas salvos.'); }} />}
    {deleting && <Modal title="Excluir lançamento e parcelas?" busy={saving} onClose={() => setDeleting(null)}>
      <p className="mt-5"><strong>{deleting.record.description}</strong></p><p className="muted mt-3">Esta ação removerá todas as {deleting.record.installmentCount} parcelas, com total de {formatMoney(deleting.record.totalCents)}, a partir de {formatMonth(deleting.record.firstCompetence)}. As cobranças sairão das faturas e dos compromissos futuros.</p>
      {error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary" disabled={saving} onClick={() => setDeleting(null)}>Cancelar</button><button className="primary" disabled={saving} onClick={async () => {
        if (locked.current) return
        locked.current = true; setSaving(true); setError(null)
        try { await deleteEntry(user!.uid, deleting.record.id, deleting.record.revision, deleting.mutationId); setDeleting(null); setMessage('Lançamento e parcelas excluídos.') }
        catch (failure) { setError(financialErrorMessage(failure)) }
        finally { locked.current = false; setSaving(false) }
      }}>{saving ? 'Excluindo…' : 'Excluir todas as parcelas'}</button></div>
    </Modal>}
  </main>
}
