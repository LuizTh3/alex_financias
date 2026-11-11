import { useEffect, useState } from 'react'
import { PiggyBankIcon } from 'lucide-react'

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

/** Notas voando ao fundo: posições e ritmos variados. */
const BILLS = [
  { top: '12%', delay: '0s', duration: '6s', scale: '1' }, { top: '28%', delay: '1.2s', duration: '7s', scale: '.8' },
  { top: '68%', delay: '.5s', duration: '6.5s', scale: '1.1' }, { top: '84%', delay: '1.8s', duration: '7.5s', scale: '.9' },
  { top: '46%', delay: '2.4s', duration: '8s', scale: '.7' },
]

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
    {BILLS.map((bill, index) => <span key={index} className="welcome-splash-bill" aria-hidden="true"
      style={{ top: bill.top, animationDelay: bill.delay, animationDuration: bill.duration, scale: bill.scale }}>{'\u{1F4B8}'}</span>)}
    <div className="welcome-splash-card">
      <span className="welcome-splash-logo"><PiggyBankIcon aria-hidden="true" /><span>alex</span></span>
      <div className="welcome-splash-stage" aria-hidden="true">
        {[0, 1, 2].map(index => <span key={index} className="welcome-splash-drop" style={{ animationDelay: `${0.3 + index * 0.55}s`, left: `${44 + (index - 1) * 6}%` }}>R$</span>)}
        <PiggyBankIcon className="welcome-splash-pig" />
        <span className="welcome-splash-shadow" />
      </div>
      <h1 className="welcome-splash-title">Bem-vindo{name ? `, ${name}` : ''}!</h1>
      <p className="welcome-splash-text">Seus cartões, faturas e rendas em um só lugar. Acompanhe o que vence, veja o saldo previsto e planeje os próximos meses sem sustos.</p>
      <div className="welcome-splash-progress" aria-hidden="true"><span /></div>
      <p className="welcome-splash-hint">Contando suas moedinhas…</p>
    </div>
  </div>
}
