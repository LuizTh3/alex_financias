import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router'
import { Modal } from './Modal'
import { needsWelcome, completeWelcome } from '../data/user'

export function WelcomeModal({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void needsWelcome(uid).then(needed => { if (active) setOpen(needed) }).catch(() => {
      if (active) setError('Não foi possível verificar sua apresentação inicial.')
    })
    return () => { active = false }
  }, [uid])
  function close() {
    setDismissed(true)
    void completeWelcome(uid).catch(() => setError('Não foi possível salvar que você já viu esta apresentação. Ela poderá aparecer no próximo acesso.'))
  }
  return <>
    {error && <div className="notice m-4 flex flex-wrap items-center gap-3" role="status">{error}<Button variant="outline" size="sm" onClick={() => setError('')}>Fechar aviso</Button></div>}
    {open && !dismissed && <Modal title="Boas-vindas ao Alex!" onClose={close}>
      <p>Para começar, <strong>cadastre seus cartões</strong>. Depois, lance as compras na tela <strong>Faturas</strong> e informe suas <strong>Rendas</strong>.</p>
      <p className="muted mt-4">A <strong>Visão geral</strong> mostra o saldo previsto do mês (renda menos as faturas) e a <strong>Previsão dos meses</strong> mostra os próximos 12 meses. Em <strong>A receber</strong> você acompanha o que outras pessoas lhe devem, sem afetar o saldo.</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2"><Button variant="outline" size="lg" onClick={close}>Fechar e continuar</Button><Button size="lg" asChild><Link to="/cartoes" onClick={close}>Cadastrar cartões</Link></Button></div>
    </Modal>}
  </>
}
