import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeTo, type CollectionName, type RecordOf } from '../repositories/financeRepository'
export function useFinancialRecords<K extends CollectionName>(name: K) {
  const { user } = useAuth()
  const [rows, setRows] = useState<RecordOf<K>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setRows([]); setLoading(true); setError(null)
    if (!user) { setLoading(false); return }
    return subscribeTo(user.uid, name, items => { setRows(items); setLoading(false); setError(null) }, () => {
      setError('Não foi possível carregar os dados financeiros. Confira a conexão e as regras publicadas.'); setLoading(false)
    })
  }, [user, name, attempt])
  return { rows, loading, error, retry: () => setAttempt(value => value + 1) }
}
