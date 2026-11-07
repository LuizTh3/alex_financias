import { doc, getDocFromServer, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { entryInputSchema, generateInstallments, invoiceId, installmentId, sameEntryInput } from '../domain/entries'
import { financialSchemas, type FinancialRecord } from './financialSchemas'
import type { SaveEntryCommand } from './entryRepository'
import { applyInvoiceDelta } from '../domain/invoices'
const inputOf = (entry: Record<string, unknown>) => entryInputSchema.parse(Object.fromEntries(Object.keys(entryInputSchema.shape).map(key => [key, entry[key]])))
type Entry = FinancialRecord<'entries'>
export type ScheduleOperation = { entryId: string; mutationId: string; before: Omit<Entry, 'id'> | null; target: Omit<Entry, 'id'>; cursor: number; size: number; state: 'active' | 'done' }
const reference = (database: Firestore, uid: string) => doc(database, 'users', uid, 'scheduleOperations', 'current')
export async function startSchedule(uid: string, command: SaveEntryCommand, deleting = false) {
  if (!db) throw new Error('Firebase indisponível.')
  const database = db
  if (!/^[A-Za-z0-9_-]{1,76}$/.test(command.mutationId)) throw new Error('Identificador de operação inválido.')
  const input = entryInputSchema.parse(command.input)
  await runTransaction(database, async tx => {
    const opRef = reference(database, uid)
    const [opSnap, entrySnap] = await Promise.all([tx.get(opRef), tx.get(doc(database, 'users', uid, 'entries', command.entryId))])
    const op = opSnap.exists() ? opSnap.data() as ScheduleOperation : null
    if (op?.state === 'active') {
      if (op.mutationId === command.mutationId && op.entryId === command.entryId && !!op.target.deletedAt === deleting && sameEntryInput(op.target, input)) return
      throw new Error('Há um parcelamento em andamento. Conclua-o antes de continuar.')
    }
    const previous = entrySnap.exists() ? financialSchemas.entries.parse(entrySnap.data()) : null
    if (previous?.mutationId === command.mutationId && (deleting ? previous.deletedAt : sameEntryInput(previous, input))) return
    if ((previous?.revision ?? 0) !== command.expectedRevision || previous?.deletedAt) throw new Error('O lançamento mudou. Atualize os dados.')
    if (previous?.recurrenceId || command.recurrence) throw new Error('Ocorrências mensais não podem ser parceladas.')
    const category = await tx.get(doc(database, 'users', uid, 'categories', input.categoryId))
    if (!previous || previous.categoryId !== input.categoryId || previous.type !== input.type) {
      if (!category.exists() || !category.data().active || ![input.type, 'both'].includes(category.data().scope)) throw new Error('Selecione uma categoria ativa compatível.')
    }
    if (input.cardId) {
      const card = await tx.get(doc(database, 'users', uid, 'cards', input.cardId))
      if (previous?.cardId === input.cardId ? previous.dueDay !== input.dueDay : !card.exists() || !card.data().active || card.data().dueDay !== input.dueDay) throw new Error('Confira o cartão e seu vencimento.')
    }
    const beforeParts = previous ? generateInstallments(command.entryId, inputOf(previous)) : []
    const parts = await Promise.all(beforeParts.map(part => tx.get(doc(database, 'users', uid, 'installments', part.id))))
    for (const snap of parts) {
      if (!snap.exists()) throw new Error('Há parcelas faltantes. Corrija os dados antes de continuar.')
      const part = financialSchemas.installments.parse(snap.data())
      if (part.revision !== previous!.revision || part.settledAt || part.status === 'paid' || part.status === 'received') throw new Error('Desfaça as confirmações das parcelas antes de continuar.')
    }
    const targets = deleting ? [] : generateInstallments(command.entryId, input)
    const invoiceKeys = [...new Set([...beforeParts, ...targets].filter(part => part.cardId).map(part => invoiceId(part.cardId!, part.competence)))]
    const invoices = await Promise.all(invoiceKeys.map(key => tx.get(doc(database, 'users', uid, 'invoices', key))))
    if (invoices.some(snap => snap.exists() && snap.data().status === 'paid')) throw new Error('Desfaça o pagamento das faturas afetadas antes de continuar.')
    const target = { ...input, revision: (previous?.revision ?? 0) + 1, mutationId: command.mutationId, deletedAt: deleting ? serverTimestamp() : null, createdAt: previous?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() }
    tx.set(opRef, { entryId: command.entryId, mutationId: command.mutationId, before: previous, target, cursor: 0, size: Math.max(previous?.installmentCount ?? 0, deleting ? 0 : input.installmentCount), state: 'active', updatedAt: serverTimestamp() })
  })
  await resumeSchedule(uid)
}
export async function resumeSchedule(uid: string) {
  if (!db) throw new Error('Firebase indisponible')
  const database = db
  for (;;) {
    let attemptedCursor = -1
    let finished: boolean
    try { finished = await runTransaction(database, async tx => {
      const opRef = reference(database, uid)
      const snap = await tx.get(opRef)
      if (!snap.exists() || snap.data().state === 'done') return true
      const op = snap.data() as ScheduleOperation
      attemptedCursor = op.cursor
      const entryRef = doc(database, 'users', uid, 'entries', op.entryId)
      if (op.cursor === op.size) {
        tx.set(entryRef, { ...op.target, deletedAt: op.target.deletedAt ? serverTimestamp() : null, updatedAt: serverTimestamp() })
        tx.update(opRef, { state: 'done', updatedAt: serverTimestamp() })
        return true
      }
      const index = op.cursor + 1
      const partRef = doc(database, 'users', uid, 'installments', installmentId(op.entryId, index))
      const oldSnap = await tx.get(partRef)
      const old = oldSnap.exists() ? { ...financialSchemas.installments.parse(oldSnap.data()), id: oldSnap.id } : null
      const next = op.target.deletedAt ? null : generateInstallments(op.entryId, inputOf(op.target), op.target.revision)[index - 1] ?? null
      const keys = [...new Set([old, next].filter(part => part?.cardId).map(part => invoiceId(part!.cardId!, part!.competence)))]
      const invoiceSnaps = await Promise.all(keys.map(key => tx.get(doc(database, 'users', uid, 'invoices', key))))
      if (old && (old.settledAt || old.status === 'paid' || old.status === 'received')) throw new Error('Uma parcela já foi liquidada.')
      if (invoiceSnaps.some(snap => snap.exists() && snap.data().status === 'paid')) throw new Error('Uma fatura afetada está paga.')
      const nextKey = next?.cardId ? invoiceId(next.cardId, next.competence) : null
      const nextInvoice = invoiceSnaps.find(snap => snap.id === nextKey)
      if (next) {
        const { id: _, ...part } = next
        tx.set(partRef, { ...part, dueDate: nextInvoice?.exists() ? nextInvoice.data().dueDate : next.dueDate, settlementRevision: old?.settlementRevision ?? 0, lastSettlementEventId: old?.lastSettlementEventId ?? null, createdAt: old?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() })
      } else if (old) tx.delete(partRef)
      for (const invoice of invoiceSnaps) {
        const current = invoice.exists() ? financialSchemas.invoices.parse(invoice.data()) : null
        const matches = (part: typeof old | typeof next) => !!part?.cardId && invoiceId(part.cardId, part.competence) === invoice.id
        const balance = applyInvoiceDelta(current ?? { totalCents: 0, chargeCount: 0 }, old && matches(old) ? [old] : [], next && matches(next) ? [next] : [])
        const changes = { ...balance, revision: (current?.revision ?? 0) + 1, lastMutationId: `${op.mutationId}_${index}`, lastEntryId: op.entryId, lastEntryRevision: op.target.revision, updatedAt: serverTimestamp() }
        const ref = doc(database, 'users', uid, 'invoices', invoice.id)
        if (current) tx.update(ref, changes)
        else tx.set(ref, { ...changes, cardId: next!.cardId, competence: next!.competence, dueDate: next!.dueDate, status: 'pending', paidAt: null, paidAmountCents: null, originInstallmentId: next!.id, lastEventId: null, createdAt: serverTimestamp() })
      }
      tx.update(opRef, { cursor: index, updatedAt: serverTimestamp() })
      return false
    })
    } catch (error) {
      // A competing tab may commit the same cursor first; verify progress on the server.
      const current = await getDocFromServer(reference(database, uid))
      if (current.exists() && current.data().state === 'done') return
      if (attemptedCursor >= 0 && current.exists() && current.data().cursor > attemptedCursor) continue
      throw error
    }
    if (finished) return
  }
}
export async function removeSchedule(uid: string, entryId: string, revision: number, mutationId: string) {
  if (!db) throw new Error('Firebase indisponível')
  const snap = await getDocFromServer(doc(db, 'users', uid, 'entries', entryId))
  if (!snap.exists()) throw new Error('Lançamento inexistente')
  const previous = financialSchemas.entries.parse(snap.data())
  if (previous.deletedAt) return
  await startSchedule(uid, { entryId, expectedRevision: revision, mutationId, input: entryInputSchema.parse(Object.fromEntries(Object.keys(entryInputSchema.shape).map(key => [key, previous[key as keyof typeof previous]]))) }, true)
}
