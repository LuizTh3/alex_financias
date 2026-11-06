import { z } from 'zod'

const name = z.string().trim().min(1, 'Informe o nome.').max(120, 'Use até 120 caracteres.')
export const cardSchema = z.object({
  name,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida.'),
  closingDay: z.number().int('Informe um dia inteiro.').min(1, 'Use um dia de 1 a 31.').max(31, 'Use um dia de 1 a 31.'),
  dueDay: z.number().int('Informe um dia inteiro.').min(1, 'Use um dia de 1 a 31.').max(31, 'Use um dia de 1 a 31.'),
}).strict()
export const categorySchema = z.object({
  name,
  scope: z.enum(['expense', 'income', 'both'], { error: 'Selecione a aplicação da categoria.' }),
}).strict()
export type CardInput = z.infer<typeof cardSchema>
export type CategoryInput = z.infer<typeof categorySchema>
export type CatalogKind = 'cards' | 'categories'
export const scopeLabels: Record<CategoryInput['scope'], string> = {
  expense: 'Despesas', income: 'Recebimentos', both: 'Despesas e recebimentos',
}
