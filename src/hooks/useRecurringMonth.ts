import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { projectRecurrences } from '../domain/recurrences'
import { materializeOccurrence } from '../repositories/recurrenceRepository'
import { useCatalog } from './useCatalog'
import { useFinancialRecords } from './useFinancialRecords'
export function useRecurringMonth(competence: string, enabled = true) {
  const { user } = useAuth()
  const cards = useCatalog('cards')
  const roots = useFinancialRecords('recurrences')
  const versions = useFinancialRecords('recurrenceVersions')
  const entries = useFinancialRecords('entries', true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const completed = useRef('')
  const sourcesLoading = roots.loading || versions.loading || entries.loading || cards.loading
  const missing = useMemo(() => projectRecurrences(competence, roots.rows, versions.rows, entries.rows, cards.rows), [competence, roots.rows, versions.rows, entries.rows, cards.rows])
  const signature = `${user?.uid}:${competence}:${attempt}:${missing.map(item => `${item.id}:${item.versionId}:${item.input.dueDay}`).join(',')}`
  const sourcesError = roots.error || versions.error || entries.error || cards.error
  useEffect(() => {
    if (!enabled || !user || sourcesLoading || sourcesError || completed.current === signature) return
    let alive = true
    setError(null)
    if (!missing.length) { completed.current = signature; setRunning(false); return }
    setRunning(true)
    void (async () => {
      try {
        for (const occurrence of missing) {
          const version = versions.rows.find(item => item.id === occurrence.versionId)
          if (version) await materializeOccurrence(user.uid, version, competence)
        }
        if (alive) completed.current = signature
      } catch { if (alive) setError('Não foi possível gerar todas as ocorrências do mês. Confira a conexão e as faturas afetadas; faturas pagas não aceitam novas cobranças.') }
      finally { if (alive) setRunning(false) }
    })()
    return () => { alive = false }
  }, [enabled, signature, user, sourcesLoading, sourcesError, missing, versions.rows, competence])
  return { roots, versions, allEntries: entries, loading: enabled && (sourcesLoading || running), error: enabled ? sourcesError || error : null,
    retry: () => { roots.retry(); versions.retry(); entries.retry(); cards.retry(); completed.current = ''; setAttempt(value => value + 1) } }
}
