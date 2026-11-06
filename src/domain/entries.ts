import { z } from 'zod'
import { civilDateSchema, competenceSchema, dueDateInMonth, shiftCompetence } from './calendar'
import { MAX_INSTALLMENTS, MAX_TOTAL_CENTS, splitCents } from './money'
const id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, 'Identificador inválido.')
export const entryInputSchema = z.object({
  type: z.enum(['expense', 'income']),
  description: z.string().trim().min(1, 'Informe a descrição.').max(240, 'Use até 240 caracteres na descrição.'),
  totalCents: z.number().int().min(1).max(MAX_TOTAL_CENTS),
  categoryId: id,
  purchaseDate: civilDateSchema,
  paymentMethod: z.enum(['direct', 'card']),
  cardId: id.nullable(),
  installmentCount: z.number().int('A quantidade de parcelas deve ser inteira.').min(1, 'Informe pelo menos uma parcela.').max(MAX_INSTALLMENTS, `Use no máximo ${MAX_INSTALLMENTS} parcelas.`),
  firstCompetence: competenceSchema,
  dueDay: z.number().int('Informe um dia inteiro.').min(1, 'Use um dia de 1 a 31.').max(31, 'Use um dia de 1 a 31.'),
}).strict().superRefine((value, context) => {
  if (value.paymentMethod === 'card' && (!value.cardId || value.type !== 'expense')) context.addIssue({ code: 'custom', path: ['cardId'], message: 'Selecione um cartão para a despesa.' })
  if (value.paymentMethod === 'direct' && value.cardId !== null) context.addIssue({ code: 'custom', path: ['cardId'], message: 'Pagamento direto não usa cartão.' })
  if (value.totalCents < value.installmentCount) context.addIssue({ code: 'custom', path: ['totalCents'], message: 'Cada parcela deve ter pelo menos um centavo.' })
  try { shiftCompetence(value.firstCompetence, value.installmentCount - 1) } catch { context.addIssue({ code: 'custom', path: ['firstCompetence'], message: 'A última parcela ultrapassa o calendário permitido.' }) }
})
export type EntryInput = z.infer<typeof entryInputSchema>
export type Installment = {
  entryId: string; revision: number; index: number; count: number; amountCents: number;
  competence: string; dueDate: string; cardId: string | null; recurrenceId: null;
  status: 'pending' | 'paid' | 'received' | null; settledAt: null;
}
export type PlannedInstallment = Installment & { id: string }
export const installmentId = (entryId: string, index: number) => `${entryId}__${index}`
export const invoiceId = (cardId: string, competence: string) => `${cardId}__${competence}`
export function generateInstallments(entryId: string, raw: EntryInput, revision = 1): PlannedInstallment[] {
  id.parse(entryId)
  if (!Number.isInteger(revision) || revision < 1) throw new Error('Versão inválida.')
  const input = entryInputSchema.parse(raw)
  return splitCents(input.totalCents, input.installmentCount).map((amountCents, offset) => {
    const competence = shiftCompetence(input.firstCompetence, offset)
    return {
      id: installmentId(entryId, offset + 1), entryId, revision, index: offset + 1,
      count: input.installmentCount, amountCents, competence, dueDate: dueDateInMonth(competence, input.dueDay),
      cardId: input.cardId, recurrenceId: null, status: input.cardId ? null : 'pending', settledAt: null,
    }
  })
}
export function sameEntryInput(a: EntryInput, b: EntryInput): boolean {
  return Object.keys(entryInputSchema.shape).every(key => a[key as keyof EntryInput] === b[key as keyof EntryInput])
}
