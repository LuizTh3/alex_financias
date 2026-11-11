import { CheckIcon, CircleIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/** Selo de situação (shadcn Badge): fatura paga/em aberto ou parcela recebida/a receber. */
export function StatusBadge({ done, kind = 'invoice' }: { done: boolean; kind?: 'invoice' | 'receivable' }) {
  const text = kind === 'invoice' ? (done ? 'Paga' : 'Pendente') : (done ? 'Recebido' : 'A receber')
  return <Badge data-done={done} className={done ? 'bg-success-bg text-success' : 'bg-open-bg text-open'}>
    {done ? <CheckIcon data-icon="inline-start" /> : <CircleIcon data-icon="inline-start" className="size-1.5! fill-current" />}{text}
  </Badge>
}
