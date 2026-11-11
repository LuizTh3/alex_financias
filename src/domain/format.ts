import { competenceSchema, todayCivil } from './calendar'

export const currentMonth = () => todayCivil().slice(0, 7)

export const formatMoney = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

const monthDate = (month: string) => new Date(`${competenceSchema.parse(month)}-01T00:00:00Z`)
/** "novembro de 2026" */
export const formatMonth = (month: string) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthDate(month))
/** "nov/26" */
export const formatShortMonth = (month: string) => {
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(monthDate(month)).replace('.', '')
  return `${name}/${month.slice(2, 4)}`
}
/** "2026-07-10" → "10/07/2026" */
export const formatDate = (date: string) => date.split('-').reverse().join('/')
/** "2026-07-10" → "10/07" */
export const formatDayMonth = (date: string) => formatDate(date).slice(0, 5)

/** Máscara de dinheiro digitado: só os dígitos contam, da direita para a esquerda ("67644" → "676,44"). */
export function maskMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11)
  if (!digits) return ''
  return centsToInput(Number(digits))
}
/** 67644 → "676,44"; 123456 → "1.234,56" (formato aceito por parseMoneyToCents). */
export const centsToInput = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
