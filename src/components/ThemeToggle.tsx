import { useState } from 'react'
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  return <button type="button" className="secondary theme-toggle" aria-pressed={dark} onClick={() => {
    const next = !dark
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    setDark(next)
    try { localStorage.setItem('alex-theme', next ? 'dark' : 'light') } catch { /* Tema funciona mesmo sem armazenamento. */ }
  }}><span aria-hidden="true">{dark ? '☾' : '☀'}</span> Tema escuro: {dark ? 'ativado' : 'desativado'}</button>
}
