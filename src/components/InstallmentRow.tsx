import type { ReactNode } from 'react'
import { installmentLabel, type Installment } from '../domain/installments'
import { formatMoney } from '../domain/format'

/** Linha do histórico: "Compra sofá — Parcela 7/12 — R$ 56,37". Clicar no título abre os detalhes. */
export function InstallmentRow({ title, installment, onOpen, status, actions }: {
  title: string; installment: Installment; onOpen: () => void; status?: ReactNode; actions?: ReactNode
}) {
  return <li className="installment-row">
    <button type="button" className="installment-main" onClick={onOpen} aria-label={`Detalhes de ${title}`}>
      <span className="installment-title">{title}</span>
      <span className="installment-meta">{installmentLabel(installment)}</span>
    </button>
    <div className="installment-side">
      <strong className="installment-amount">{formatMoney(installment.amountCents)}</strong>
      {status}
      {actions && <div className="row-actions">{actions}</div>}
    </div>
  </li>
}
