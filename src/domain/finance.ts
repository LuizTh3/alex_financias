export type Month = string
export type Card = { id: string; name: string; closingDay: number; dueDay: number }
export type Commitment = { id: string; description: string; amountCents: number; dueDate: string; paid: boolean }
export type Invoice = Commitment & { cardId: string }
export type FixedExpense = Commitment
export type Receivable = Commitment
export function shiftMonth(month: Month, offset: number): Month {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, number - 1 + offset, 1))
  return date.toISOString().slice(0, 7)
}
export function currentMonth(): Month {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
export function monthlyTotal(items: Commitment[], month: Month): number {
  return items.filter(item => item.dueDate.startsWith(`${month}-`) && !item.paid)
    .reduce((total, item) => total + item.amountCents, 0)
}
export const formatMoney = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
export function formatMonth(month: Month): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
}
