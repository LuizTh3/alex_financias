import { useAuth } from '../contexts/AuthContext'
import { setInvoicePaid } from '../data/store'
import { formatMoney, formatMonth } from '../domain/format'
import { ConfirmDialog } from './ConfirmDialog'

export type PayTarget = { cardId: string; cardName: string; month: string; totalCents: number; paid: boolean }

/** Marcar ou desmarcar a fatura como paga. Só identifica; não altera nenhum valor. */
export function InvoicePayDialog({ target, onClose }: { target: PayTarget; onClose: () => void }) {
  const { user } = useAuth()
  const subject = <>a fatura de <strong>{formatMonth(target.month)}</strong> do cartão <strong>{target.cardName}</strong> ({formatMoney(target.totalCents)})</>
  return <ConfirmDialog title={target.paid ? 'Desmarcar pagamento?' : 'Marcar fatura como paga?'} danger={target.paid}
    confirmLabel={target.paid ? 'Desmarcar pago' : 'Marcar como paga'} onClose={onClose}
    onConfirm={() => setInvoicePaid(user!.uid, target.cardId, target.month, !target.paid)}>
    <p>Deseja realmente {target.paid ? 'voltar' : 'marcar'} {subject} {target.paid ? 'para em aberto' : 'como paga'}?</p>
    <p className="muted">É apenas uma identificação: os valores e o saldo previsto não mudam.</p>
  </ConfirmDialog>
}
