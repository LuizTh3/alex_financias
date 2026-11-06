import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { currentMonth, shiftMonth, formatMonth, formatMoney, formatTimestamp } from '../domain/finance'
import { commitmentSituation } from '../domain/commitments'
import { fixedBlockSituation } from '../domain/recurrences'
import { useRecurringMonth } from '../hooks/useRecurringMonth'
import { useFinancialRecords } from '../hooks/useFinancialRecords'
import { useCatalog } from '../hooks/useCatalog'
import { RecurrenceForm } from '../components/RecurrenceForm'
import { EntryForm } from '../components/EntryForm'
import { SettlementButton } from '../components/SettlementButton'
import { Modal } from '../components/Modal'
import { saveRecurrence, recurrenceErrorMessage } from '../repositories/recurrenceRepository'
import { deleteEntry, financialErrorMessage, newMutationId } from '../repositories/entryRepository'
import type { FinancialRecord } from '../repositories/financialSchemas'
export function FixedExpensesPage() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const [models, setModels] = useState(false)
  const recurring = useRecurringMonth(month)
  const events = useFinancialRecords('settlementEvents')
  const parts = useFinancialRecords('installments'); const invoices = useFinancialRecords('invoices')
  const cards = useCatalog('cards'); const categories = useCatalog('categories')
  const [editor, setEditor] = useState<{ root?: FinancialRecord<'recurrences'> } | null>(null)
  const [occurrence, setOccurrence] = useState<FinancialRecord<'entries'> | null>(null)
  const [action, setAction] = useState<{ root: FinancialRecord<'recurrences'>; kind: 'pause' | 'end'; mutationId: string } | null>(null)
  const [from, setFrom] = useState(currentMonth)
  const [deleting, setDeleting] = useState<{ entry: FinancialRecord<'entries'>; mutationId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useRef(false)
  const sources = [parts, invoices, cards, categories, events]
  const snapshotsIncomplete = recurring.allEntries.rows.some(entry => entry.recurrenceId && !entry.deletedAt && entry.firstCompetence === month && !parts.rows.some(part => part.entryId === entry.id && part.revision === entry.revision))
  const loading = sources.some(source => source.loading) || recurring.loading || snapshotsIncomplete
  const fatal = sources.find(source => source.error)?.error
  const rows = recurring.allEntries.rows.filter(entry => entry.recurrenceId && !entry.deletedAt && entry.firstCompetence === month).flatMap(entry => {
    const part = parts.rows.find(part => part.entryId === entry.id)
    if (!part) return []
    const invoice = part.cardId ? invoices.rows.find(invoice => invoice.cardId === part.cardId && invoice.competence === part.competence) : null
    return [{ entry, part, paid: part.cardId ? invoice?.status === 'paid' : part.status === 'paid' || part.status === 'received' }]
  })
  const pending = rows.filter(row => !row.paid && row.entry.type === 'expense').reduce((sum, row) => sum + row.part.amountCents, 0)
  const paid = rows.filter(row => !row.paid && row.entry.type === 'income').reduce((sum, row) => sum + row.part.amountCents, 0)
  const latest = (root: FinancialRecord<'recurrences'>) => recurring.versions.rows.find(version => version.id === root.latestVersionId)
  const existingFutureCount = action ? recurring.allEntries.rows.filter(entry => entry.recurrenceId === action.root.id && !entry.deletedAt && entry.firstCompetence >= from).length : 0
  function beginAction(root: FinancialRecord<'recurrences'>, kind: 'pause' | 'end') { setError(null); setFrom([currentMonth(), root.latestFrom].sort().at(-1)!); setAction({ root, kind, mutationId: newMutationId() }) }
  return <main className="workspace"><header><div><p className="eyebrow">PLANEJAMENTO MENSAL</p><h1>Rendas e despesas mensais</h1></div><button className="primary" disabled={loading || !!fatal} onClick={() => setEditor({})}>+ Nova recorrência</button></header>
    <p className="muted mb-6">Modelos mensais geram ocorrências independentes. Mudanças preservam tudo o que já foi gerado.</p>
    <div className="catalog-toolbar"><div className="filter-tabs" role="group" aria-label="Visualização de gastos fixos"><button aria-pressed={!models} onClick={() => setModels(false)}>Ocorrências do mês</button><button aria-pressed={models} onClick={() => setModels(true)}>Modelos e versões</button></div><div className="month-picker"><button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>←</button><span>{formatMonth(month)}</span><button aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>→</button></div></div>
    {recurring.error && <div className="error mb-5" role="alert">{recurring.error}<button className="secondary ml-3" onClick={recurring.retry}>Tentar gerar novamente</button></div>}
    {fatal ? <div className="error" role="alert">{fatal}<button className="secondary ml-3" onClick={() => sources.forEach(source => source.retry())}>Tentar novamente</button></div> : loading ? <p role="status">Carregando e gerando apenas as ocorrências faltantes…</p> : models ? <section className="panel"><div className="panel-heading"><h2>Recorrências mensais</h2><span className="badge">{recurring.roots.rows.length} modelos</span></div>
      {recurring.roots.rows.length ? <ul className="catalog-list">{recurring.roots.rows.map(root => {
        const version = latest(root)
        if (!version) return null
        const versions = recurring.versions.rows.filter(item => item.recurrenceId === root.id).sort((a, b) => b.revision - a.revision)
        return <li key={root.id}><div><h3>{version.description}</h3><p className="muted text-sm">{formatMoney(version.amountCents)} por mês · {version.cardId ? 'Cobrança em cartão' : `Dia ${version.dueDay} · Pagamento direto`}</p><p className="text-sm mt-2">{root.state === 'active' ? 'Vigente' : root.state === 'paused' ? 'Pausa programada' : 'Encerramento'} a partir de {formatMonth(root.latestFrom)}</p>
          <details className="mt-3"><summary>Histórico de {versions.length} versão(ões)</summary><ol className="invoice-timeline">{versions.map(item => <li key={item.id}><strong>Versão {item.revision} · {item.action === 'configure' ? formatMoney(item.amountCents) : item.action === 'pause' ? 'Pausada' : 'Encerrada'}</strong><p className="muted text-sm">Desde {formatMonth(item.effectiveFrom)}{item.validUntil ? ` até antes de ${formatMonth(item.validUntil)}` : ''}</p><p className="muted text-sm">Criada em {formatTimestamp(item.createdAt.toDate())}</p></li>)}</ol></details>
        </div><div className="row-actions">{root.state !== 'ended' && <><button className="secondary" onClick={() => setEditor({ root })}>{root.state === 'paused' ? 'Retomar / editar' : 'Nova versão'}</button>{root.state === 'active' && <button className="secondary" onClick={() => beginAction(root, 'pause')}>Pausar</button>}<button className="secondary" onClick={() => beginAction(root, 'end')}>Encerrar</button></>}</div></li>
      })}</ul> : <div className="empty"><h3>Nenhuma recorrência cadastrada</h3><p className="muted">Cadastre um modelo mensal para começar.</p></div>}
    </section> : <>
      <section className="stats"><article><p>Pendente no mês</p><strong>{formatMoney(pending)}</strong><span>Despesas pendentes</span></article><article><p>Renda prevista no mês</p><strong>{formatMoney(paid)}</strong><span>Recebimentos pendentes</span></article><article className="highlight"><p>Situação do bloco mensal</p><strong>{recurring.error ? 'Verificar' : fixedBlockSituation(rows)}</strong><span>{rows.length} ocorrência(s)</span></article></section>
      <section className="panel"><div className="panel-heading"><h2>Ocorrências de {formatMonth(month)}</h2><span className="badge">{rows.length} registros</span></div>
        {rows.length ? <ul className="catalog-list">{rows.map(({ entry, part, paid }) => <li key={entry.id}><div><h3>{entry.description}</h3><p className="muted text-sm">{part.dueDate.split('-').reverse().join('/')} · {commitmentSituation({ paid, income: entry.type === 'income', dueDate: part.dueDate })} · {part.cardId ? 'Cartão' : 'Direto'}</p><strong>{formatMoney(part.amountCents)}</strong>{part.settledAt && <p className="muted text-sm">Confirmado em {formatTimestamp(part.settledAt.toDate())}</p>}{!part.cardId && events.rows.some(event => event.installmentId === part.id) && <details className="mt-3"><summary>Histórico de confirmações</summary><ol className="invoice-timeline">{events.rows.filter(event => event.installmentId === part.id).sort((a, b) => b.settlementRevision - a.settlementRevision).map(event => <li key={event.id}><strong>{event.type === 'reversal' ? 'Confirmação desfeita' : 'Pagamento confirmado'} · {formatMoney(event.amountCents)}</strong><p className="muted text-sm">{formatTimestamp(event.createdAt.toDate())}</p></li>)}</ol></details>}</div><div className="row-actions flex-wrap">
          {part.cardId ? <Link className="secondary" to={`/faturas?cartao=${encodeURIComponent(part.cardId)}`}>{paid ? 'Pago pela fatura' : 'Ver fatura'}</Link> : <SettlementButton part={part} type={entry.type} description={entry.description} />}
          <button className="secondary" disabled={paid} onClick={() => setOccurrence(entry)}>Editar ocorrência</button><button className="secondary" disabled={paid} onClick={() => { setError(null); setDeleting({ entry, mutationId: newMutationId() }) }}>Excluir ocorrência</button></div></li>)}</ul> : <div className="empty"><h3>Sem gastos neste mês</h3><p className="muted">Modelos vigentes geram apenas as ocorrências que ainda não existem.</p></div>}
      </section>
    </>}
    {editor && <RecurrenceForm root={editor.root} previous={editor.root ? latest(editor.root) : undefined} cards={cards.rows} categories={categories.rows} initialMonth={month} onClose={() => setEditor(null)} />}
    {occurrence && <EntryForm record={occurrence} cards={cards.rows} categories={categories.rows} invoices={invoices.rows} initialMonth={month} onClose={() => setOccurrence(null)} onSaved={() => setOccurrence(null)} />}
    {action && <Modal title={action.kind === 'pause' ? 'Pausar recorrência?' : 'Encerrar recorrência?'} busy={busy} onClose={() => setAction(null)}>
      <p className="mt-5">A mudança valerá somente para ocorrências ainda não geradas. {action.kind === 'end' ? 'O encerramento é definitivo; para voltar, será necessário criar outro modelo.' : 'Você poderá retomar criando uma nova versão.'}</p><label htmlFor="rec-action-from">A partir da competência</label><input id="rec-action-from" type="month" min={[currentMonth(), action.root.latestFrom].sort().at(-1)} value={from} disabled={busy} onChange={event => setFrom(event.target.value)} />
      <p className="notice mt-4">{existingFutureCount} ocorrência(s) já gerada(s) a partir desta competência permanecerão intactas, inclusive pendentes.</p>{error && <p className="error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="secondary" disabled={busy} onClick={() => setAction(null)}>Cancelar</button><button className="primary" disabled={busy} onClick={async () => {
        if (locked.current) return
        locked.current = true; setBusy(true); setError(null)
        try { await saveRecurrence(user!.uid, { id: action.root.id, mutationId: action.mutationId, expectedRevision: action.root.revision, effectiveFrom: from, action: action.kind }); setAction(null) }
        catch (failure) { setError(recurrenceErrorMessage(failure)) }
        finally { locked.current = false; setBusy(false) }
      }}>{busy ? 'Salvando…' : action.kind === 'pause' ? 'Confirmar pausa' : 'Confirmar encerramento'}</button></div>
    </Modal>}
    {deleting && <Modal title="Excluir esta ocorrência?" busy={busy} onClose={() => setDeleting(null)}><p className="mt-5"><strong>{deleting.entry.description}</strong> · {formatMonth(deleting.entry.firstCompetence)} · {formatMoney(deleting.entry.totalCents)}</p><p className="notice mt-4">Somente esta ocorrência será removida das cobranças. Ela não será gerada novamente automaticamente. O modelo e as outras competências serão preservados.</p>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button className="primary" disabled={busy} onClick={async () => {
      if (locked.current) return
      locked.current = true; setBusy(true); setError(null)
      try { await deleteEntry(user!.uid, deleting.entry.id, deleting.entry.revision, deleting.mutationId); setDeleting(null) }
      catch (failure) { setError(financialErrorMessage(failure)) }
      finally { locked.current = false; setBusy(false) }
    }}>{busy ? 'Excluindo…' : 'Excluir somente esta ocorrência'}</button></div></Modal>}
  </main>
}
