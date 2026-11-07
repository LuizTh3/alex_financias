import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { applicationDefault, initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
const identifier = /^[A-Za-z0-9_-]{1,80}$/
const MAX_CENTS = 999_999_999_999
const token = (prefix, value) => `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 32)}`
function requireValue(condition, message) { if (!condition) throw new Error(message) }

/** Ferramenta administrativa isolada do app web. Padrão: conferir sem gravar. */
export async function migrateInvoiceBalances(database, uid, { apply = false } = {}) {
  requireValue(typeof uid === 'string' && identifier.test(uid), 'UID inválido.')
  const root = database.collection('users').doc(uid)
  const invoices = await root.collection('invoices').get()
  const report = []
  for (const candidate of invoices.docs) {
    const result = await database.runTransaction(async transaction => {
      const snapshot = await transaction.get(candidate.ref)
      requireValue(snapshot.exists, 'Uma fatura foi removida durante a conferência.')
      const invoice = snapshot.data()
      requireValue(typeof invoice.cardId === 'string' && identifier.test(invoice.cardId) && /^\d{4}-(0[1-9]|1[0-2])$/.test(invoice.competence), `Identidade inválida: ${snapshot.id}`)
      requireValue(snapshot.id === `${invoice.cardId}__${invoice.competence}`, `ID incompatível: ${snapshot.id}`)
      const charges = await transaction.get(root.collection('installments').where('cardId', '==', invoice.cardId).where('competence', '==', invoice.competence))
      for (const part of charges.docs) requireValue(typeof part.data().entryId === 'string' && identifier.test(part.data().entryId), `Referência inválida: ${part.id}`)
      const entryIds = [...new Set(charges.docs.map(part => part.data().entryId))]
      const entrySnapshots = entryIds.length ? await transaction.getAll(...entryIds.map(id => root.collection('entries').doc(id))) : []
      const entries = new Map(entrySnapshots.map(entry => [entry.id, entry.exists ? entry.data() : null]))
      let totalCents = 0
      for (const part of charges.docs) {
        const value = part.data(); const entry = entries.get(value.entryId)
        requireValue(entry && entry.deletedAt === null && entry.cardId === invoice.cardId && entry.paymentMethod === 'card', `Vínculo inválido: ${part.id}`)
        requireValue(Number.isSafeInteger(entry.totalCents) && entry.totalCents > 0 && Number.isInteger(entry.installmentCount) && entry.installmentCount >= 1 && entry.installmentCount <= 24, `Lançamento inválido: ${value.entryId}`)
        requireValue(Number.isInteger(value.index) && value.index >= 1 && value.index <= entry.installmentCount, `Índice inválido: ${part.id}`)
        const expected = Math.floor(entry.totalCents / entry.installmentCount) + (value.index <= entry.totalCents % entry.installmentCount ? 1 : 0)
        const [year, month] = entry.firstCompetence.split('-').map(Number)
        const competence = new Date(Date.UTC(year, month - 1 + value.index - 1, 1)).toISOString().slice(0, 7)
        requireValue(part.id === `${value.entryId}__${value.index}` && value.revision === entry.revision && value.count === entry.installmentCount
          && value.competence === competence && value.competence === invoice.competence && value.dueDate === invoice.dueDate
          && value.amountCents === expected && value.status === null && value.settledAt === null, `Cobrança inconsistente: ${part.id}`)
        totalCents += expected
      }
      requireValue(Number.isSafeInteger(totalCents) && totalCents >= 0 && totalCents <= MAX_CENTS, `Saldo fora do limite: ${snapshot.id}`)
      const chargeCount = charges.size
      requireValue(invoice.status === 'pending' || invoice.status === 'paid', `Situação inválida: ${snapshot.id}`)
      requireValue(invoice.createdAt instanceof Timestamp && invoice.updatedAt instanceof Timestamp, `Auditoria ausente: ${snapshot.id}`)
      requireValue(/^\d{4}-\d{2}-\d{2}$/.test(invoice.dueDate), `Vencimento inválido: ${snapshot.id}`)
      const origin = /^(.*)__([1-9]|1[0-9]|2[0-4])$/.exec(invoice.originInstallmentId ?? '')
      requireValue(origin && identifier.test(origin[1]), `Origem inválida: ${snapshot.id}`)
      const paid = invoice.status === 'paid'
      requireValue(paid ? chargeCount > 0 && invoice.paidAmountCents === totalCents && invoice.paidAt instanceof Timestamp
        : invoice.paidAmountCents === null && invoice.paidAt === null, `Liquidação divergente: ${snapshot.id}`)
      const fields = ['totalCents', 'chargeCount', 'revision', 'lastMutationId', 'lastEntryId', 'lastEntryRevision', 'lastEventId']
      if (fields.some(field => field in invoice)) {
        requireValue(fields.every(field => field in invoice) && Number.isInteger(invoice.revision) && invoice.revision >= 1
          && typeof invoice.lastMutationId === 'string' && identifier.test(invoice.lastMutationId)
          && typeof invoice.lastEntryId === 'string' && identifier.test(invoice.lastEntryId)
          && Number.isInteger(invoice.lastEntryRevision) && invoice.lastEntryRevision >= 1
          && (invoice.lastEventId === null || typeof invoice.lastEventId === 'string' && identifier.test(invoice.lastEventId)), `Cabeçalho parcialmente atualizado: ${snapshot.id}`)
        requireValue(invoice.totalCents === totalCents && invoice.chargeCount === chargeCount, `Saldo materializado divergente: ${snapshot.id}`)
        return { invoiceId: snapshot.id, action: 'already-current', totalCents, chargeCount }
      }
      const migrationId = token('migration', snapshot.id)
      const eventId = token('legacy_payment', snapshot.id)
      const eventRef = root.collection('invoiceEvents').doc(eventId)
      if (paid) requireValue(!(await transaction.get(eventRef)).exists, `Histórico já existe sem cabeçalho migrado: ${snapshot.id}`)
      const event = paid ? {
        invoiceId: snapshot.id, cardId: invoice.cardId, competence: invoice.competence, dueDate: invoice.dueDate,
        type: 'payment', amountCents: invoice.paidAmountCents, invoiceRevision: 1, paymentEventId: eventId,
        paidAt: invoice.paidAt, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      } : null
      if (apply) {
        transaction.update(candidate.ref, {
          totalCents, chargeCount, revision: 1, lastMutationId: paid ? eventId : migrationId,
          lastEntryId: origin[1], lastEntryRevision: entries.get(origin[1])?.revision ?? 1,
          lastEventId: paid ? eventId : null, updatedAt: FieldValue.serverTimestamp(),
        })
        if (event) transaction.create(eventRef, event)
      }
      return { invoiceId: snapshot.id, action: apply ? 'migrated' : 'would-migrate', totalCents, chargeCount, originalPaymentPreserved: paid }
    })
    report.push(result)
  }
  return report
}

async function main() {
  const args = process.argv.slice(2)
  const value = flag => args[args.indexOf(flag) + 1]
  const projectId = args.includes('--project') ? value('--project') : null
  const uid = args.includes('--uid') ? value('--uid') : null
  requireValue(projectId && uid, 'Uso: npm run migrate:invoices -- --project PROJETO --uid UID [--apply]')
  const emulator = !!process.env.FIRESTORE_EMULATOR_HOST
  requireValue(!emulator || projectId.startsWith('demo-'), 'No emulador, use um projeto demo-.')
  const app = initializeApp({ projectId, ...(emulator ? {} : { credential: applicationDefault() }) })
  try {
    const apply = args.includes('--apply')
    console.log(apply ? 'Aplicando migração administrativa. Suspenda outros clientes e mantenha backup.' : 'Conferência: nenhum documento será gravado.')
    if (apply) await migrateInvoiceBalances(getFirestore(app), uid) // Pré-conferência de todas as faturas antes da aplicação.
    console.log(JSON.stringify(await migrateInvoiceBalances(getFirestore(app), uid, { apply }), null, 2))
  } finally { await deleteApp(app) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
