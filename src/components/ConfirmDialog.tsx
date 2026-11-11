import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'

/**
 * Confirmação antes de uma ação (pagar, desmarcar, excluir). Mostra "Aguarde…" durante a gravação,
 * mantém o diálogo aberto se der erro e fecha sozinho ao concluir.
 */
export function ConfirmDialog({ title, children, confirmLabel, danger = false, onConfirm, onClose }: {
  title: string; children: ReactNode; confirmLabel: string; danger?: boolean
  onConfirm: () => Promise<unknown>; onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    setBusy(true); setError('')
    try { await onConfirm(); onClose() } catch { setError('Não foi possível concluir. Confira a conexão e tente novamente.') } finally { setBusy(false) }
  }
  return <Modal title={title} busy={busy} onClose={onClose}>
    <div className="mt-4 confirm-body">{children}</div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="modal-actions">
      <button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancelar</button>
      <button type="button" className={danger ? 'danger' : 'primary'} disabled={busy} onClick={() => void confirm()}>{busy ? 'Aguarde…' : confirmLabel}</button>
    </div>
  </Modal>
}
