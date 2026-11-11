import { useState, type ReactNode } from 'react'
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

/**
 * Confirmação antes de uma ação (pagar, desmarcar, excluir), com o AlertDialog do shadcn.
 * Mostra "Aguarde…" durante a gravação, mantém o diálogo aberto se der erro e fecha ao concluir.
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
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent className="p-6 sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription asChild><div className="confirm-body text-left">{children}</div></AlertDialogDescription>
      </AlertDialogHeader>
      {error && <p className="error" role="alert">{error}</p>}
      <AlertDialogFooter>
        <Button variant="outline" size="lg" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button variant={danger ? 'destructive' : 'default'} size="lg" disabled={busy} onClick={() => void confirm()}>{busy ? 'Aguarde…' : confirmLabel}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
