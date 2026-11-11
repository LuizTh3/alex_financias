import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MonthPicker } from '../components/MonthPicker'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DetailsModal } from '../components/DetailsModal'
import { CreditCardVisual } from '../components/CreditCardVisual'
import { InstallmentRow } from '../components/InstallmentRow'
import { MoneyInput } from '../components/MoneyInput'
import { ThemeToggle } from '../components/ThemeToggle'
import { requestWelcomeSplash, WelcomeSplash } from '../components/WelcomeSplash'
import { installmentInMonth } from '../domain/installments'
import { formatMoney } from '../domain/format'
import { CardForm } from '../forms/CardForm'
import { PurchaseForm } from '../forms/PurchaseForm'
import { IncomeForm } from '../forms/IncomeForm'
import { ReceivableForm } from '../forms/ReceivableForm'

const demoCard = { id: 'demo', name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10, active: true }

/** Vitrine dos componentes, disponível só em desenvolvimento (`/dev/componentes`), sem login. */
export function ComponentsPreview() {
  const [month, setMonth] = useState('2026-07')
  const [confirm, setConfirm] = useState(false)
  const [details, setDetails] = useState(false)
  const [money, setMoney] = useState('')
  const [splash, setSplash] = useState(0)
  const [form, setForm] = useState<'card' | 'purchase' | 'income' | 'receivable' | null>(null)
  const sofa = { totalCents: 67644, installmentCount: 12, firstDueMonth: '2026-01' }
  const tv = { totalCents: 150000, installmentCount: 1, firstDueMonth: '2026-07' }
  return <main className="workspace">
    <header><div><p className="eyebrow">DESENVOLVIMENTO</p><h1>Componentes</h1></div><ThemeToggle /></header>
    <section className="mt-6"><h2 className="mb-3">Animação de boas-vindas</h2><Button variant="outline" onClick={() => { requestWelcomeSplash(); setSplash(splash + 1) }}>Ver animação</Button>{splash > 0 && <WelcomeSplash key={splash} />}</section>
    <section className="mt-6"><h2 className="mb-3">Seletor de mês</h2><MonthPicker value={month} onChange={setMonth} /></section>
    <section className="mt-8"><h2 className="mb-3">Selos</h2><div className="flex gap-2"><StatusBadge done /><StatusBadge done={false} /><StatusBadge kind="receivable" done /><StatusBadge kind="receivable" done={false} /></div></section>
    <section className="mt-8"><h2 className="mb-3">Cartões</h2><div className="card-grid">
      <CreditCardVisual card={{ name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10 }} invoice={{ totalCents: 155637, closingDate: '2026-07-03', dueDate: '2026-07-10', paid: false, chargeCount: 19 }}
        onOpen={() => setDetails(true)} actions={<><Button variant="outline">Acessar</Button><Button onClick={() => setConfirm(true)}>Pagar</Button></>} />
      <CreditCardVisual card={{ name: 'Inter Black', color: '#ff7a00', closingDay: 28, dueDay: 5 }} invoice={{ totalCents: 10000, closingDate: '2026-06-28', dueDate: '2026-07-05', paid: true, chargeCount: 1 }} onOpen={() => undefined} />
      <CreditCardVisual card={{ name: 'Cartão claro', color: '#f2e6c9', closingDay: 15, dueDay: 25 }} />
    </div>
    <div className="mt-6"><CreditCardVisual size="large" card={{ name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10 }} invoice={{ totalCents: 155637, closingDate: '2026-07-03', dueDate: '2026-07-10', paid: true, chargeCount: 19 }} /></div></section>
    <section className="mt-8"><h2 className="mb-3">Histórico</h2><ul className="installment-list">
      <InstallmentRow title="Compra sofá" installment={installmentInMonth(sofa, '2026-07')!} onOpen={() => setDetails(true)} actions={<><Button variant="outline">Editar</Button><Button variant="outline">Excluir</Button></>} />
      <InstallmentRow title="Televisão" installment={installmentInMonth(tv, '2026-07')!} onOpen={() => setDetails(true)} />
      <InstallmentRow title="MAICO" installment={{ index: 2, count: 5, month: '2026-07', amountCents: 7000 }} onOpen={() => setDetails(true)} status={<StatusBadge kind="receivable" done={false} />} />
    </ul></section>
    <section className="mt-8 max-w-sm"><h2 className="mb-3">Dinheiro</h2><label htmlFor="money">Valor</label><MoneyInput id="money" value={money} onChange={event => setMoney(event.target.value)} /></section>
    <section className="mt-8"><h2 className="mb-3">Vazio</h2><Card className="p-0"><EmptyState title="Nenhum lançamento neste mês" action={<Button>Novo lançamento</Button>}>Cadastre uma compra para ver a fatura.</EmptyState></Card></section>
    <section className="mt-8"><h2 className="mb-3">Formulários (não salve: a vitrine não usa dados reais)</h2><div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setForm('card')}>Cartão</Button><Button variant="outline" onClick={() => setForm('purchase')}>Lançamento</Button>
      <Button variant="outline" onClick={() => setForm('income')}>Renda</Button><Button variant="outline" onClick={() => setForm('receivable')}>A receber</Button>
    </div></section>
    {form === 'card' && <CardForm onClose={() => setForm(null)} />}
    {form === 'purchase' && <PurchaseForm card={demoCard} onClose={() => setForm(null)} />}
    {form === 'income' && <IncomeForm onClose={() => setForm(null)} />}
    {form === 'receivable' && <ReceivableForm onClose={() => setForm(null)} />}
    {confirm && <ConfirmDialog title="Marcar fatura como paga?" confirmLabel="Marcar como paga" onConfirm={() => new Promise(resolve => setTimeout(resolve, 600))} onClose={() => setConfirm(false)}>
      <p>A fatura de <strong>julho de 2026</strong> do cartão <strong>Nubank</strong> ({formatMoney(155637)}) será marcada como paga.</p>
    </ConfirmDialog>}
    {details && <DetailsModal title="Compra sofá" onClose={() => setDetails(false)} description="Sofá retrátil da sala."
      rows={[['Valor total', formatMoney(67644)], ['Parcelas', '12x de R$ 56,37'], ['Data da compra', '15/01/2026'], ['1º vencimento', 'janeiro de 2026']]} />}
  </main>
}
