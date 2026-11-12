import { z } from 'zod'
import { civilDateSchema, competenceSchema } from './calendar'
import { MAX_INSTALLMENTS, MAX_TOTAL_CENTS } from './money'

/** Dados digitados pelo usuário. Timestamps e `active` são acrescentados pelos repositórios. */
const text = (label: string, max = 120) => z.string().trim().min(1, `Informe ${label}.`).max(max, `Use até ${max} caracteres.`)
const description = z.string().trim().max(1000, 'Use até 1000 caracteres.').default('')
const cents = z.number().int('Use centavos inteiros.').min(1, 'Informe um valor maior que zero.').max(MAX_TOTAL_CENTS, 'Valor acima do limite permitido.')
const day = z.number().int().min(1, 'Use um dia de 1 a 31.').max(31, 'Use um dia de 1 a 31.')
const installmentCount = z.number().int().min(1, 'Use pelo menos 1 parcela.').max(MAX_INSTALLMENTS, `Use até ${MAX_INSTALLMENTS} parcelas.`)
const centsPerInstallment = (value: { totalCents: number; installmentCount: number }) => value.totalCents >= value.installmentCount

export const cardSchema = z.object({
  name: text('o nome do cartão'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida.'),
  closingDay: day,
  dueDay: day,
}).strict()

export const purchaseSchema = z.object({
  cardId: z.string().min(1, 'Selecione o cartão.'),
  title: text('o título da compra'),
  totalCents: cents,
  installmentCount,
  purchaseDate: civilDateSchema,
  firstDueMonth: competenceSchema,
  description,
}).strict().refine(centsPerInstallment, { message: 'Cada parcela precisa ter pelo menos um centavo.', path: ['installmentCount'] })

export const incomeSchema = z.object({
  title: text('o título da renda'),
  amountCents: cents,
  startMonth: competenceSchema,
  endMonth: competenceSchema.nullable(),
}).strict().refine(value => value.endMonth === null || value.endMonth >= value.startMonth, { message: 'O fim não pode ser antes do início.', path: ['endMonth'] })

/** Valor de um mês específico da despesa: 0 é permitido (ex.: mês sem cobrança). */
const monthCents = z.number().int('Use centavos inteiros.').min(0, 'O valor não pode ser negativo.').max(MAX_TOTAL_CENTS, 'Valor acima do limite permitido.')
export const MAX_EXPENSE_OVERRIDES = 240

/** Despesa mensal recorrente (fora dos cartões). `overrides` troca o valor só de meses específicos. */
export const expenseSchema = z.object({
  title: text('o título da despesa'),
  category: text('a categoria', 40),
  amountCents: cents,
  startMonth: competenceSchema,
  endMonth: competenceSchema.nullable(),
  overrides: z.record(competenceSchema, monthCents)
    .refine(value => Object.keys(value).length <= MAX_EXPENSE_OVERRIDES, 'Valores mensais demais.').default({}),
}).strict().refine(value => value.endMonth === null || value.endMonth >= value.startMonth, { message: 'O fim não pode ser antes do início.', path: ['endMonth'] })

export const receivableSchema = z.object({
  title: text('o título'),
  totalCents: cents,
  installmentCount,
  launchDate: civilDateSchema,
  firstDueMonth: competenceSchema,
  description,
  receivedIndexes: z.array(z.number().int().min(1).max(MAX_INSTALLMENTS)).default([]),
}).strict()
  .refine(centsPerInstallment, { message: 'Cada parcela precisa ter pelo menos um centavo.', path: ['installmentCount'] })
  .refine(value => value.receivedIndexes.every(index => index <= value.installmentCount) && new Set(value.receivedIndexes).size === value.receivedIndexes.length,
    { message: 'Parcelas recebidas inválidas.', path: ['receivedIndexes'] })

export type CardInput = z.infer<typeof cardSchema>
export type PurchaseInput = z.infer<typeof purchaseSchema>
export type IncomeInput = z.infer<typeof incomeSchema>
export type ReceivableInput = z.infer<typeof receivableSchema>
export type ExpenseInput = z.infer<typeof expenseSchema>
export type Expense = ExpenseInput & { id: string }
/** Documento `closedMonths/{YYYY-MM}`: existir significa mês marcado como concluído. */
export type ClosedMonth = { id: string; month: string }

export type Card = CardInput & { id: string; active: boolean }
export type Purchase = PurchaseInput & { id: string }
export type Income = IncomeInput & { id: string }
export type Receivable = ReceivableInput & { id: string }
/** Documento `invoiceStatus/{cardId}_{YYYY-MM}`: existir significa fatura marcada como paga. */
export type InvoiceStatus = { id: string; cardId: string; month: string }

export const invoiceStatusId = (cardId: string, month: string) => `${cardId}_${competenceSchema.parse(month)}`
