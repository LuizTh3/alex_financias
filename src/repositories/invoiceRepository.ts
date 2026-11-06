import { doc, getDocFromServer, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
import { z } from 'zod'
import { db, personalUid } from '../lib/firebase'
import { financialSchemas } from './financialSchemas'
import { invoiceId } from '../domain/entries'
export class InvoiceError extends Error {}
export type InvoiceCommand = { invoiceId: string; mutationId: string; expectedRevision: number; expectedTotalCents: number; action: 'payment' | 'reversal' }
function ownerDb(uid: string): Firestore {
  if (!db || uid !== personalUid) throw new InvoiceError('Conta sem acesso às faturas.')
  return db
}
export async function changeInvoicePayment(uid: string, command: InvoiceCommand): Promise<void> {
  z.string().regex(/^[A-Za-z0-9_-]{1,80}__\d{4}-\d{2}$/).parse(command.invoiceId)
  z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).parse(command.mutationId)
  z.number().int().positive().parse(command.expectedRevision)
  const database = ownerDb(uid)
  const ref = doc(database, 'users', uid, 'invoices', command.invoiceId)
  const eventRef = doc(database, 'users', uid, 'invoiceEvents', command.mutationId)
  function sameEvent(data: unknown) {
    const event = financialSchemas.invoiceEvents.safeParse(data)
    return event.success && event.data.invoiceId === command.invoiceId && event.data.type === command.action
      && event.data.invoiceRevision === command.expectedRevision + 1 && event.data.amountCents === command.expectedTotalCents
  }
  try {
    await runTransaction(database, async transaction => {
      const [snapshot, previousEvent] = await Promise.all([transaction.get(ref), transaction.get(eventRef)])
      if (previousEvent.exists()) {
        if (sameEvent(previousEvent.data())) return
        throw new InvoiceError('Esta tentativa já foi usada para outra operação. Reabra a confirmação.')
      }
      if (!snapshot.exists()) throw new InvoiceError('Não há fatura materializada para este período.')
      const current = financialSchemas.invoices.parse(snapshot.data())
      if (invoiceId(current.cardId, current.competence) !== command.invoiceId) throw new InvoiceError('Fatura inválida.')
      if (current.revision !== command.expectedRevision || current.totalCents !== command.expectedTotalCents) throw new InvoiceError('A fatura mudou em outra aba. Confira os valores atualizados e confirme novamente.')
      if (command.action === 'payment' && (current.status !== 'pending' || current.chargeCount === 0 || current.totalCents <= 0)) throw new InvoiceError('Somente faturas pendentes com movimentação podem ser pagas.')
      if (command.action === 'reversal' && (current.status !== 'paid' || !current.paidAt || !current.paidAmountCents || !current.lastEventId)) throw new InvoiceError('Somente pagamentos confirmados podem ser desfeitos.')
      const revision = current.revision + 1
      const paying = command.action === 'payment'
      transaction.update(ref, {
        status: paying ? 'paid' : 'pending', paidAt: paying ? serverTimestamp() : null,
        paidAmountCents: paying ? current.totalCents : null, revision,
        lastMutationId: command.mutationId, lastEventId: command.mutationId, updatedAt: serverTimestamp(),
      })
      transaction.set(eventRef, {
        invoiceId: command.invoiceId, cardId: current.cardId, competence: current.competence, dueDate: current.dueDate,
        type: command.action, amountCents: paying ? current.totalCents : current.paidAmountCents,
        invoiceRevision: revision, paymentEventId: paying ? command.mutationId : current.lastEventId,
        paidAt: paying ? serverTimestamp() : current.paidAt,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    })
  } catch (error) {
    try { const event = await getDocFromServer(eventRef); if (event.exists() && sameEvent(event.data())) return } catch { /* Mantém a causa original. */ }
    throw error
  }
}
export function invoiceErrorMessage(error: unknown) {
  return error instanceof InvoiceError ? error.message : 'Não foi possível confirmar a operação. Confira a conexão e as regras publicadas e tente novamente.'
}
