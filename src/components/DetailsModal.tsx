import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from './Modal'

/** Janela sobreposta com os detalhes de um lançamento; mostra a descrição quando houver. */
export function DetailsModal({ title, rows, description, actions, onClose }: {
  title: string; rows: [string, ReactNode][]; description?: string; actions?: ReactNode; onClose: () => void
}) {
  return <Modal title={title} onClose={onClose}>
    <div className="grid gap-5">
      <dl className="details-list">
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="details-description">
        <h3>Descrição</h3>
        <p className={description ? '' : 'muted'}>{description || 'Sem descrição.'}</p>
      </div>
      <div className="flex justify-end gap-2">{actions}<Button variant="outline" size="lg" onClick={onClose}>Fechar</Button></div>
    </div>
  </Modal>
}
