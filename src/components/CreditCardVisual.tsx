import type { CSSProperties, ReactNode } from 'react'
import type { Card } from '../domain/schemas'
import { formatDayMonth, formatMoney, readableTextColor } from '../domain/format'
import { StatusBadge } from './StatusBadge'

export type CardInvoiceInfo = { totalCents: number; closingDate: string; dueDate: string; paid: boolean }

/**
 * Cartão com cara de cartão: cor do cadastro, chip, nome e, quando houver, a fatura do mês.
 * `onOpen` torna o cartão inteiro clicável; `actions` ficam abaixo, fora da área clicável.
 */
export function CreditCardVisual({ card, invoice, onOpen, actions, size = 'regular' }: {
  card: Pick<Card, 'name' | 'color' | 'closingDay' | 'dueDay'>; invoice?: CardInvoiceInfo
  onOpen?: () => void; actions?: ReactNode; size?: 'regular' | 'large'
}) {
  const style = { '--card-color': card.color, '--card-text': readableTextColor(card.color) } as CSSProperties
  const face = <>
    <div className="credit-card-top">
      <span className="credit-card-chip" aria-hidden="true" />
      {invoice && <StatusBadge done={invoice.paid} />}
    </div>
    <div className="credit-card-name">{card.name}</div>
    {invoice
      ? <div className="credit-card-invoice">
        <span>Fatura</span>
        <strong>{formatMoney(invoice.totalCents)}</strong>
        <dl>
          <div><dt>Fecha</dt><dd>{formatDayMonth(invoice.closingDate)}</dd></div>
          <div><dt>Vence</dt><dd>{formatDayMonth(invoice.dueDate)}</dd></div>
        </dl>
      </div>
      : <dl className="credit-card-days">
        <div><dt>Fecha dia</dt><dd>{card.closingDay || '—'}</dd></div>
        <div><dt>Vence dia</dt><dd>{card.dueDay || '—'}</dd></div>
      </dl>}
  </>
  return <article className={`credit-card-wrap size-${size}`}>
    {onOpen
      ? <button type="button" className="credit-card" style={style} onClick={onOpen} aria-label={`Abrir fatura do cartão ${card.name}`}>{face}</button>
      : <div className="credit-card" style={style}>{face}</div>}
    {actions && <div className="credit-card-actions">{actions}</div>}
  </article>
}
