import type { ReactNode } from 'react'

export function EmptyState({ icon = '○', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty">
    <span className="empty-icon" aria-hidden="true">{icon}</span>
    <h3>{title}</h3>
    {children && <p className="muted">{children}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
}

/** Carregando / erro com nova tentativa, usado por todas as telas. */
export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (error) return <div className="error" role="alert">{error} <button type="button" className="secondary ml-3" onClick={onRetry}>Tentar novamente</button></div>
  if (loading) return <p className="muted" role="status">Carregando…</p>
  return null
}
