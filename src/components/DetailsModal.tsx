import type { ReactNode } from 'react'
import { Modal } from './Modal'

/** Janela sobreposta com os detalhes de um lançamento; mostra a descrição quando houver. */
export function DetailsModal({ title, rows, description, actions, onClose }: {
  title: string; rows: [string, ReactNode][]; description?: string; actions?: ReactNode; onClose: () => void
}) {
  return <Modal title={title} onClose={onClose}>
    <dl className="details-list">
      {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <div className="details-description">
      <h3>Descrição</h3>
      <p className={description ? '' : 'muted'}>{description || 'Sem descrição.'}</p>
    </div>
    <div className="modal-actions">{actions}<button type="button" className="secondary" onClick={onClose}>Fechar</button></div>
  </Modal>
}
