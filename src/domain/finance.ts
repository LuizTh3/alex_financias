export type Month = string
import type { CardInput } from './catalog'
export type Card = CardInput & { id: string; active: boolean }
export type Commitment = { id: string; description: string; amountCents: number; dueDate: string; paid: boolean }
export { shiftCompetence as shiftMonth, dueDateInMonth as dateInMonth } from './calendar'
import { todayCivil } from './calendar'
export function currentMonth(): Month { return todayCivil().slice(0, 7) }
export function monthlyTotal(items: Commitment[], month: Month): number {
  return items.filter(item => item.dueDate.startsWith(`${month}-`) && !item.paid)
    .reduce((total, item) => total + item.amountCents, 0)
}
export const formatMoney = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
export function formatMonth(month: Month): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
}

export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Rio_Branco', dateStyle: 'short', timeStyle: 'short' }).format(date)
}
