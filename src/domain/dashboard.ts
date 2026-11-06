import { shiftMonth } from './finance'
import type { CommitmentView } from './commitments'

/** Resumo por competência; faturas já vêm agrupadas, sem duplicar compras. */
export function summarizeDashboard(items: CommitmentView[], month: string, future = false) {
  const end = shiftMonth(month, 12)
  const visible = items.filter(item => future
    ? item.competence > month && item.competence <= end && !item.paid
    : item.competence === month)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
  const pending = visible.filter(item => !item.paid)
  const incoming = pending.filter(item => item.income).reduce((sum, item) => sum + item.amountCents, 0)
  const outgoing = pending.filter(item => !item.income).reduce((sum, item) => sum + item.amountCents, 0)
  return { visible, incoming, outgoing, balance: incoming - outgoing }
}
