import { accountBalance, projectCashFlow } from '../domain/cashFlow'
import { todayCivil } from '../domain/calendar'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { currentMonth, shiftMonth, formatMonth, formatMoney } from '../domain/finance'
import { useFinancialRecords } from '../hooks/useFinancialRecords'
import { useRecurringMonth } from '../hooks/useRecurringMonth'
import { projectRecurrences } from '../domain/recurrences'
import { generateInstallments } from '../domain/entries'
import { useCatalog } from '../hooks/useCatalog'
import { buildCommitments, commitmentSituation } from '../domain/commitments'
import { summarizeDashboard } from '../domain/dashboard'

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth)
  const accounts = useFinancialRecords('accounts')
  const movements = useFinancialRecords('accountMovements')
  const entries = useFinancialRecords('entries')
  const installments = useFinancialRecords('installments')
  const invoices = useFinancialRecords('invoices')
  const cards = useCatalog('cards')
  const recurring = useRecurringMonth(month)
  const { pathname } = useLocation()
  const future = pathname === '/futuros'
  const sources = [accounts, movements, entries, installments, invoices, cards, recurring]
  let projectionError: string | null = null
  const projected = (() => {
    if (!future || sources.some(source => source.loading || source.error)) return []
    try {
      return Array.from({ length: 13 }, (_, index) => projectRecurrences(
        shiftMonth(future ? currentMonth() : month, index), recurring.roots.rows, recurring.versions.rows, recurring.allEntries.rows, cards.rows,
      )).flat()
    } catch { projectionError = 'Não foi possível calcular as projeções. Confira as recorrências cadastradas.'; return [] }
  })()
  const projectedEntries = projected.map(item => ({ ...item.input, id: item.id }))
  const projectedParts = projected.flatMap(item => generateInstallments(item.id, item.input).map(part => ({ ...part, recurrenceId: item.recurrenceId, projected: true })))
  const { all } = buildCommitments([...entries.rows, ...projectedEntries], [...installments.rows, ...projectedParts], invoices.rows, cards.rows)
  const account = accounts.rows.find(row => row.id === 'main')
  const balance = account ? accountBalance(account.openingCents, movements.rows.map(row => ({ ...row, reversesId: row.reversesId ?? undefined }))) : 0
  const cashFlow = account && future ? projectCashFlow(balance, all, todayCivil()) : null
  const summary = summarizeDashboard(all, future ? currentMonth() : month, future)
  const failure = sources.find(source => source.error)?.error || projectionError
  const loading = sources.some(source => source.loading)
  const retry = () => sources.forEach(source => source.retry())
  return <main id="main-content" className="workspace">
    <header><div><p className="eyebrow">UM PASSO DE CADA VEZ</p><h1>{future ? 'Compromissos futuros' : 'Visão geral'}</h1></div>
      {!future && <div className="month-picker" aria-label="Selecionar mês"><button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>←</button><span aria-live="polite">{formatMonth(month)}</span><button aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>→</button></div>}
    </header>
    <p className="muted mb-6">{future ? `De ${formatMonth(shiftMonth(currentMonth(), 1))} a ${formatMonth(shiftMonth(currentMonth(), 12))}.` : 'Acompanhe seus compromissos pelo mês de vencimento.'}</p>
    <div className="dashboard-actions mb-6"><Link className="primary" to="/lancamentos">Ver lançamentos</Link><Link className="secondary" to="/a-receber">A receber</Link><Link className="secondary" to="/faturas">Ver faturas</Link><Link className="secondary" to={future ? '/' : '/futuros'}>{future ? 'Visão geral' : 'Próximos 12 meses'}</Link></div>
    {future && <p className="notice mb-5">Inclui parcelas existentes e projeções das recorrências nos próximos 12 meses. Projeções são estimativas; ocorrências já geradas preservam seus valores.</p>}
    {failure ? <div className="error mb-6" role="alert">{failure}<button className="secondary ml-3" onClick={retry}>Tentar novamente</button></div>
      : loading ? <p role="status">Carregando seus dados.</p> : <>
      <section className="panel p-6 mb-6"><h2>Saldo atual em conta</h2><strong>{account ? formatMoney(balance) : 'Conta não configurada'}</strong><p><Link className="record-link" to="/conta">{account ? 'Ver conta e movimentações' : 'Configurar saldo inicial'}</Link></p></section>
      {cashFlow && <section className="panel p-6 mb-6"><h2>Saldo acumulado previsto a partir de hoje</h2><p className="muted">Inclui o restante do mês e pendências atrasadas. Valores por dia consideram todas as entradas e saídas desse dia; não representam a ordem intradiária.</p>{cashFlow.firstNegativeDate && <p className="error">Saldo previsto negativo em {cashFlow.firstNegativeDate.split('-').reverse().join('/')}</p>}<div className="installment-preview"><table><thead><tr><th>Mês</th><th>Inicial</th><th>Entradas</th><th>Saídas</th><th>Final previsto</th></tr></thead><tbody>{cashFlow.rows.map(row => <tr key={row.month}><td>{formatMonth(row.month)}</td><td>{formatMoney(row.opening)}</td><td>{formatMoney(row.incoming)}</td><td>{formatMoney(row.outgoing)}</td><td>{formatMoney(row.closing)}</td></tr>)}</tbody></table></div></section>}
      <section className="stats" aria-label="Resumo financeiro">
        <article><p>A receber {future ? 'no período' : 'no mês'}</p><strong>{formatMoney(summary.incoming)}</strong><span>Recebimentos pendentes</span></article>
        <article><p>A pagar {future ? 'no período' : 'no mês'}</p><strong>{formatMoney(summary.outgoing)}</strong><span>Faturas e despesas pendentes</span></article>
        <article className="highlight"><p>Saldo previsto dos compromissos</p><strong>{formatMoney(summary.balance)}</strong><span>Valores a receber menos valores a pagar; não representa saldo bancário</span></article>
      </section>
      <section className="panel"><div className="panel-heading"><h2>{future ? 'Compromissos dos próximos 12 meses' : 'Compromissos do mês'}</h2><span className="badge">{summary.visible.length} registros</span></div>
        {summary.visible.length ? <ul className="records">{summary.visible.map(item => <li key={item.id}><div><Link className="record-link" to={item.cardId ? '/faturas' : item.income ? '/a-receber' : item.fixed ? '/despesas-fixas' : '/lancamentos'}>{item.description}</Link><p className="muted text-sm">{item.dueDate.split('-').reverse().join('/')} · {item.income ? 'Entrada' : 'Saída'} · {item.projected ? 'Projeção' : commitmentSituation(item)}</p></div><strong>{formatMoney(item.amountCents)}</strong></li>)}</ul>
          : <div className="empty"><h3>Nenhum compromisso neste período</h3><p className="muted">Cadastre despesas ou recebimentos em lançamentos, ou escolha outro mês.</p><Link className="secondary inline-block mt-5" to="/lancamentos">Ir para lançamentos</Link></div>}
      </section>
    </>}
  </main>
}
