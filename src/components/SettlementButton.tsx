import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { formatMoney } from '../domain/finance'
import { newMutationId } from '../repositories/entryRepository'
import { changeSettlement, settlementErrorMessage, type SettlementCommand } from '../repositories/settlementRepository'
import type { FinancialRecord } from '../repositories/financialSchemas'
import { Modal } from './Modal'
export function SettlementButton({ part, type, description }: { part: FinancialRecord<'installments'>; type: 'expense' | 'income'; description: string }) {
  const { user } = useAuth()
  const [command, setCommand] = useState<SettlementCommand | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useRef(false)
  const settled = part.status === 'paid' || part.status === 'received'
  if (part.cardId) return <span className="muted text-sm">Liquidação pela fatura</span>
  const stale = command && (part.revision !== command.expectedEntryRevision || (part.settlementRevision ?? 0) !== command.expectedSettlementRevision)
  return <>
    <button className={settled ? 'secondary' : 'primary'} onClick={() => {
      setError(null); setCommand({ installmentId: part.id, mutationId: newMutationId(), expectedEntryRevision: part.revision,
        expectedSettlementRevision: part.settlementRevision ?? 0, expectedAmountCents: part.amountCents, action: settled ? 'reverse' : 'confirm' })
    }}>{settled ? 'Desfazer confirmação' : type === 'income' ? 'Confirmar recebimento' : 'Confirmar pagamento'}</button>
    {command && <Modal title={command.action === 'reverse' ? 'Desfazer confirmação?' : type === 'income' ? 'Confirmar recebimento?' : 'Confirmar pagamento?'} busy={saving} onClose={() => setCommand(null)}>
      <p className="mt-5"><strong>{description}</strong> · Parcela {part.index}/{part.count}</p><p className="invoice-total">{formatMoney(command.expectedAmountCents)}</p>
      <p className="muted">{command.action === 'reverse' ? 'A parcela voltará a ficar pendente. A confirmação original permanecerá no histórico.' : `Confirme somente se você já ${type === 'income' ? 'recebeu' : 'pagou'} este valor integralmente. As outras parcelas não serão alteradas.`}</p>
      {stale && <p className="error" role="alert">A parcela mudou. Feche e confira os dados atualizados.</p>}{error && <p className="error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="secondary" disabled={saving} onClick={() => setCommand(null)}>Cancelar</button><button className="primary" disabled={saving || !!stale} onClick={async () => {
        if (locked.current) return
        locked.current = true; setSaving(true); setError(null)
        try { await changeSettlement(user!.uid, command); setCommand(null) }
        catch (failure) { setError(settlementErrorMessage(failure)) }
        finally { locked.current = false; setSaving(false) }
      }}>{saving ? 'Confirmando…' : command.action === 'reverse' ? 'Sim, desfazer' : 'Confirmar'}</button></div>
    </Modal>}
  </>
}
