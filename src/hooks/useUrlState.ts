import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { competenceSchema } from '../domain/calendar'
import { currentMonth } from '../domain/format'
import { defaultMonth } from '../domain/summary'
import { useCollection } from './useCollection'

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

/** Mês que as telas abrem por padrão: o atual, pulando os meses marcados como concluídos. */
export function useDefaultMonth() {
  const closed = useCollection('closedMonths')
  return defaultMonth(currentMonth(), closed.rows.map(row => row.month))
}

/**
 * Mês selecionado (`?mes=YYYY-MM`); inválido ou ausente vira o mês padrão (`useDefaultMonth`).
 * `pinMonth` grava o mês na URL mesmo sendo o padrão, para a tela não pular de mês quando o padrão muda.
 */
export function useMonthParam(key = 'mes') {
  const [value, setValue] = useSearchParam(key)
  const fallback = useDefaultMonth()
  const month = value && competenceSchema.safeParse(value).success ? value : fallback
  const setMonth = useCallback((next: string) => setValue(next === fallback ? null : next), [setValue, fallback])
  const pinMonth = useCallback((next: string) => setValue(next), [setValue])
  return [month, setMonth, { defaultMonth: fallback, pinMonth }] as const
}
