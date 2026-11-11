import { useRef, useState, type ReactNode } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ZodError } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { parseMoneyToCents } from '../domain/money'

/** Rótulo + campo + mensagem de erro, com os atributos de acessibilidade ligados. */
export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return <div className="field">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {hint && !error && <p className="field-hint">{hint}</p>}
    {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
  </div>
}

/** Atributos de acessibilidade para um campo com erro. */
export const invalid = (id: string, error?: string) => ({ 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined })

/** Classe comum dos campos dos formulários (altura padrão do shadcn, igual à do NativeSelect). */
export const fieldClass = 'w-full'

export function FormActions({ busy, onCancel, submitLabel }: { busy: boolean; onCancel: () => void; submitLabel: string }) {
  return <div className="mt-6 flex justify-end gap-2">
    <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onCancel}>Cancelar</Button>
    <Button type="submit" size="lg" disabled={busy}>{busy ? 'Salvando…' : submitLabel}</Button>
  </div>
}

/** Envio protegido contra clique duplo, com mensagem de erro geral. */
export function useSubmit() {
  const locked = useRef(false)
  const [error, setError] = useState<string | null>(null)
  async function run(action: () => Promise<unknown>) {
    if (locked.current) return
    locked.current = true; setError(null)
    try { await action() } catch { setError('Não foi possível salvar. Confira a conexão e tente novamente.') } finally { locked.current = false }
  }
  return { error, run }
}

/** Converte o texto do campo de dinheiro; em caso de erro marca o campo e devolve null. */
export function readMoney<T extends FieldValues>(value: string, field: Path<T>, setError: UseFormSetError<T>): number | null {
  try { return parseMoneyToCents(value) } catch (failure) {
    setError(field, { message: value.trim() ? (failure as Error).message : 'Informe o valor.' })
    return null
  }
}

/** Leva os erros da validação do domínio para os campos do formulário (`rename` troca nomes, ex.: totalCents → amount). */
export function applyIssues<T extends FieldValues>(error: ZodError, setError: UseFormSetError<T>, rename: Record<string, string> = {}) {
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'root')
    setError((rename[key] ?? key) as Path<T>, { message: issue.message })
  }
}
