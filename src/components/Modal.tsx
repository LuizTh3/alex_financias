import { useEffect, useId, useRef, type ReactNode } from 'react'
export function Modal({ title, children, busy = false, onClose }: {
  title: string; children: ReactNode; busy?: boolean; onClose: () => void,
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={event => {
    event.preventDefault()
    if (!busy) onClose()
  }}>
    <div className="modal-heading">
      <h2 id={titleId}>{title}</h2>
      <button type="button" className="secondary" aria-label="Fechar" disabled={busy} onClick={onClose}>×</button>
    </div>
    {children}
  </dialog>
}
