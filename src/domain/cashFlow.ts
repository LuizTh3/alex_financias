import type { CommitmentView } from './commitments'
import { shiftMonth } from './finance'

export type CashMovement = {
  id: string
  amountCents: number
  date: string
  reversesId?: string
}
export function accountBalance(openingCents: number, movements: CashMovement[]) {
  if (!Number.isSafeInteger(openingCents)) throw new Error('Saldo inicial inválido')
  const ids = new Set<string>()
  const reversed = new Set<string>()
  const byId = new Map(movements.map(movement => [movement.id, movement]))
  let balance = openingCents
  for (const movement of movements) {
    if (ids.has(movement.id) || !Number.isSafeInteger(movement.amountCents)) throw new Error('Movimentação inválida ou duplicada')
    ids.add(movement.id)
    if (movement.reversesId) {
      const original = byId.get(movement.reversesId)
      if (!original || original.reversesId || reversed.has(original.id) || movement.amountCents !== -original.amountCents) throw new Error('Reversão inválida')
      reversed.add(original.id)
    }
    balance += movement.amountCents
    if (!Number.isSafeInteger(balance)) throw new Error('Saldo fora do limite')
  }
  return balance
}
/** Inclui atrasados no primeiro dia e carrega cada saldo uma única vez. */
export function projectCashFlow(balanceCents: number, items: CommitmentView[], today: string, months = 12) {
  if (!Number.isSafeInteger(balanceCents) || !Number.isInteger(months) || months < 1 || months > 120) throw new Error('Projeção inválida')
  const start = today.slice(0, 7)
  let balance = balanceCents
  let firstNegativeDate: string | null = balance < 0 ? today : null
  const pending = items.filter(item => !item.paid)
  const rows = Array.from({ length: months + 1 }, (_, index) => {
    const month = shiftMonth(start, index)
    const opening = balance
    const relevant = pending.filter(item => index === 0 ? item.dueDate.slice(0, 7) <= month : item.dueDate.slice(0, 7) === month)
    const days = new Map<string, number>()
    let incoming = 0, outgoing = 0
    for (const item of relevant) {
      if (!Number.isSafeInteger(item.amountCents) || item.amountCents < 0) throw new Error('Valor inválido')
      const date = item.dueDate < today ? today : item.dueDate
      const amount = item.income ? item.amountCents : -item.amountCents
      days.set(date, (days.get(date) ?? 0) + amount)
      if (item.income) incoming += item.amountCents
      else outgoing += item.amountCents
    }
    for (const [date, amount] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
      balance += amount
      if (!Number.isSafeInteger(balance)) throw new Error('Saldo fora do limite')
      if (balance < 0 && !firstNegativeDate) firstNegativeDate = date
    }
    return { month, opening, incoming, outgoing, closing: balance }
  })
  return { rows, firstNegativeDate }
}
