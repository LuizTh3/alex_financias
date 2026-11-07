import { useEffect, useState, type ReactNode } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { resumeSchedule } from '../repositories/scheduleRepository'
/** Hide intermediate balances and offer recovery after refresh, disconnect or another tab. */
export function ScheduleGate({ uid, children }: { uid: string; children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<{ cursor: number; size: number } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setLoading(true); setError('')
    if (!db) return
    return onSnapshot(doc(db, 'users', uid, 'scheduleOperations', 'current'), snapshot => {
      if (snapshot.metadata.hasPendingWrites) return
      setLoading(false)
      setProgress(snapshot.exists() && snapshot.data().state === 'active' ? snapshot.data() as { cursor: number; size: number } : null)
    }, () => { setLoading(false); setError('Não foi possível verificar os parcelamentos em andamento.') })
  }, [uid, attempt])
  if (loading) return <main className="workspace" role="status">Verificando parcelamentos.</main>
  if (progress || error) return <main className="workspace"><h1>Concluindo parcelamento</h1><p className="notice mt-5">Para manter os valores consistentes, aguarde a conclusão antes de usar as ferramentas financeiras. Se a conexão foi interrompida, retome a operação abaixo.</p>{progress && <p role="status" className="mt-5">{progress.cursor} de {progress.size} etapas salvas.</p>}{error && <p className="error" role="alert">{error}</p>}<button className="primary mt-5" disabled={busy} onClick={async () => {
    if (!progress) { setAttempt(value => value + 1); return }
    setBusy(true); setError('')
    try { await resumeSchedule(uid) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível concluir. Confira a conexão e tente novamente.') } finally { setBusy(false) }
  }}>{busy ? 'Concluindo…' : progress ? 'Retomar parcelamento' : 'Tentar novamente'}</button></main>
  return children
}
