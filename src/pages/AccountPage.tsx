import { useState } from 'react'
import { useFinancialRecords } from '../hooks/useFinancialRecords'
import { accountBalance } from '../domain/cashFlow'
import { formatMoney } from '../domain/finance'
import { parseMoneyToCents } from '../domain/money'
import { initializeAccount, adjustAccount } from '../repositories/accountRepository'
import { newMutationId } from '../repositories/entryRepository'
export function AccountPage() {
  const accounts = useFinancialRecords('accounts')
  const movements = useFinancialRecords('accountMovements')
  const [amount, setAmount] = useState('')
  const [negative, setNegative] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [operation, setOperation] = useState(newMutationId)
  const account = accounts.rows.find(row => row.id === 'main')
  const failure = accounts.error || movements.error
  const balance = account ? accountBalance(account.openingCents, movements.rows.map(row => ({ ...row, reversesId: row.reversesId ?? undefined }))) : 0
  return <main className="workspace"><header><h1>Minha conta</h1></header>
    <p className="notice mb-6">Informe o saldo disponível agora. Confirmações antigas já estão incluídas nesse valor e não serão importadas. Ao confirmar novos pagamentos e recebimentos, escolha se movimentam esta conta. O saldo depende desses registros manuais.</p>
    {failure ? <div role="alert" className="error">{failure}<button onClick={() => { accounts.retry(); movements.retry() }}>Tentar novamente</button></div> : accounts.loading || movements.loading ? <p role="status">Carregando conta.</p> : <>
    {account && <section className="stats"><article><p>Saldo atual</p><strong>{formatMoney(balance)}</strong><span>Controle iniciado em {account.startDate.split('-').reverse().join('/')}</span></article></section>}
    <section className="panel p-6"><h2>{account ? 'Ajustar saldo' : 'Configurar saldo inicial'}</h2><p className="muted">{account ? 'Registre apenas a diferença para corrigir o saldo, com uma justificativa.' : 'O controle começa hoje. Limite de crédito não é saldo disponível.'}</p>
    <form onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { const cents = amount.trim() === '0' ? 0 : parseMoneyToCents(amount); const value = negative ? -cents : cents; if (account) await adjustAccount(operation, value, reason); else await initializeAccount(value); setAmount(''); setReason(''); setOperation(newMutationId()) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.') } finally { setBusy(false) } }}>
      <fieldset disabled={busy}><label htmlFor="cash-value">Valor (R$)</label><input id="cash-value" required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /><label className="checkbox-label mt-4"><input type="checkbox" checked={negative} onChange={event => setNegative(event.target.checked)} />{account ? 'Diminuir saldo' : 'Saldo inicial negativo'}</label>
      {account && <><label htmlFor="cash-reason">Justificativa</label><input id="cash-reason" required maxLength={240} value={reason} onChange={event => setReason(event.target.value)} /></>}
      <button className="primary mt-5">{busy ? 'Salvando…' : account ? 'Registrar ajuste' : 'Iniciar controle'}</button></fieldset>
    </form>{error && <p className="error" role="alert">{error}</p>}</section>
    <section className="panel mt-6"><div className="panel-heading"><h2>Histórico de movimentações</h2></div>{movements.rows.length ? <ul className="records">{[...movements.rows].sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()).map(row => <li key={row.id}><div><strong>{row.description}</strong><p className="muted">{row.date.split('-').reverse().join('/')}</p></div><strong>{formatMoney(row.amountCents)}</strong></li>)}</ul> : <p className="empty">Nenhuma movimentação registrada.</p>}</section>
    </>}
  </main>
}
