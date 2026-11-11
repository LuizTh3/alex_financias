import { useEffect, useId, useRef, useState } from 'react'
import { shiftCompetence } from '../domain/calendar'
import { currentMonth, formatMonth } from '../domain/format'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Setas para o mês anterior/seguinte e um calendário de meses ao clicar no nome. */
export function MonthPicker({ value, onChange, label = 'Mês' }: { value: string; onChange: (month: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => Number(value.slice(0, 4)))
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])
  const pick = (month: string) => { onChange(month); setOpen(false) }
  const today = currentMonth()
  return <div className="month-picker-root" ref={root}>
    <div className="month-picker" role="group" aria-label={label}>
      <button type="button" aria-label="Mês anterior" onClick={() => onChange(shiftCompetence(value, -1))}>‹</button>
      <button type="button" className="month-picker-label" aria-expanded={open} aria-controls={panelId}
        onClick={() => { setYear(Number(value.slice(0, 4))); setOpen(!open) }}>
        {capitalize(formatMonth(value))}
      </button>
      <button type="button" aria-label="Próximo mês" onClick={() => onChange(shiftCompetence(value, 1))}>›</button>
    </div>
    {open && <div className="month-panel" id={panelId}>
      <div className="month-panel-year">
        <button type="button" aria-label="Ano anterior" onClick={() => setYear(year - 1)}>‹</button>
        <strong>{year}</strong>
        <button type="button" aria-label="Próximo ano" onClick={() => setYear(year + 1)}>›</button>
      </div>
      <div className="month-panel-grid">
        {MONTHS.map((name, index) => {
          const month = `${year}-${String(index + 1).padStart(2, '0')}`
          return <button type="button" key={month} aria-pressed={month === value} data-today={month === today || undefined} onClick={() => pick(month)}>{name}</button>
        })}
      </div>
      {value !== today && <button type="button" className="month-panel-today" onClick={() => pick(today)}>Ir para o mês atual</button>}
    </div>}
  </div>
}
