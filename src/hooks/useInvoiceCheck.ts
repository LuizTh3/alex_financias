import { useEffect, useState } from 'react'

/**
 * Marcações de conferência da fatura: puramente visuais, não alteram nenhum dado.
 * Ficam só neste navegador (localStorage), separadas por cartão e mês.
 */
export function useInvoiceCheck(cardId: string | undefined, month: string) {
  const key = cardId ? `conferencia:${cardId}:${month}` : null
  const [checked, setChecked] = useState<Set<string>>(() => load(key))

  useEffect(() => { setChecked(load(key)) }, [key])

  const save = (next: Set<string>) => {
    setChecked(next)
    if (!key) return
    try { localStorage.setItem(key, JSON.stringify([...next])) } catch { /* sem armazenamento: segue só em memória */ }
  }

  return {
    isChecked: (id: string) => checked.has(id),
    toggle: (id: string, on: boolean) => {
      const next = new Set(checked)
      if (on) next.add(id); else next.delete(id)
      save(next)
    },
    setAll: (ids: string[], on: boolean) => {
      const next = new Set(checked)
      for (const id of ids) if (on) next.add(id); else next.delete(id)
      save(next)
    },
  }
}

function load(key: string | null): Set<string> {
  if (!key) return new Set()
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? JSON.parse(raw) as string[] : [])
  } catch { return new Set() }
}
