export const MAX_TOTAL_CENTS = 999_999_999
export const MAX_INSTALLMENTS = 24
export function assertCents(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_TOTAL_CENTS) throw new Error('Informe um total entre R$ 0,01 e R$ 9.999.999,99.')
}
// String decimal brasileira -> inteiro. Não usa parseFloat nem multiplicação de ponto flutuante.
export function parseMoneyToCents(input: string): number {
  const value = input.trim().replace(/^R\$\s*/, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) throw new Error('Informe um valor como 100,00 ou 1.234,56.')
  const [whole, fraction = ''] = value.replaceAll('.', '').split(',')
  if (whole.length > 12) throw new Error('Valor acima do limite permitido.')
  const cents = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')))
  assertCents(cents)
  return cents
}
export function splitCents(totalCents: number, count: number): number[] {
  assertCents(totalCents)
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) throw new Error(`Use de 1 a ${MAX_INSTALLMENTS} parcelas.`)
  if (totalCents < count) throw new Error('Cada parcela precisa ter pelo menos um centavo.')
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}
