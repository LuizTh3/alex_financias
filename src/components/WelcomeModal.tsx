import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Modal } from './Modal'
import { needsWelcome, completeWelcome } from '../repositories/userRepository'

export function WelcomeModal({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void needsWelcome(uid).then(needed => { if (active) setOpen(needed) }).catch(() => {
      if (active) setError('Não foi possível verificar sua apresentação inicial. O guia Como usar continua disponível no menu.')
    })
    return () => { active = false }
  }, [uid])
  function close() {
    setDismissed(true)
    void completeWelcome(uid).catch(() => setError('Não foi possível salvar que você já viu esta apresentação. Ela poderá aparecer no próximo acesso.'))
  }
  return <>
    {error && <div className="notice" role="status">{error}<button className="secondary ml-3" onClick={() => setError('')}>Fechar aviso</button></div>}
    {open && !dismissed && <Modal title="Boas-vindas ao Alex!" onClose={close}>
      <p className="mt-5">Antes de começar, vale conhecer a página <strong>Como usar</strong>. Lá você encontra um passo a passo de cada ferramenta e entende como seus registros afetam o saldo e as previsões.</p>
      <p className="muted mt-4">Você pode consultar o guia quando quiser pelo menu. Se preferir, feche esta mensagem e explore o sistema no seu ritmo.</p>
      <div className="modal-actions flex-wrap"><button type="button" className="secondary" onClick={close}>Fechar e continuar</button><Link className="primary" to="/como-usar" onClick={close}>Abrir Como usar</Link></div>
    </Modal>}
  </>
}
