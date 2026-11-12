import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { FinanceData } from '../src/domain/summary'

const state = vi.hoisted(() => ({ data: null as unknown as FinanceData, loading: false, error: null as string | null }))
vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'dono' } }) }))
vi.mock('../src/data/store', () => ({}))
vi.mock('../src/hooks/useCollection', () => ({
  useFinanceData: () => ({ data: state.data, loading: state.loading, error: state.error, retry: () => undefined }),
  useCollection: (name: 'incomes' | 'receivables') => ({ rows: state.data[name], loading: state.loading, error: state.error, retry: () => undefined }),
}))
vi.mock('../src/domain/format', async original => ({ ...await original<typeof import('../src/domain/format')>(), currentMonth: () => '2026-07' }))

import { OverviewPage } from '../src/pages/OverviewPage'
import { InvoicesPage } from '../src/pages/InvoicesPage'
import { CardsPage } from '../src/pages/CardsPage'
import { ForecastPage } from '../src/pages/ForecastPage'
import { IncomesPage } from '../src/pages/IncomesPage'
import { ReceivablesPage } from '../src/pages/ReceivablesPage'

const render = (page: ComponentType, path = '/') =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(page))).replace(/ /g, ' ')
const nubank = { id: 'nu', name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10, active: true }
const antigo = { id: 'old', name: 'Antigo', color: '#000000', closingDay: 1, dueDay: 8, active: false }
const fullData = (): FinanceData => ({
  cards: [nubank, antigo],
  purchases: [
    { id: 'sofa', cardId: 'nu', title: 'Compra sofá', totalCents: 67644, installmentCount: 12, purchaseDate: '2026-01-15', firstDueMonth: '2026-01', description: '' },
    { id: 'tv', cardId: 'nu', title: 'Televisão', totalCents: 150000, installmentCount: 1, purchaseDate: '2026-06-20', firstDueMonth: '2026-07', description: '' },
    { id: 'velho', cardId: 'old', title: 'Compra antiga', totalCents: 99900, installmentCount: 1, purchaseDate: '2026-06-20', firstDueMonth: '2026-07', description: '' },
  ],
  statuses: [{ id: 'nu_2026-07', cardId: 'nu', month: '2026-07' }],
  incomes: [{ id: 'sal', title: 'Salário', amountCents: 500000, startMonth: '2026-01', endMonth: null }],
  receivables: [{ id: 'maico', title: 'MAICO', totalCents: 35000, installmentCount: 5, launchDate: '2026-05-01', firstDueMonth: '2026-06', description: '', receivedIndexes: [1] }],
})
const empty = (): FinanceData => ({ cards: [], purchases: [], statuses: [], incomes: [], receivables: [] })

beforeEach(() => { state.data = fullData(); state.loading = false; state.error = null })

describe('Visão geral', () => {
  it('mostra renda, a pagar e saldo do mês sem o cartão inativo', () => {
    const html = render(OverviewPage)
    expect(html).toContain('R$ 5.000,00')
    expect(html).toContain('R$ 1.556,37') // 56,37 + 1.500,00; "Compra antiga" do cartão inativo fica fora
    expect(html).toContain('R$ 3.443,63')
    expect(html).not.toContain('Antigo')
  })
  it('mostra o cartão com selo de paga e o card isolado de A receber', () => {
    const html = render(OverviewPage)
    expect(html).toContain('Nubank')
    expect(html).toContain('Paga')
    expect(html).toContain('Desmarcar')
    expect(html).toContain('R$ 70,00') // parcela 2/5 do MAICO em julho
    expect(html).toContain('não entra no saldo previsto')
  })
  it('respeita o mês da URL', () => {
    expect(render(OverviewPage, '/?mes=2027-02')).toContain('Fevereiro de 2027')
  })
  it('sem cartões leva ao cadastro; carregando e erro não mostram valores', () => {
    state.data = empty()
    expect(render(OverviewPage)).toContain('Nenhum cartão cadastrado')
    state.loading = true
    expect(render(OverviewPage)).not.toContain('Saldo previsto')
    state.error = 'Falha'
    expect(render(OverviewPage)).toContain('Tentar novamente')
  })
})

describe('Faturas', () => {
  it('sem cartão na URL pede para selecionar', () => {
    const html = render(InvoicesPage, '/faturas')
    expect(html).toContain('Selecione o cartão')
    expect(html).not.toContain('Novo lançamento')
  })
  it('com cartão pré-selecionado mostra fatura, histórico e filtros', () => {
    const html = render(InvoicesPage, '/faturas?cartao=nu')
    expect(html).toContain('R$ 1.556,37')
    expect(html).toContain('Compra sofá')
    expect(html).toContain('Parcela 7/12')
    expect(html).toContain('R$ 56,37')
    expect(html).toContain('À vista')
    expect(html).toContain('Desmarcar pago')
    for (const label of ['Todos', 'À vista', 'Parcelado']) expect(html).toContain(label)
  })
  it('cartão inativo na URL é tratado como não selecionado', () => {
    expect(render(InvoicesPage, '/faturas?cartao=old')).toContain('Selecione o cartão')
  })
  it('mês sem lançamentos', () => {
    expect(render(InvoicesPage, '/faturas?cartao=nu&mes=2030-01')).toContain('Nenhum lançamento nesta fatura')
  })
})

describe('Cartões', () => {
  it('lista só cartões ativos com Faturas, Editar e Excluir', () => {
    const html = render(CardsPage, '/cartoes')
    expect(html).toContain('Nubank')
    expect(html).not.toContain('Antigo')
    expect(html).toContain('href="/faturas?cartao=nu"')
    expect(html).toContain('Excluir')
  })
  it('vazio', () => {
    state.data = empty()
    expect(render(CardsPage, '/cartoes')).toContain('Nenhum cartão cadastrado')
  })
})

describe('Previsão', () => {
  it('mostra 12 meses a partir do mês escolhido, com A receber informativo', () => {
    const html = render(ForecastPage, '/previsao?inicio=2026-03')
    expect(html).toContain('Março de 2026')
    expect(html).toContain('Fevereiro de 2027')
    expect(html).not.toContain('Março de 2027')
    expect(html).toContain('informativo')
    expect(html).toContain('Total em 12 meses')
    expect(html).toContain('aria-haspopup="dialog"')
  })
})

describe('Rendas', () => {
  it('lista renda vigente sem fim', () => {
    const html = render(IncomesPage, '/rendas')
    expect(html).toContain('Salário')
    expect(html).toContain('sem fim')
    expect(html).toContain('Vigente')
  })
})

describe('A receber', () => {
  it('mostra a parcela do mês, totais e marcador', () => {
    const html = render(ReceivablesPage, '/a-receber')
    expect(html).toContain('MAICO')
    expect(html).toContain('Parcela 2/5')
    expect(html).toContain('R$ 70,00')
    expect(html).toContain('Recebido')
  })
  it('a parcela 1 (junho) aparece como recebida', () => {
    const html = render(ReceivablesPage, '/a-receber?mes=2026-06')
    expect(html).toContain('Parcela 1/5')
    expect(html).toContain('Desmarcar')
  })
})
