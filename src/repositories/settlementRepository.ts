import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore'
import { z } from 'zod'
import { db, personalUid } from '../lib/firebase'
import { financialSchemas } from './financialSchemas'
export class SettlementError extends Error {}
export type SettlementCommand = { installmentId: string; mutationId: string; expectedEntryRevision: number; expectedSettlementRevision: number; expectedAmountCents: number; action: 'confirm' | 'reverse' }
export async function changeSettlement(uid: string, command: SettlementCommand) {
  if (!db || uid !== personalUid) throw new SettlementError('Conta sem acesso às confirmações.')
  z.string().regex(/^[A-Za-z0-9_-]{1,80}__[1-5]$/).parse(command.installmentId)
  z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).parse(command.mutationId)
  const database = db
  const partRef = doc(database, 'users', uid, 'installments', command.installmentId)
  const eventRef = doc(database, 'users', uid, 'settlementEvents', command.mutationId)
  const sameEvent = (data: unknown) => {
    const event = financialSchemas.settlementEvents.safeParse(data)
    return event.success && event.data.installmentId === command.installmentId && event.data.entryRevision === command.expectedEntryRevision
      && event.data.settlementRevision === command.expectedSettlementRevision + 1 && event.data.amountCents === command.expectedAmountCents
      && (command.action === 'reverse' ? event.data.type === 'reversal' : event.data.type !== 'reversal')
  }
  try {
    await runTransaction(database, async transaction => {
      const [snapshot, event] = await Promise.all([transaction.get(partRef), transaction.get(eventRef)])
      if (event.exists()) {
        if (sameEvent(event.data())) return
        throw new SettlementError('Esta tentativa já foi utilizada. Reabra a confirmação.')
      }
      if (!snapshot.exists()) throw new SettlementError('A ocorrência ou parcela precisa estar persistida antes de confirmar.')
      const part = financialSchemas.installments.parse(snapshot.data())
      const entrySnapshot = await transaction.get(doc(database, 'users', uid, 'entries', part.entryId))
      if (!entrySnapshot.exists()) throw new SettlementError('Lançamento inexistente.')
      const entry = financialSchemas.entries.parse(entrySnapshot.data())
      if (part.cardId || entry.paymentMethod !== 'direct') throw new SettlementError('Cobranças em cartão são liquidadas pela fatura.')
      if (entry.deletedAt || part.revision !== entry.revision || entry.revision !== command.expectedEntryRevision
        || (part.settlementRevision ?? 0) !== command.expectedSettlementRevision || part.amountCents !== command.expectedAmountCents) throw new SettlementError('A parcela mudou. Atualize os dados e confirme novamente.')
      const confirming = command.action === 'confirm'
      const settledStatus = entry.type === 'income' ? 'received' : 'paid'
      if (confirming ? part.status !== 'pending' : part.status !== settledStatus || !part.settledAt || !part.lastSettlementEventId) throw new SettlementError('A situação da parcela não permite esta operação.')
      const revision = (part.settlementRevision ?? 0) + 1
      transaction.update(partRef, { status: confirming ? settledStatus : 'pending', settledAt: confirming ? serverTimestamp() : null,
        settlementRevision: revision, lastSettlementEventId: command.mutationId, updatedAt: serverTimestamp() })
      transaction.set(eventRef, { installmentId: command.installmentId, entryId: part.entryId, entryRevision: entry.revision,
        type: confirming ? entry.type === 'income' ? 'receipt' : 'payment' : 'reversal', amountCents: part.amountCents,
        dueDate: part.dueDate, settlementRevision: revision, confirmationEventId: confirming ? command.mutationId : part.lastSettlementEventId,
        confirmedAt: confirming ? serverTimestamp() : part.settledAt, description: entry.description,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    })
  } catch (error) {
    try { const event = await getDocFromServer(eventRef); if (event.exists() && sameEvent(event.data())) return } catch { /* Preserva a falha original. */ }
    throw error
  }
}
export const settlementErrorMessage = (error: unknown) => error instanceof SettlementError ? error.message : 'Não foi possível confirmar. Confira a conexão e as regras e tente novamente.'
