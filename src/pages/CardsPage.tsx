import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card as Panel } from '@/components/ui/card'
import { Link } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { useFinanceData } from '../hooks/useCollection'
import { activeCards, cardHasData } from '../domain/summary'
import type { Card } from '../domain/schemas'
import { removeCard } from '../data/store'
import { CreditCardVisual } from '../components/CreditCardVisual'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, LoadState } from '../components/EmptyState'
import { CardForm } from '../forms/CardForm'

export function CardsPage() {
  const { user } = useAuth()
  const { data, loading, error, retry } = useFinanceData()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Card | 'new' | null>(null)
  const [removing, setRemoving] = useState<Card | null>(null)
  const [message, setMessage] = useState('')
  const cards = activeCards(data.cards)
  const term = search.trim().toLocaleLowerCase('pt-BR')
  const visible = cards.filter(card => card.name.toLocaleLowerCase('pt-BR').includes(term))
  const removingHasData = removing ? cardHasData(removing.id, data) : false

  return <main className="workspace">
    <header>
      <div><p className="eyebrow">CADASTRO</p><h1>Cartões</h1></div>
      <Button onClick={() => { setMessage(''); setEditing('new') }}>+ Novo cartão</Button>
    </header>
    {message && <p className="success mb-4" role="status">{message}</p>}
    <LoadState loading={loading} error={error} onRetry={retry} />
    {!loading && !error && <>
      {cards.length > 0 && <div className="toolbar">
        <Input type="search" className="w-full sm:w-64" placeholder="Buscar pelo nome" aria-label="Buscar cartão pelo nome" value={search} onChange={event => setSearch(event.target.value)} />
        <span className="muted text-sm">{visible.length} de {cards.length} {cards.length === 1 ? 'cartão' : 'cartões'}</span>
      </div>}
      {cards.length === 0
        ? <Panel className="p-0"><EmptyState icon="▭" title="Nenhum cartão cadastrado" action={<Button onClick={() => setEditing('new')}>Cadastrar primeiro cartão</Button>}>
          Cadastre seus cartões para lançar as compras e acompanhar as faturas.
        </EmptyState></Panel>
        : visible.length === 0
          ? <Panel className="p-0"><EmptyState icon="⌕" title="Nenhum cartão encontrado">Nenhum nome contém “{search.trim()}”.</EmptyState></Panel>
          : <div className="card-grid">{visible.map(card => <CreditCardVisual key={card.id} card={card} actions={<>
            <Button asChild><Link to={`/faturas?cartao=${card.id}`}>Faturas</Link></Button>
            <Button variant="outline" onClick={() => { setMessage(''); setEditing(card) }}>Editar</Button>
            <Button variant="outline" onClick={() => { setMessage(''); setRemoving(card) }}>Excluir</Button>
          </>} />)}</div>}
    </>}
    {editing && <CardForm card={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {removing && <ConfirmDialog danger title={removingHasData ? 'Este cartão tem dados' : 'Excluir cartão?'}
      confirmLabel={removingHasData ? 'Excluir mesmo assim' : 'Excluir cartão'} onClose={() => setRemoving(null)}
      onConfirm={async () => {
        const result = await removeCard(user!.uid, removing.id, removingHasData)
        setMessage(result === 'deleted' ? `Cartão ${removing.name} excluído.` : `Cartão ${removing.name} removido das telas. As compras e faturas dele continuam guardadas.`)
      }}>
      {removingHasData
        ? <><p>O cartão <strong>{removing.name}</strong> tem lançamentos ou faturas marcadas como pagas.</p>
          <p>Ele deixará de aparecer nas telas e as compras dele não entrarão mais no valor a pagar nem na previsão. Os dados continuam guardados.</p></>
        : <p>O cartão <strong>{removing.name}</strong> não tem lançamentos e será excluído definitivamente.</p>}
    </ConfirmDialog>}
  </main>
}
