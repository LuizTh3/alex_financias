import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeCatalog, type CatalogRecords } from '../repositories/catalogRepository'
import type { CatalogKind } from '../domain/catalog'
export function useCatalog<K extends CatalogKind>(kind: K) {
  const { user } = useAuth()
  const [rows, setRows] = useState<CatalogRecords[K][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setRows([]); setLoading(true); setError(null)
    if (!user) { setLoading(false); return }
    return subscribeCatalog(user.uid, kind, items => {
      setRows(items); setError(null); setLoading(false)
    }, failure => { setError(failure.message); setLoading(false) })
  }, [user, kind, attempt])
  return { rows, loading, error, retry: () => setAttempt(value => value + 1) }
}
