import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
const schema = z.object({ email: z.email('Informe um e-mail válido.'), password: z.string().min(1, 'Informe sua senha.') })
export function LoginPage() {
  const { user, login, error } = useAuth()
  const [message, setMessage] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  if (user) return <Navigate to="/" replace />
  return <main className="login"><section className="login-intro"><p className="eyebrow">ALEX / FINANÇAS PESSOAIS</p><h1>Clareza para cuidar<br />do seu dinheiro.</h1><p>Seus cartões, compromissos e próximos passos em um só lugar.</p><span className="intro-footer">Organize o presente. Planeje o futuro.</span></section><section className="login-form"><div className="w-full max-w-sm"><p className="eyebrow">SEU ESPAÇO PESSOAL</p><h2>Bem-vindo de volta</h2><p className="muted mb-8">Entre com sua conta para continuar.</p><form onSubmit={handleSubmit(async values => {
    setMessage(null)
    try { await login(values.email, values.password) } catch { setMessage('Não foi possível entrar. Verifique suas credenciais e se esta é a conta autorizada.') }
  })} noValidate><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="username" {...register('email')} aria-invalid={!!errors.email} />{errors.email && <p className="error">{errors.email.message}</p>}<label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" {...register('password')} aria-invalid={!!errors.password} />{errors.password && <p className="error">{errors.password.message}</p>}{(message || error) && <p role="alert" className="error">{message || error}</p>}<button className="primary w-full mt-6" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Entrar'}</button></form><p className="muted text-sm mt-6">Acesso exclusivo à sua conta pessoal.</p></div></section></main>
}
