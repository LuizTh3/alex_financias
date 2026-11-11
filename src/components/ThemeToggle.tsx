import { useState } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  return <Button type="button" variant="outline" className="mt-5 h-auto min-h-8 w-full justify-start py-1.5 text-left whitespace-normal" aria-pressed={dark} onClick={() => {
    const next = !dark
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    setDark(next)
    try { localStorage.setItem('alex-theme', next ? 'dark' : 'light') } catch { /* Tema funciona mesmo sem armazenamento. */ }
  }}>{dark ? <MoonIcon data-icon="inline-start" /> : <SunIcon data-icon="inline-start" />}Tema escuro: {dark ? 'ativado' : 'desativado'}</Button>
}
