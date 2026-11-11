import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useLocation } from 'react-router'
import { EyeIcon, EyeOffIcon, PiggyBankIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../contexts/AuthContext'
import { cancelWelcomeSplash, requestWelcomeSplash } from '../components/WelcomeSplash'

const schema = z.object({ email: z.email('Informe um e-mail válido.'), password: z.string().min(1, 'Informe sua senha.') })

const SLIDES = [
  { title: 'Todas as faturas na mão', text: 'Veja quanto vence em cada cartão, mês a mês, sem trocar de tela. Tudo organizado, claro e sempre por perto.' },
  { title: 'Parcelas sob controle', text: 'Lance compras em até 24x e acompanhe cada parcela até a última. Nada de surpresa no fim do mês.' },
  { title: 'Saldo previsto sem sustos', text: 'Renda menos faturas: descubra hoje como fecham os próximos 12 meses e planeje com calma.' },
]

function Logo({ large = false }: { large?: boolean }) {
  return <span className={`login-logo ${large ? 'is-large' : ''}`}><PiggyBankIcon aria-hidden="true" /><span>alex</span></span>
}

/** Dinheiro com asas, desenhado em SVG, flutuando. */
function FlyingMoney() {
  return <svg className="login-money" viewBox="0 0 220 150" aria-hidden="true">
    <g className="login-wing login-wing-left">
      <path d="M62 70 C30 40 8 48 4 62 C18 60 22 68 12 76 C26 74 30 82 22 90 C38 86 44 92 40 100 C54 92 62 86 70 80 Z" fill="#f4f1ea" stroke="#cfc8b8" strokeWidth="2" />
    </g>
    <g className="login-wing login-wing-right">
      <path d="M158 70 C190 40 212 48 216 62 C202 60 198 68 208 76 C194 74 190 82 198 90 C182 86 176 92 180 100 C166 92 158 86 150 80 Z" fill="#f4f1ea" stroke="#cfc8b8" strokeWidth="2" />
    </g>
    <g transform="rotate(-10 110 80)">
      <rect x="52" y="58" width="116" height="58" rx="6" fill="#5f8f5a" />
      <rect x="48" y="52" width="116" height="58" rx="6" fill="#86b37c" stroke="#4d7a49" strokeWidth="2" />
      <rect x="56" y="60" width="100" height="42" rx="4" fill="none" stroke="#4d7a49" strokeWidth="1.5" strokeDasharray="3 3" />
      <rect x="96" y="50" width="22" height="62" rx="3" fill="#f2c94c" stroke="#c99a2e" strokeWidth="2" />
      <circle cx="107" cy="81" r="13" fill="#f9e7a6" stroke="#c99a2e" strokeWidth="2" />
      <text x="107" y="87" textAnchor="middle" fontSize="17" fontWeight="800" fill="#7a5a12">$</text>
    </g>
  </svg>
}

export function LoginPage() {
  const { user, login, error } = useAuth()
  const [message, setMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [slide, setSlide] = useState(0)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  const from = (useLocation().state as { from?: string } | null)?.from
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setSlide(current => (current + 1) % SLIDES.length), 5000)
    return () => window.clearInterval(timer)
  }, [slide])
  // Volta para o link que se tentou abrir antes do login (ex.: /faturas?cartao=…), só dentro do app.
  if (user) return <Navigate to={from?.startsWith('/') && !from.startsWith('//') ? from : '/'} replace />

  const submit = handleSubmit(async values => {
    setMessage(null)
    // Marca antes do login: a tela inicial pode montar assim que a sessão muda.
    requestWelcomeSplash()
    try { await login(values.email, values.password) } catch { cancelWelcomeSplash(); setMessage('Não foi possível entrar. Verifique suas credenciais e se esta é a conta autorizada.') }
  })

  return <main className="login-page">
    <div className="login-shell">
      <section className="login-side">
        <Logo />
        <div className="login-box">
          <h1 className="login-title">Bem-vindo de volta!</h1>
          <p className="login-subtitle">Entre com seu e-mail e senha para continuar.</p>
          <form onSubmit={submit} noValidate className="mt-7 grid gap-4">
            <div>
              <Label htmlFor="email" className="sr-only">E-mail</Label>
              <Input id="email" className="login-input" type="email" placeholder="E-mail" autoComplete="username" {...register('email')} aria-invalid={!!errors.email} />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="password" className="sr-only">Senha</Label>
              <div className="relative">
                <Input id="password" className="login-input pr-12" type={showPassword ? 'text' : 'password'} placeholder="Senha" autoComplete="current-password" {...register('password')} aria-invalid={!!errors.password} />
                <button type="button" className="login-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>
            {(message || error) && <p role="alert" className="error mt-0">{message || error}</p>}
            <Button type="submit" className="login-submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Entrar'}</Button>
          </form>
          <p className="login-foot">Acesso exclusivo à sua conta pessoal.</p>
        </div>
      </section>
      <section className="login-showcase" aria-label="Sobre o Alex">
        <Logo large />
        <FlyingMoney />
        <div className="login-slides" aria-live="polite">
          {SLIDES.map((item, index) => <div key={item.title} className={`login-slide ${index === slide ? 'is-active' : ''}`} aria-hidden={index !== slide}>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </div>)}
        </div>
        <div className="login-dots" role="group" aria-label="Escolher destaque">
          {SLIDES.map((item, index) => <button key={item.title} type="button" aria-label={item.title} aria-current={index === slide} onClick={() => setSlide(index)} />)}
        </div>
      </section>
    </div>
  </main>
}
