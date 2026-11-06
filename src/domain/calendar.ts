import { z } from 'zod'
export const competenceSchema = z.string().regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/, 'Informe uma competência válida (YYYY-MM).')
export const civilDateSchema = z.iso.date('Informe uma data válida.').refine(value => competenceSchema.safeParse(value.slice(0, 7)).success, 'Use uma data entre 1900 e 9999.')
export function shiftCompetence(month: string, offset: number): string {
  competenceSchema.parse(month)
  if (!Number.isInteger(offset)) throw new Error('O avanço deve ser um número inteiro de meses.')
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, number - 1 + offset, 1))
  return competenceSchema.parse(date.toISOString().slice(0, 7))
}
export function dueDateInMonth(month: string, day: number): string {
  competenceSchema.parse(month)
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Use um dia de 1 a 31.')
  const [year, number] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`
}
export function todayCivil(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Rio_Branco', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(item => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function suggestFirstCompetence(purchaseDate: string, closingDay: number, dueDay: number) {
  civilDateSchema.parse(purchaseDate)
  const month = purchaseDate.slice(0, 7)
  const closingDate = dueDateInMonth(month, closingDay)
  dueDateInMonth(month, dueDay)
  // Fechamento pertence ao ciclo deste mês; igualdade é uma sugestão, confirmada manualmente.
  const cycle = purchaseDate > closingDate ? shiftCompetence(month, 1) : month
  const competence = dueDay <= closingDay ? shiftCompetence(cycle, 1) : cycle
  return { competence, ambiguousClosingDate: purchaseDate === closingDate }
}
