import type { CSSProperties, ReactNode } from 'react'
import { CalendarDaysIcon, CalendarClockIcon, CheckCircle2Icon, ClockIcon, LayersIcon, NfcIcon } from 'lucide-react'
import type { Card } from '../domain/schemas'
import { formatDate, formatMoney } from '../domain/format'

export type CardInvoiceInfo = { totalCents: number; closingDate: string; dueDate: string; paid: boolean; chargeCount?: number }

/** Chip dourado desenhado em SVG. */
function Chip() {
  return <svg className="credit-card-chip" viewBox="0 0 48 36" aria-hidden="true">
    <defs><linearGradient id="chip-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#efe6d4" /><stop offset=".55" stopColor="#c9b89a" /><stop offset="1" stopColor="#e9dcc3" /></linearGradient></defs>
    <rect x=".5" y=".5" width="47" height="35" rx="7" fill="url(#chip-gold)" stroke="#0003" />
    <path d="M16 1v10M32 1v10M16 25v10M32 25v10M1 13h11M36 13h11M1 23h11M36 23h11M16 11h16v14H16z" fill="none" stroke="#7a6a50" strokeOpacity=".55" strokeWidth="1.2" />
  </svg>
}

/**
 * Cartão em vidro escuro com brilho na cor do cadastro: nome, situação, chip, valor da fatura,
 * fechamento, vencimento e cobranças. `onOpen` torna a área do cartão clicável; `actions` (botões)
 * ficam no rodapé do próprio cartão. Sem `invoice`, mostra os dias de fechamento e vencimento.
 */
export function CreditCardVisual({ card, invoice, onOpen, actions, size = 'regular' }: {
  card: Pick<Card, 'name' | 'color' | 'closingDay' | 'dueDay'>; invoice?: CardInvoiceInfo
  onOpen?: () => void; actions?: ReactNode; size?: 'regular' | 'large'
}) {
  const style = { '--card-color': card.color } as CSSProperties
  const count = invoice?.chargeCount
  return <article className={`credit-card size-${size}`} style={style}>
    {onOpen && <button type="button" className="credit-card-hit" onClick={onOpen} aria-label={`Abrir fatura do cartão ${card.name}`} />}
    <div className="credit-card-top">
      <span className="credit-card-name">{card.name}</span>
      {invoice && <span className={`credit-card-status ${invoice.paid ? 'is-paid' : ''}`}>
        {invoice.paid ? <CheckCircle2Icon /> : <ClockIcon />}{invoice.paid ? 'Paga' : 'Pendente'}
      </span>}
    </div>
    <div className="credit-card-middle">
      <Chip />
      <NfcIcon className="credit-card-nfc" aria-hidden="true" />
      {invoice && <strong className="credit-card-amount">{formatMoney(invoice.totalCents)}</strong>}
    </div>
    <dl className="credit-card-info">
      {invoice
        ? <>
          <div><CalendarClockIcon aria-hidden="true" /><span><dt>Fechamento:</dt><dd>{formatDate(invoice.closingDate)}</dd></span></div>
          <div><CalendarDaysIcon aria-hidden="true" /><span><dt>Vencimento:</dt><dd>{formatDate(invoice.dueDate)}</dd></span></div>
          {count !== undefined && <div><LayersIcon aria-hidden="true" /><span><dt className="sr-only">Cobranças</dt><dd>{count} {count === 1 ? 'cobrança' : 'cobranças'}</dd></span></div>}
        </>
        : <>
          <div><CalendarClockIcon aria-hidden="true" /><span><dt>Fechamento:</dt><dd>dia {card.closingDay || '—'}</dd></span></div>
          <div><CalendarDaysIcon aria-hidden="true" /><span><dt>Vencimento:</dt><dd>dia {card.dueDay || '—'}</dd></span></div>
        </>}
    </dl>
    {actions && <div className="credit-card-actions">{actions}</div>}
  </article>
}
