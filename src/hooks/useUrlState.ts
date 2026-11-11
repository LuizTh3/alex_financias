import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { competenceSchema } from '../domain/calendar'
import { currentMonth } from '../domain/format'

/**
 * Um parâmetro da URL como estado. Recarregar a página ou compartilhar o link mantém a seleção.
 * `replace` evita encher o histórico a cada troca de mês.
 */
export function useSearchParam(key: string) {
  const [params, setParams] = useSearchParams()
  const value = params.get(key)
  const setValue = useCallback((next: string | null) => {
    setParams(current => {
      const updated = new URLSearchParams(current)
      if (next) updated.set(key, next)
      else updated.delete(key)
      return updated
    }, { replace: true })
  }, [key, setParams])
  return [value, setValue] as const
}

/** Mês selecionado (`?mes=YYYY-MM`); inválido ou ausente vira o mês atual. */
export function useMonthParam(key = 'mes') {
  const [value, setValue] = useSearchParam(key)
  const month = value && competenceSchema.safeParse(value).success ? value : currentMonth()
  const setMonth = useCallback((next: string) => setValue(next === currentMonth() ? null : next), [setValue])
  return [month, setMonth] as const
}
