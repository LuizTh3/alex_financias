import { Timestamp } from 'firebase/firestore'
import { z } from 'zod'
import { entryInputSchema } from '../domain/entries'
import { civilDateSchema, competenceSchema } from '../domain/calendar'
import { MAX_INVOICE_CENTS } from '../domain/invoices'
import { MAX_INSTALLMENTS, MAX_TOTAL_CENTS } from '../domain/money'
const audit = { createdAt: z.instanceof(Timestamp), updatedAt: z.instanceof(Timestamp) }
export const financialSchemas = {
  entries: entryInputSchema.safeExtend({
    revision: z.number().int().positive(), mutationId: z.string().min(1), deletedAt: z.instanceof(Timestamp).nullable(), ...audit,
  }),
  installments: z.object({
    entryId: z.string(), revision: z.number().int().positive(), index: z.number().int().min(1).max(MAX_INSTALLMENTS),
    count: z.number().int().min(1).max(MAX_INSTALLMENTS), amountCents: z.number().int().min(1).max(MAX_TOTAL_CENTS),
    competence: competenceSchema, dueDate: civilDateSchema, cardId: z.string().nullable(), recurrenceId: z.string().nullable(),
    status: z.enum(['pending', 'paid', 'received']).nullable(), settledAt: z.instanceof(Timestamp).nullable(), ...audit,
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
}
export type FinancialCollection = keyof typeof financialSchemas
export type FinancialRecord<K extends FinancialCollection> = z.infer<(typeof financialSchemas)[K]> & { id: string }
