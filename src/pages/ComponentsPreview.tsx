import { useState } from 'react'
import { MonthPicker } from '../components/MonthPicker'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DetailsModal } from '../components/DetailsModal'
import { CreditCardVisual } from '../components/CreditCardVisual'
import { InstallmentRow } from '../components/InstallmentRow'
import { MoneyInput } from '../components/MoneyInput'
import { ThemeToggle } from '../components/ThemeToggle'
import { installmentInMonth } from '../domain/installments'
import { formatMoney } from '../domain/format'

/** Vitrine dos componentes, disponível só em desenvolvimento (`/dev/componentes`), sem login. */
export function ComponentsPreview() {
  const [month, setMonth] = useState('2026-07')
  const [confirm, setConfirm] = useState(false)
  const [details, setDetails] = useState(false)
  const [money, setMoney] = useState('')
  const sofa = { totalCents: 67644, installmentCount: 12, firstDueMonth: '2026-01' }
  const tv = { totalCents: 150000, installmentCount: 1, firstDueMonth: '2026-07' }
  return <main className="workspace">
    <header><div><p className="eyebrow">DESENVOLVIMENTO</p><h1>Componentes</h1></div><ThemeToggle /></header>
    <section className="mt-6"><h2 className="mb-3">Seletor de mês</h2><MonthPicker value={month} onChange={setMonth} /></section>
    <section className="mt-8"><h2 className="mb-3">Selos</h2><div className="flex gap-2"><StatusBadge done /><StatusBadge done={false} /><StatusBadge kind="receivable" done /><StatusBadge kind="receivable" done={false} /></div></section>
    <section className="mt-8"><h2 className="mb-3">Cartões</h2><div className="card-grid">
      <CreditCardVisual card={{ name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10 }} invoice={{ totalCents: 155637, closingDate: '2026-07-03', dueDate: '2026-07-10', paid: false }}
        onOpen={() => setDetails(true)} actions={<><button className="secondary">Acessar</button><button className="primary" onClick={() => setConfirm(true)}>Pagar</button></>} />
      <CreditCardVisual card={{ name: 'Inter Black', color: '#ff7a00', closingDay: 28, dueDay: 5 }} invoice={{ totalCents: 10000, closingDate: '2026-06-28', dueDate: '2026-07-05', paid: true }} onOpen={() => undefined} />
      <CreditCardVisual card={{ name: 'Cartão claro', color: '#f2e6c9', closingDay: 15, dueDay: 25 }} />
    </div>
    <div className="mt-6"><CreditCardVisual size="large" card={{ name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10 }} invoice={{ totalCents: 155637, closingDate: '2026-07-03', dueDate: '2026-07-10', paid: true }} /></div></section>
    <section className="mt-8"><h2 className="mb-3">Histórico</h2><ul className="installment-list">
      <InstallmentRow title="Compra sofá" installment={installmentInMonth(sofa, '2026-07')!} onOpen={() => setDetails(true)} actions={<><button className="secondary">Editar</button><button className="secondary">Excluir</button></>} />
      <InstallmentRow title="Televisão" installment={installmentInMonth(tv, '2026-07')!} onOpen={() => setDetails(true)} />
      <InstallmentRow title="MAICO" installment={{ index: 2, count: 5, month: '2026-07', amountCents: 7000 }} onOpen={() => setDetails(true)} status={<StatusBadge kind="receivable" done={false} />} />
    </ul></section>
    <section className="mt-8 max-w-sm"><h2 className="mb-3">Dinheiro</h2><label htmlFor="money">Valor</label><MoneyInput id="money" value={money} onChange={event => setMoney(event.target.value)} /></section>
    <section className="mt-8"><h2 className="mb-3">Vazio</h2><div className="panel"><EmptyState title="Nenhum lançamento neste mês" action={<button className="primary">Novo lançamento</button>}>Cadastre uma compra para ver a fatura.</EmptyState></div></section>
    {confirm && <ConfirmDialog title="Marcar fatura como paga?" confirmLabel="Marcar como paga" onConfirm={() => new Promise(resolve => setTimeout(resolve, 600))} onClose={() => setConfirm(false)}>
      <p>A fatura de <strong>julho de 2026</strong> do cartão <strong>Nubank</strong> ({formatMoney(155637)}) será marcada como paga.</p>
    </ConfirmDialog>}
    {details && <DetailsModal title="Compra sofá" onClose={() => setDetails(false)} description="Sofá retrátil da sala."
      rows={[['Valor total', formatMoney(67644)], ['Parcelas', '12x de R$ 56,37'], ['Data da compra', '15/01/2026'], ['1º vencimento', 'janeiro de 2026']]} />}
  </main>
}
