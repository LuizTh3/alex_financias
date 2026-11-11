import { useRef, useState, type ReactNode } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ZodError } from 'zod'
import { parseMoneyToCents } from '../domain/money'

/** Rótulo + campo + mensagem de erro, com os atributos de acessibilidade ligados. */
export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && !error && <p className="field-hint">{hint}</p>}
    {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
  </div>
}

/** Atributos de acessibilidade para um campo com erro. */
export const invalid = (id: string, error?: string) => ({ 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined })

export function FormActions({ busy, onCancel, submitLabel }: { busy: boolean; onCancel: () => void; submitLabel: string }) {
  return <div className="modal-actions">
    <button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
    <button type="submit" className="primary" disabled={busy}>{busy ? 'Salvando…' : submitLabel}</button>
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
