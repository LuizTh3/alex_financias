import { useEffect, useState } from 'react'

const FLAG = 'alex-welcome-splash'
const DURATION = 3400

/** Marca que a animação deve aparecer na próxima tela (chamado logo após o login). */
export function requestWelcomeSplash() {
  try { sessionStorage.setItem(FLAG, '1') } catch { /* sem armazenamento: apenas não exibe */ }
}

export function cancelWelcomeSplash() {
  try { sessionStorage.removeItem(FLAG) } catch { /* nada a fazer */ }
}

/** Só lê a marca (o StrictMode pode chamar o inicializador duas vezes); ela é apagada no efeito. */
function hasFlag() {
  try { return sessionStorage.getItem(FLAG) === '1' } catch { return false }
}

const BARS = [38, 52, 44, 66, 58, 80, 72, 94]

/**
 * Animação de boas-vindas exibida uma vez após o login: gráfico em ascensão, grade tecnológica,
 * cifrões flutuando e a mensagem "Bem-vindo". Clique ou Esc pulam; respeita "reduzir movimento".
 */
export function WelcomeSplash({ name }: { name?: string }) {
  const [phase, setPhase] = useState<'hidden' | 'show' | 'leave'>(() => hasFlag() ? 'show' : 'hidden')
  useEffect(() => {
    if (phase !== 'show') return
    cancelWelcomeSplash()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const leave = window.setTimeout(() => setPhase('leave'), reduced ? 1200 : DURATION)
    const skip = (event: KeyboardEvent) => { if (event.key === 'Escape' || event.key === 'Enter') setPhase('leave') }
    window.addEventListener('keydown', skip)
    return () => { window.clearTimeout(leave); window.removeEventListener('keydown', skip) }
  }, [phase])
  useEffect(() => {
    if (phase !== 'leave') return
    const done = window.setTimeout(() => setPhase('hidden'), 600)
    return () => window.clearTimeout(done)
  }, [phase])
  if (phase === 'hidden') return null

  return <div className={`welcome-splash ${phase === 'leave' ? 'is-leaving' : ''}`} role="status" aria-live="polite" onClick={() => setPhase('leave')}>
    <div className="welcome-splash-grid" aria-hidden="true" />
    <div className="welcome-splash-glow" aria-hidden="true" />
    {Array.from({ length: 10 }, (_, index) => <span key={index} className="welcome-splash-coin" aria-hidden="true"
      style={{ left: `${8 + index * 9}%`, animationDelay: `${(index % 5) * 0.35}s`, animationDuration: `${3 + (index % 3) * 0.6}s` }}>{index % 3 === 0 ? '%' : 'R$'}</span>)}

    <div className="welcome-splash-content">
      <svg className="welcome-splash-chart" viewBox="0 0 320 120" aria-hidden="true">
        <defs>
          <linearGradient id="splash-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8bd5aa" stopOpacity=".45" /><stop offset="1" stopColor="#8bd5aa" stopOpacity="0" /></linearGradient>
        </defs>
        {BARS.map((height, index) => <rect key={index} className="welcome-splash-bar" x={14 + index * 38} y={120 - height} width="20" height={height} rx="4"
          style={{ animationDelay: `${0.15 + index * 0.08}s` }} />)}
        <path className="welcome-splash-area" d="M4 104 L44 90 L84 96 L124 70 L164 78 L204 46 L244 56 L284 22 L316 10 L316 120 L4 120 Z" fill="url(#splash-area)" />
        <path className="welcome-splash-line" d="M4 104 L44 90 L84 96 L124 70 L164 78 L204 46 L244 56 L284 22 L316 10" pathLength="1" />
        <circle className="welcome-splash-dot" cx="316" cy="10" r="5" />
      </svg>
      <p className="welcome-splash-eyebrow">ALEX · FINANÇAS PESSOAIS</p>
      <h1 className="welcome-splash-title">Bem-vindo{name ? `, ${name}` : ''}</h1>
      <p className="welcome-splash-text">Seus cartões, faturas e rendas em um só lugar. Acompanhe o que vence, veja o saldo previsto e planeje os próximos meses com clareza.</p>
      <div className="welcome-splash-progress" aria-hidden="true"><span /></div>
    </div>
  </div>
}
