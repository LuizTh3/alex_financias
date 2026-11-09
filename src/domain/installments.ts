import { competenceSchema, shiftCompetence } from './calendar'
import { splitCents } from './money'

/** Qualquer coisa parcelada: compra no cartão ou valor a receber. */
export type Installable = { totalCents: number; installmentCount: number; firstDueMonth: string }
export type Installment = { index: number; count: number; month: string; amountCents: number }

/** Quantidade de meses de `from` até `to` (negativa se `to` for anterior). */
export function monthDiff(from: string, to: string): number {
  competenceSchema.parse(from); competenceSchema.parse(to)
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/** Parcelas calculadas: nada é gravado além do item original. */
export function installmentsOf(item: Installable): Installment[] {
  return splitCents(item.totalCents, item.installmentCount).map((amountCents, offset) => ({
    index: offset + 1, count: item.installmentCount, month: shiftCompetence(item.firstDueMonth, offset), amountCents,
  }))
}

export function installmentInMonth(item: Installable, month: string): Installment | null {
  const offset = monthDiff(item.firstDueMonth, month)
  if (offset < 0 || offset >= item.installmentCount) return null
  return installmentsOf(item)[offset]
}

export const lastMonthOf = (item: Installable) => shiftCompetence(item.firstDueMonth, item.installmentCount - 1)

/** "À vista" ou "Parcela 7/12". */
export const installmentLabel = (installment: Pick<Installment, 'index' | 'count'>) =>
  installment.count === 1 ? 'À vista' : `Parcela ${installment.index}/${installment.count}`
