import { Timestamp } from 'firebase/firestore'
import { z } from 'zod'
import { entryInputSchema } from '../domain/entries'
import { civilDateSchema, competenceSchema } from '../domain/calendar'
import { recurrenceInputSchema } from '../domain/recurrences'
import { MAX_INVOICE_CENTS } from '../domain/invoices'
import { MAX_INSTALLMENTS, MAX_TOTAL_CENTS } from '../domain/money'
const audit = { createdAt: z.instanceof(Timestamp), updatedAt: z.instanceof(Timestamp) }
export const financialSchemas = {
  entries: entryInputSchema.safeExtend({
    recurrenceId: z.string().nullable().optional(), recurrenceVersionId: z.string().nullable().optional(),
    revision: z.number().int().positive(), mutationId: z.string().min(1), deletedAt: z.instanceof(Timestamp).nullable(), ...audit,
  }),
  installments: z.object({
    entryId: z.string(), revision: z.number().int().positive(), index: z.number().int().min(1).max(MAX_INSTALLMENTS),
    count: z.number().int().min(1).max(MAX_INSTALLMENTS), amountCents: z.number().int().min(1).max(MAX_TOTAL_CENTS),
    competence: competenceSchema, dueDate: civilDateSchema, cardId: z.string().nullable(), recurrenceId: z.string().nullable(),
    status: z.enum(['pending', 'paid', 'received']).nullable(), settledAt: z.instanceof(Timestamp).nullable(),
    settlementRevision: z.number().int().nonnegative().optional(), lastSettlementEventId: z.string().nullable().optional(), ...audit,
  }).strict(),
  invoices: z.object({
    cardId: z.string(), competence: competenceSchema, dueDate: civilDateSchema, status: z.enum(['pending', 'paid']),
    paidAt: z.instanceof(Timestamp).nullable(), paidAmountCents: z.number().int().nonnegative().nullable(),
    originInstallmentId: z.string(),
    totalCents: z.number().int().nonnegative().max(MAX_INVOICE_CENTS), chargeCount: z.number().int().nonnegative(),
    revision: z.number().int().positive(), lastMutationId: z.string(), lastEntryId: z.string(), lastEntryRevision: z.number().int().positive(),
    lastEventId: z.string().nullable(), ...audit,
  }).strict(),
  invoiceEvents: z.object({
    invoiceId: z.string(), cardId: z.string(), competence: competenceSchema, dueDate: civilDateSchema,
    type: z.enum(['payment', 'reversal']), amountCents: z.number().int().positive().max(MAX_INVOICE_CENTS),
    invoiceRevision: z.number().int().positive(), paymentEventId: z.string(), paidAt: z.instanceof(Timestamp), ...audit,
  }).strict(),
  recurrences: z.object({
    startCompetence: competenceSchema, latestFrom: competenceSchema, latestVersionId: z.string(),
    revision: z.number().int().positive(), state: z.enum(['active', 'paused', 'ended']), mutationId: z.string(), ...audit,
  }).strict(),
  recurrenceVersions: recurrenceInputSchema.safeExtend({
    recurrenceId: z.string(), revision: z.number().int().positive(), effectiveFrom: competenceSchema,
    validUntil: competenceSchema.nullable(), action: z.enum(['configure', 'pause', 'end']), active: z.boolean(), ...audit,
  }),
  settlementEvents: z.object({
    installmentId: z.string(), entryId: z.string(), entryRevision: z.number().int().positive(),
    type: z.enum(['payment', 'receipt', 'reversal']), amountCents: z.number().int().positive(), dueDate: civilDateSchema,
    settlementRevision: z.number().int().positive(), confirmationEventId: z.string(), confirmedAt: z.instanceof(Timestamp),
    description: z.string(), ...audit,
  }).strict(),
}
export type FinancialCollection = keyof typeof financialSchemas
export type FinancialRecord<K extends FinancialCollection> = z.infer<(typeof financialSchemas)[K]> & { id: string }
