import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { scopeLabels, type CatalogKind } from '../domain/catalog'
import { formatTimestamp } from '../domain/finance'
import { useCatalog } from '../hooks/useCatalog'
import { catalogErrorMessage, setCatalogActive, type CatalogRecord } from '../repositories/catalogRepository'
import { CardForm, CategoryForm } from '../components/CatalogForm'
import { Modal } from '../components/Modal'

type Filter = 'active' | 'archived' | 'all'
export function CatalogPage({ kind }: { kind: CatalogKind }) {
  const { user } = useAuth()
  const { rows, loading, error, retry } = useCatalog(kind)
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<{ record?: CatalogRecord } | null>(null)
  const [confirmation, setConfirmation] = useState<CatalogRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const locked = useRef(false)
  const isCards = kind === 'cards'
  const title = isCards ? 'Cartões' : 'Categorias'
  const noun = isCards ? 'cartão' : 'categoria'
  const visible = rows.filter(row => (filter === 'all' || row.active === (filter === 'active'))
    && row.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))
  function saved() {
    setEditor(null)
    setMessage(isCards ? 'Cartão salvo.' : 'Categoria salva.')
  }
  return <main className="workspace">
    <header><div><p className="eyebrow">SEUS CADASTROS</p><h1>{title}</h1></div>
      <button className="primary" disabled={loading || !!error} onClick={() => { setMessage(''); setEditor({}) }}>{isCards ? '+ Novo cartão' : '+ Nova categoria'}</button>
    </header>
    <p className="muted mb-8">{isCards ? 'Organize seus cartões, datas de fechamento e vencimento.' : 'Organize suas despesas e recebimentos por categoria.'}</p>
    <p role="status" className={message ? 'success mb-4' : 'sr-only'}>{message}</p>
    <div className="catalog-toolbar">
      <div className="filter-tabs" role="group" aria-label="Situação dos cadastros">
        {([['active', 'Ativos'], ['archived', 'Arquivados'], ['all', 'Todos']] as const).map(([value, label]) =>
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} <span>{rows.filter(row => value === 'all' || row.active === (value === 'active')).length}</span></button>)}
      </div>
      <div className="search"><label className="sr-only" htmlFor="catalog-search">Buscar por nome</label>
        <input id="catalog-search" type="search" placeholder="Buscar por nome…" value={search} onChange={event => setSearch(event.target.value)} /></div>
    </div>
    {loading ? <p role="status">Carregando {title.toLowerCase()}…</p> : error ? <div className="error" role="alert"><p>{error}</p><button className="secondary mt-3" onClick={retry}>Tentar novamente</button></div> :
      <section className="panel" aria-label={title}>
        <div className="panel-heading"><h2>{filter === 'active' ? 'Cadastros ativos' : filter === 'archived' ? 'Cadastros arquivados' : 'Todos os cadastros'}</h2><span className="badge">{visible.length} registros</span></div>
        {visible.length === 0 ? <div className="empty"><span className="empty-icon">◎</span>
          <h3>{search.trim() ? 'Nenhum resultado para esta busca' : filter === 'archived' ? 'Nenhum cadastro arquivado' : `Nenhum ${noun} por aqui`}</h3>
          <p className="muted">{search.trim() ? 'Tente outro nome ou altere o filtro.' : filter === 'archived' ? 'Os cadastros arquivados continuam disponíveis no histórico.' : `Comece adicionando ${isCards ? 'seu primeiro cartão' : 'sua primeira categoria'}.`}</p>
        </div> : <ul className="catalog-list">{visible.map(row => <li key={row.id} className={!row.active ? 'archived' : undefined}>
          <div className="catalog-details">
            {'color' in row && <span className="card-swatch" style={{ backgroundColor: row.color }} aria-hidden="true">▰</span>}
            <div><div className="catalog-name"><h3>{row.name}</h3>{!row.active && <span className="badge">Arquivado</span>}</div>
              <p className="muted text-sm">{'closingDay' in row ? `Fecha dia ${row.closingDay} · Vence dia ${row.dueDay}` : scopeLabels[row.scope]}</p>
              <p className="muted timestamp">Atualizado em {formatTimestamp(row.updatedAt.toDate())}</p>
            </div>
          </div>
          <div className="row-actions">
            <button className="secondary" aria-label={`Editar ${row.name}`} onClick={() => { setMessage(''); setEditor({ record: row }) }}>Editar</button>
            <button className="secondary" aria-label={`${row.active ? 'Arquivar' : 'Reativar'} ${row.name}`} onClick={() => { setActionError(null); setMessage(''); setConfirmation(row) }}>{row.active ? 'Arquivar' : 'Reativar'}</button>
          </div>
        </li>)}</ul>}
      </section>}
    {editor && (isCards ? <CardForm record={editor.record && 'color' in editor.record ? editor.record : undefined} onClose={() => setEditor(null)} onSaved={saved} />
      : <CategoryForm record={editor.record && 'scope' in editor.record ? editor.record : undefined} onClose={() => setEditor(null)} onSaved={saved} />)}
    {confirmation && <Modal title={`${confirmation.active ? 'Arquivar' : 'Reativar'} ${noun}?`} busy={saving} onClose={() => setConfirmation(null)}>
      <p className="mt-5"><strong>{confirmation.name}</strong></p>
      <p className="muted mt-3">{confirmation.active
        ? 'Este cadastro deixará de aparecer nas opções para novos lançamentos. O histórico e os vínculos existentes serão preservados.'
        : 'Este cadastro voltará a aparecer nas opções para novos lançamentos.'}</p>
      {actionError && <p role="alert" className="error">{actionError}</p>}
      <div className="modal-actions"><button className="secondary" disabled={saving} onClick={() => setConfirmation(null)}>Cancelar</button>
        <button className="primary" disabled={saving} onClick={async () => {
          if (locked.current) return
          locked.current = true; setSaving(true); setActionError(null)
          try {
            await setCatalogActive(user!.uid, kind, confirmation, !confirmation.active)
            setMessage(confirmation.active ? 'Cadastro arquivado. Histórico preservado.' : 'Cadastro reativado.')
            setConfirmation(null)
          } catch (failure) { setActionError(catalogErrorMessage(failure)) }
          finally { locked.current = false; setSaving(false) }
        }}>{saving ? 'Salvando…' : confirmation.active ? 'Arquivar' : 'Reativar'}</button></div>
    </Modal>}
  </main>
}
