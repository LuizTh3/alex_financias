/** Selo de situação: fatura paga/em aberto ou parcela recebida/a receber. */
export function StatusBadge({ done, kind = 'invoice' }: { done: boolean; kind?: 'invoice' | 'receivable' }) {
  const text = kind === 'invoice' ? (done ? 'Paga' : 'Em aberto') : (done ? 'Recebido' : 'A receber')
  return <span className={`status-badge ${done ? 'is-done' : 'is-open'}`}>
    <span aria-hidden="true">{done ? '✓' : '•'}</span>{text}
  </span>
}
