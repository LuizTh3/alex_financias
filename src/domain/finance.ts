export type Month = string
import type { CardInput } from './catalog'
export type Card = CardInput & { id: string; active: boolean }
export type Commitment = { id: string; description: string; amountCents: number; dueDate: string; paid: boolean }
export function shiftMonth(month: Month, offset: number): Month {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, number - 1 + offset, 1))
  return date.toISOString().slice(0, 7)
}
export function currentMonth(): Month {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Rio_Branco', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`
}
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

// Datas civis são construídas no calendário, sem conversão de fuso.
export function dateInMonth(month: Month, day: number): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error('Competência ou dia inválido.')
  }
  const [year, number] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}
