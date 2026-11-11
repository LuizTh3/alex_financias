import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { shiftCompetence } from '../domain/calendar'
import { currentMonth, formatMonth } from '../domain/format'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Setas para o mês anterior/seguinte e um calendário de meses (shadcn Popover) ao clicar no nome. */
export function MonthPicker({ value, onChange, label = 'Mês' }: { value: string; onChange: (month: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => Number(value.slice(0, 4)))
  const pick = (month: string) => { onChange(month); setOpen(false) }
  const today = currentMonth()
  return <div className="month-picker flex w-full items-center gap-1 sm:w-fit in-[.field]:w-full!" role="group" aria-label={label}>
    <Button type="button" variant="outline" size="icon-lg" aria-label="Mês anterior" onClick={() => onChange(shiftCompetence(value, -1))}><ChevronLeftIcon /></Button>
    <Popover open={open} onOpenChange={next => { if (next) setYear(Number(value.slice(0, 4))); setOpen(next) }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="lg" className="month-picker-label min-w-0 flex-1 font-semibold">{capitalize(formatMonth(value))}</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Ano anterior" onClick={() => setYear(year - 1)}><ChevronLeftIcon /></Button>
          <strong>{year}</strong>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Próximo ano" onClick={() => setYear(year + 1)}><ChevronRightIcon /></Button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {MONTHS.map((name, index) => {
            const month = `${year}-${String(index + 1).padStart(2, '0')}`
            const selected = month === value
            return <Button type="button" key={month} variant={selected ? 'default' : month === today ? 'outline' : 'ghost'} aria-pressed={selected} onClick={() => pick(month)}>{name}</Button>
          })}
        </div>
        {value !== today && <Button type="button" variant="link" size="sm" className="text-muted-foreground" onClick={() => pick(today)}>Ir para o mês atual</Button>}
      </PopoverContent>
    </Popover>
    <Button type="button" variant="outline" size="icon-lg" aria-label="Próximo mês" onClick={() => onChange(shiftCompetence(value, 1))}><ChevronRightIcon /></Button>
  </div>
}
