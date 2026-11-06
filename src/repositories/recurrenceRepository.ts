import { collection, doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore'
import { z } from 'zod'
import { db } from '../lib/firebase'
import { currentMonth } from '../domain/finance'
import { competenceSchema } from '../domain/calendar'
import { recurrenceInputSchema, recurrenceVersionId, occurrenceEntryId, occurrenceInput, type RecurrenceInput } from '../domain/recurrences'
import { financialSchemas, type FinancialRecord } from './financialSchemas'
import { saveEntry } from './entryRepository'
export class RecurrenceError extends Error {}
export type RecurrenceCommand = { id: string; mutationId: string; expectedRevision: number; effectiveFrom: string; action: 'configure' | 'pause' | 'end'; input?: RecurrenceInput }
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/)
function ownerDb(uid: string) {
  if (!db || !uid) throw new RecurrenceError('Conta sem acesso às recorrências.')
  return db
}
export const newRecurrenceId = (uid: string) => doc(collection(ownerDb(uid), 'users', uid, 'recurrences')).id
export async function saveRecurrence(uid: string, command: RecurrenceCommand) {
  const database = ownerDb(uid)
  idSchema.parse(command.id); z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).parse(command.mutationId)
  competenceSchema.parse(command.effectiveFrom)
  const rootRef = doc(database, 'users', uid, 'recurrences', command.id)
  const input = command.input ? recurrenceInputSchema.parse(command.input) : null
  const sameCommand = async (root: FinancialRecord<'recurrences'>) => {
    if (root.mutationId !== command.mutationId || root.latestFrom !== command.effectiveFrom) return false
    const snapshot = await getDocFromServer(doc(database, 'users', uid, 'recurrenceVersions', root.latestVersionId))
    if (!snapshot.exists()) return false
    const version = financialSchemas.recurrenceVersions.parse(snapshot.data())
    return version.action === command.action && (!input || Object.keys(input).every(key => input[key as keyof RecurrenceInput] === version[key as keyof RecurrenceInput]))
  }
  try {
    await runTransaction(database, async transaction => {
      const snapshot = await transaction.get(rootRef)
      const current = snapshot.exists() ? { ...financialSchemas.recurrences.parse(snapshot.data()), id: snapshot.id } : null
      const previousSnapshot = current ? await transaction.get(doc(database, 'users', uid, 'recurrenceVersions', current.latestVersionId)) : null
      const previous = previousSnapshot?.exists() ? financialSchemas.recurrenceVersions.parse(previousSnapshot.data()) : null
      if (current?.mutationId === command.mutationId) {
        if (current.latestFrom === command.effectiveFrom && previous?.action === command.action && (!input || Object.keys(input).every(key => input[key as keyof RecurrenceInput] === previous[key as keyof RecurrenceInput]))) return
        throw new RecurrenceError('A tentativa foi reutilizada com dados diferentes. Reabra o formulário.')
      }
      if ((current?.revision ?? 0) !== command.expectedRevision) throw new RecurrenceError('A recorrência mudou em outra aba. Reabra seus dados.')
      if (current?.state === 'ended') throw new RecurrenceError('Uma recorrência encerrada não pode ser retomada. Crie outra.')
      if (current && (!previous || previous.validUntil !== null || command.effectiveFrom < current.latestFrom || command.effectiveFrom < currentMonth())) throw new RecurrenceError('A nova vigência deve começar no mês atual ou futuro, sem alterar versões anteriores.')
      if (!current && command.action !== 'configure') throw new RecurrenceError('Cadastre a recorrência antes de pausar ou encerrar.')
      const value = command.action === 'configure' ? input : previous ? recurrenceInputSchema.parse({ ...(previous.type ? { type: previous.type } : {}), description: previous.description, amountCents: previous.amountCents, categoryId: previous.categoryId, paymentMethod: previous.paymentMethod, cardId: previous.cardId, dueDay: previous.dueDay }) : null
      if (!value) throw new RecurrenceError('Informe os dados da recorrência.')
      if (previous && (value.type ?? 'expense') !== (previous.type ?? 'expense')) throw new RecurrenceError('O tipo da recorrência não pode ser alterado.')
      if (!previous || value.categoryId !== previous.categoryId) {
        const category = await transaction.get(doc(database, 'users', uid, 'categories', value.categoryId))
        if (!category.exists() || category.data().active !== true || ![value.type ?? 'expense', 'both'].includes(category.data().scope)) throw new RecurrenceError('Selecione uma categoria ativa de despesas.')
      }
      if (value.cardId && (!previous || previous.cardId !== value.cardId)) {
        const card = await transaction.get(doc(database, 'users', uid, 'cards', value.cardId))
        if (!card.exists() || card.data().active !== true || card.data().dueDay !== value.dueDay) throw new RecurrenceError('Selecione um cartão ativo e confira seu vencimento padrão.')
      } else if (value.cardId && command.action === 'configure') {
        const card = await transaction.get(doc(database, 'users', uid, 'cards', value.cardId))
        if (!card.exists() || card.data().dueDay !== value.dueDay) throw new RecurrenceError('O vencimento do cartão mudou. Confira o padrão atual antes de salvar a versão.')
      }
      const revision = (current?.revision ?? 0) + 1
      const versionId = recurrenceVersionId(command.id, revision)
      if (current) transaction.update(doc(database, 'users', uid, 'recurrenceVersions', current.latestVersionId), { validUntil: command.effectiveFrom, updatedAt: serverTimestamp() })
      transaction.set(doc(database, 'users', uid, 'recurrenceVersions', versionId), { ...value, recurrenceId: command.id, revision,
        effectiveFrom: command.effectiveFrom, validUntil: null, action: command.action, active: command.action === 'configure', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      transaction.set(rootRef, { startCompetence: current?.startCompetence ?? command.effectiveFrom, latestFrom: command.effectiveFrom,
        latestVersionId: versionId, revision, state: command.action === 'configure' ? 'active' : command.action === 'pause' ? 'paused' : 'ended',
        mutationId: command.mutationId, createdAt: current?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() })
    })
  } catch (error) {
    try {
      const snapshot = await getDocFromServer(rootRef)
      if (snapshot.exists() && await sameCommand({ ...financialSchemas.recurrences.parse(snapshot.data()), id: snapshot.id })) return
    } catch { /* Preserva a falha original. */ }
    throw error
  }
}
export async function materializeOccurrence(uid: string, version: FinancialRecord<'recurrenceVersions'>, competence: string) {
  const database = ownerDb(uid)
  const id = occurrenceEntryId(version.recurrenceId, competence)
  const ref = doc(database, 'users', uid, 'entries', id)
  // A transação de saveEntry decide a criação; esta leitura só evita trabalho em ocorrências existentes.
  const exists = await getDocFromServer(ref)
  if (exists.exists()) return
  const card = version.cardId ? await getDocFromServer(doc(database, 'users', uid, 'cards', version.cardId)) : null
  if (version.cardId && !card?.exists()) throw new RecurrenceError('Cartão da recorrência não encontrado.')
  try {
    await saveEntry(uid, { entryId: id, mutationId: id, expectedRevision: 0,
      input: occurrenceInput(version, competence, card?.data()?.dueDay), recurrence: { id: version.recurrenceId, versionId: version.id } })
  } catch (error) {
    const committed = await getDocFromServer(ref)
    if (committed.exists() && committed.data().recurrenceId === version.recurrenceId && committed.data().firstCompetence === competence) return
    throw error
  }
}
export const recurrenceErrorMessage = (error: unknown) => error instanceof RecurrenceError ? error.message : 'Não foi possível salvar a recorrência. Confira a conexão, as referências e as regras publicadas.'
