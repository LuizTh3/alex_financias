import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeCollection, type CollectionName, type RecordMap } from '../data/store'
import type { FinanceData } from '../domain/summary'

const LOAD_ERROR = 'Não foi possível carregar os dados. Confira a conexão e tente novamente.'

/** Acompanha uma coleção do usuário em tempo real. */
export function useCollection<K extends CollectionName>(name: K) {
  const { user } = useAuth()
  const [rows, setRows] = useState<RecordMap[K][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setRows([]); setLoading(true); setError(null)
    if (!user) { setLoading(false); return }
    try {
      return subscribeCollection(user.uid, name, items => { setRows(items); setLoading(false); setError(null) },
        () => { setError(LOAD_ERROR); setLoading(false) })
    } catch { setError(LOAD_ERROR); setLoading(false) }
  }, [user, name, attempt])
  return { rows, loading, error, retry: () => setAttempt(value => value + 1) }
}

/** Todas as coleções usadas pelos cálculos (Visão geral, Faturas, Previsão). */
export function useFinanceData() {
  const cards = useCollection('cards')
  const purchases = useCollection('purchases')
  const statuses = useCollection('invoiceStatus')
  const incomes = useCollection('incomes')
  const receivables = useCollection('receivables')
  const expenses = useCollection('expenses')
  const sources = [cards, purchases, statuses, incomes, receivables, expenses]
  const data: FinanceData = {
    cards: cards.rows, purchases: purchases.rows, statuses: statuses.rows, incomes: incomes.rows, receivables: receivables.rows, expenses: expenses.rows,
  }
  return {
    data,
    loading: sources.some(source => source.loading),
    error: sources.find(source => source.error)?.error ?? null,
    retry: () => sources.forEach(source => source.retry()),
  }
}
