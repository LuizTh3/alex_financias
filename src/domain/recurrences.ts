import { z } from 'zod'
import { competenceSchema, dueDateInMonth } from './calendar'
import { MAX_TOTAL_CENTS } from './money'
import type { EntryInput } from './entries'
export const recurrenceInputSchema = z.object({
  type: z.enum(['expense', 'income']).optional(),
  description: z.string().trim().min(1, 'Informe a descrição.').max(240),
  amountCents: z.number().int().min(1).max(MAX_TOTAL_CENTS),
  categoryId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  paymentMethod: z.enum(['direct', 'card']), cardId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).nullable(),
  dueDay: z.number().int().min(1).max(31),
}).strict().superRefine((value, context) => {
  if (value.type === 'income' && value.paymentMethod !== 'direct') context.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Renda deve ser recebida diretamente.' })
  if ((value.paymentMethod === 'card') !== !!value.cardId) context.addIssue({ code: 'custom', path: ['cardId'], message: 'Selecione um cartão para cobrança em cartão; pagamento direto não usa cartão.' })
})
export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>
export type RecurrenceVersion = RecurrenceInput & {
  id: string; recurrenceId: string; revision: number; effectiveFrom: string; validUntil: string | null;
  action: 'configure' | 'pause' | 'end'; active: boolean;
}
export const recurrenceVersionId = (id: string, revision: number) => `${id}__${revision}`
export const occurrenceEntryId = (id: string, competence: string) => `occ_${id}_${competence}`
export function versionForMonth(versions: RecurrenceVersion[], recurrenceId: string, competence: string): RecurrenceVersion | null {
  competenceSchema.parse(competence)
  return versions.filter(version => version.recurrenceId === recurrenceId && version.effectiveFrom <= competence
    && (!version.validUntil || competence < version.validUntil)).sort((a, b) => b.revision - a.revision)[0] ?? null
}
export function occurrenceInput(version: RecurrenceVersion, competence: string, cardDueDay = version.dueDay): EntryInput {
  if (!version.active || version.effectiveFrom > competence || (version.validUntil && competence >= version.validUntil)) throw new Error('A recorrência não está vigente nesta competência.')
  return { type: version.type ?? 'expense', description: version.description, totalCents: version.amountCents, categoryId: version.categoryId,
    purchaseDate: dueDateInMonth(competence, 1), paymentMethod: version.paymentMethod, cardId: version.cardId,
    installmentCount: 1, firstCompetence: competence, dueDay: version.cardId ? cardDueDay : version.dueDay }
}
export function projectRecurrences(competence: string, roots: { id: string }[], versions: RecurrenceVersion[], entries: { id: string; recurrenceId?: string | null; firstCompetence: string }[], cards: { id: string; dueDay: number }[] = []) {
  return roots.flatMap(root => {
    const version = versionForMonth(versions, root.id, competence)
    const id = occurrenceEntryId(root.id, competence)
    // Inclui tombstones para não ressuscitar ocorrências excluídas individualmente.
    if (entries.some(entry => entry.id === id) || !version?.active) return []
    return [{ id, recurrenceId: root.id, versionId: version.id, input: occurrenceInput(version, competence, cards.find(card => card.id === version.cardId)?.dueDay) }]
  })
}
export function fixedBlockSituation(items: { paid: boolean }[]) {
  return items.length === 0 ? 'Sem gastos' : items.every(item => item.paid) ? 'Pago' : 'Pendente'
}
