import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
const schema = z.object({ email: z.email('Informe um e-mail válido.'), password: z.string().min(1, 'Informe sua senha.') })
export function LoginPage() {
  const { user, login, error } = useAuth()
  const [message, setMessage] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  const from = (useLocation().state as { from?: string } | null)?.from
  // Volta para o link que se tentou abrir antes do login (ex.: /faturas?cartao=…), só dentro do app.
  if (user) return <Navigate to={from?.startsWith('/') && !from.startsWith('//') ? from : '/'} replace />
  return <main className="login"><section className="login-intro"><p className="eyebrow">ALEX / FINANÇAS PESSOAIS</p><h1>Clareza para cuidar<br />do seu dinheiro.</h1><p>Seus cartões, compromissos e próximos passos em um só lugar.</p><span className="intro-footer">Organize o presente. Planeje o futuro.</span></section><section className="login-form"><div className="w-full max-w-sm"><p className="eyebrow">SEU ESPAÇO PESSOAL</p><h2>Bem-vindo de volta</h2><p className="muted mb-8">Entre com sua conta para continuar.</p><form onSubmit={handleSubmit(async values => {
    setMessage(null)
    try { await login(values.email, values.password) } catch { setMessage('Não foi possível entrar. Verifique suas credenciais e se esta é a conta autorizada.') }
  })} noValidate><Label htmlFor="email" className="mb-2">E-mail</Label><Input id="email" className="h-10" type="email" autoComplete="username" {...register('email')} aria-invalid={!!errors.email} />{errors.email && <p className="error">{errors.email.message}</p>}<Label htmlFor="password" className="mt-5 mb-2">Senha</Label><Input id="password" className="h-10" type="password" autoComplete="current-password" {...register('password')} aria-invalid={!!errors.password} />{errors.password && <p className="error">{errors.password.message}</p>}{(message || error) && <p role="alert" className="error">{message || error}</p>}<Button type="submit" size="lg" className="mt-6 h-10 w-full" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Entrar'}</Button></form><p className="muted text-sm mt-6">Acesso exclusivo à sua conta pessoal.</p></div></section></main>
}
