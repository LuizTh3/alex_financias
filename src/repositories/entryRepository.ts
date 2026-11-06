import { collection, doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp, type Firestore, type Transaction } from 'firebase/firestore'
import { z } from 'zod'
import { applyInvoiceDelta } from '../domain/invoices'
import { db, personalUid } from '../lib/firebase'
import { cardSchema, categorySchema } from '../domain/catalog'
import { entryInputSchema, generateInstallments, installmentId, invoiceId, sameEntryInput, type EntryInput } from '../domain/entries'
import { financialSchemas, type FinancialRecord } from './financialSchemas'

export class FinancialError extends Error {}
export type SaveEntryCommand = { entryId: string; mutationId: string; input: EntryInput; expectedRevision: number }
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)
function ownerDb(uid: string): Firestore {
  if (!db || !personalUid || uid !== personalUid) throw new FinancialError('Conta sem acesso ao motor financeiro.')
  return db
}
const conflict = () => new FinancialError('O lançamento foi alterado em outra aba. Reabra os dados antes de continuar.')
export function newEntryId(uid: string): string { return doc(collection(ownerDb(uid), 'users', uid, 'entries')).id }
export const newMutationId = () => crypto.randomUUID()

async function readCharges(transaction: Transaction, database: Firestore, uid: string, entryId: string, entry: FinancialRecord<'entries'> | null) {
  if (!entry) return []
  const snapshots = await Promise.all(Array.from({ length: entry.installmentCount }, (_, offset) =>
    transaction.get(doc(database, 'users', uid, 'installments', installmentId(entryId, offset + 1)))))
  return snapshots.map(snapshot => {
    if (!snapshot.exists()) throw new FinancialError('Há parcelas faltantes. O lançamento não pode ser alterado.')
    const item = financialSchemas.installments.parse(snapshot.data())
    if (item.revision !== entry.revision) throw new FinancialError('As parcelas não correspondem à versão do lançamento.')
    if (item.status === 'paid' || item.status === 'received' || item.settledAt !== null) throw new FinancialError('Desfaça as confirmações das parcelas afetadas antes de alterar ou excluir este lançamento.')
    return { ...item, id: snapshot.id }
  })
}
async function readInvoices(transaction: Transaction, database: Firestore, uid: string, charges: { cardId: string | null; competence: string }[]) {
  const ids = [...new Set(charges.filter(item => item.cardId).map(item => invoiceId(item.cardId!, item.competence)))]
  const snapshots = await Promise.all(ids.map(id => transaction.get(doc(database, 'users', uid, 'invoices', id))))
  return new Map(snapshots.map(snapshot => {
    const value = snapshot.exists() ? financialSchemas.invoices.parse(snapshot.data()) : null
    if (value?.status === 'paid') throw new FinancialError('Desfaça o pagamento das faturas afetadas antes de alterar suas cobranças.')
    return [snapshot.id, value] as const
  }))
}
function writeInvoiceBalances(
  transaction: Transaction, database: Firestore, uid: string, entryId: string, revision: number, mutationId: string,
  previous: { id: string; cardId: string | null; competence: string; amountCents: number; dueDate: string }[],
  next: { id: string; cardId: string | null; competence: string; amountCents: number; dueDate: string }[],
  invoices: Map<string, Omit<FinancialRecord<'invoices'>, 'id'> | null>,
) {
  for (const [key, current] of invoices) {
    const oldParts = previous.filter(part => part.cardId && invoiceId(part.cardId, part.competence) === key)
    const newParts = next.filter(part => part.cardId && invoiceId(part.cardId, part.competence) === key)
    const balance = applyInvoiceDelta(current ?? { totalCents: 0, chargeCount: 0 }, oldParts, newParts)
    const changes = { ...balance, revision: (current?.revision ?? 0) + 1, lastMutationId: mutationId, lastEntryId: entryId, lastEntryRevision: revision, updatedAt: serverTimestamp() }
    const ref = doc(database, 'users', uid, 'invoices', key)
    if (current) transaction.update(ref, changes)
    else {
      const origin = newParts[0]
      if (!origin) throw new FinancialError('Não foi possível materializar a fatura.')
      transaction.set(ref, { ...changes, cardId: origin.cardId, competence: origin.competence, dueDate: origin.dueDate,
        status: 'pending', paidAt: null, paidAmountCents: null, originInstallmentId: origin.id,
        lastEventId: null, createdAt: serverTimestamp() })
    }
  }
}
export async function saveEntry(uid: string, command: SaveEntryCommand): Promise<void> {
  const database = ownerDb(uid)
  identifier.parse(command.entryId); identifier.parse(command.mutationId)
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) throw conflict()
  const input = entryInputSchema.parse(command.input)
  const ref = doc(database, 'users', uid, 'entries', command.entryId)
  try { await runTransaction(database, async transaction => {
    const snapshot = await transaction.get(ref)
    const current = snapshot.exists() ? { ...financialSchemas.entries.parse(snapshot.data()), id: snapshot.id } : null
    if (current?.deletedAt) throw new FinancialError('Este lançamento já foi excluído e não pode ser recriado com o mesmo ID.')
    if (current?.mutationId === command.mutationId) {
      if (sameEntryInput(current, input)) return
      throw new FinancialError('Uma tentativa de envio foi reutilizada com dados diferentes. Reabra o formulário.')
    }
    if ((current?.revision ?? 0) !== command.expectedRevision) throw conflict()
    const revision = (current?.revision ?? 0) + 1
    // Todas as leituras ocorrem antes de qualquer escrita da transação.
    if (!current || current.categoryId !== input.categoryId || current.type !== input.type) {
      const category = await transaction.get(doc(database, 'users', uid, 'categories', input.categoryId))
      if (!category.exists()) throw new FinancialError('Categoria inexistente.')
      const value = categorySchema.parse({ name: category.data().name, scope: category.data().scope })
      if (!category.data().active || (value.scope !== 'both' && value.scope !== input.type)) throw new FinancialError('Selecione uma categoria ativa compatível com o tipo do lançamento.')
    }
    if (input.cardId) {
      if (current?.cardId === input.cardId) {
        if (current.dueDay !== input.dueDay) throw new FinancialError('O dia de vencimento deste lançamento já está registrado.')
      } else {
        const card = await transaction.get(doc(database, 'users', uid, 'cards', input.cardId))
        if (!card.exists()) throw new FinancialError('Cartão inexistente.')
        const value = cardSchema.parse({ name: card.data().name, color: card.data().color, closingDay: card.data().closingDay, dueDay: card.data().dueDay })
        if (!card.data().active) throw new FinancialError('Selecione um cartão ativo.')
        if (value.dueDay !== input.dueDay) throw new FinancialError('O cartão mudou. Reabra o formulário e confira a prévia dos vencimentos.')
      }
    }
    const oldCharges = await readCharges(transaction, database, uid, command.entryId, current)
    const planned = generateInstallments(command.entryId, input, revision)
    const invoices = await readInvoices(transaction, database, uid, [...oldCharges, ...planned])
    const audit = { updatedAt: serverTimestamp() }
    transaction.set(ref, { ...input, revision, mutationId: command.mutationId, deletedAt: null, createdAt: current?.createdAt ?? serverTimestamp(), ...audit })
    const oldMap = new Map(oldCharges.map(item => [item.id, item]))
    for (const part of planned) {
      const { id, ...data } = part
      const invoiceKey = part.cardId ? invoiceId(part.cardId, part.competence) : null
      const existingInvoice = invoiceKey ? invoices.get(invoiceKey) : null
      transaction.set(doc(database, 'users', uid, 'installments', id), {
        ...data, dueDate: existingInvoice?.dueDate ?? data.dueDate,
        createdAt: oldMap.get(id)?.createdAt ?? serverTimestamp(), ...audit,
      })
    }
    writeInvoiceBalances(transaction, database, uid, command.entryId, revision, command.mutationId, oldCharges, planned, invoices)
    const retained = new Set(planned.map(item => item.id))
    for (const old of oldCharges) if (!retained.has(old.id)) transaction.delete(doc(database, 'users', uid, 'installments', old.id))
  }) } catch (error) {
    // Dois envios em abas distintas podem disputar a mesma criação. Confirme no servidor
    // antes de tratar uma rejeição do commit concorrente como falha do usuário.
    try {
      const committed = await getDocFromServer(ref)
      if (committed.exists()) {
        const value = financialSchemas.entries.parse(committed.data())
        if (!value.deletedAt && value.mutationId === command.mutationId && sameEntryInput(value, input)) return
      }
    } catch { /* A falha original continua sendo a causa reportada. */ }
    throw error
  }
}
export async function deleteEntry(uid: string, entryId: string, expectedRevision: number, mutationId: string): Promise<void> {
  identifier.parse(entryId); identifier.parse(mutationId)
  const database = ownerDb(uid)
  const ref = doc(database, 'users', uid, 'entries', entryId)
  await runTransaction(database, async transaction => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw conflict()
    const current = { ...financialSchemas.entries.parse(snapshot.data()), id: snapshot.id }
    if (current.deletedAt) return // Tombstone impede recriação e torna a exclusão repetível.
    if (current.revision !== expectedRevision) throw conflict()
    const charges = await readCharges(transaction, database, uid, entryId, current)
    const invoices = await readInvoices(transaction, database, uid, charges)
    transaction.update(ref, { deletedAt: serverTimestamp(), updatedAt: serverTimestamp(), revision: current.revision + 1, mutationId })
    writeInvoiceBalances(transaction, database, uid, entryId, current.revision + 1, mutationId, charges, [], invoices)
    for (const item of charges) transaction.delete(doc(database, 'users', uid, 'installments', item.id))
  })
}
export function financialErrorMessage(error: unknown): string {
  return error instanceof FinancialError ? error.message : 'Não foi possível salvar. Confira a conexão, as regras e tente novamente.'
}
