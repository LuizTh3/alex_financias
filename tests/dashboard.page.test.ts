import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
const state = vi.hoisted(() => ({ loading: false, error: null as string | null, path: '/' }))
vi.mock('../src/hooks/useFinancialRecords', () => ({ useFinancialRecords: () => ({ rows: [], loading: state.loading, error: state.error, retry: vi.fn() }) }))
vi.mock('../src/hooks/useCatalog', () => ({ useCatalog: () => ({ rows: [], loading: false, error: null, retry: vi.fn() }) }))
vi.mock('../src/hooks/useRecurringMonth', () => ({ useRecurringMonth: () => ({ roots: { rows: [] }, versions: { rows: [] }, allEntries: { rows: [] }, loading: false, error: state.error, retry: vi.fn() }) }))
import { DashboardPage } from '../src/pages/DashboardPage'
const render = () => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [state.path] }, createElement(DashboardPage)))
describe('estados e navegação do dashboard', () => {
  beforeEach(() => { state.loading = false; state.error = null; state.path = '/' })
  it('exibe estado vazio com acesso a lançamentos e resumo zerado', () => {
    const html = render()
    expect(html).toContain('Nenhum compromisso neste período')
    expect(html).toContain('href="/lancamentos"')
    expect(html).toContain('Resumo financeiro')
  })
  it('oculta totais durante carregamento', () => {
    state.loading = true
    expect(render()).toContain('role="status"')
    expect(render()).not.toContain('Resumo financeiro')
  })
  it('prioriza erro sobre carregamento e oferece nova tentativa sem totais parciais', () => {
    state.error = 'Falha de conexão'
    state.loading = true
    const html = render()
    expect(html).toContain('role="alert"')
    expect(html).toContain('Tentar novamente')
    expect(html).not.toContain('Resumo financeiro')
  })
  it('identifica o horizonte futuro e permite voltar à visão geral', () => {
    state.path = '/futuros'
    const html = render()
    expect(html).toContain('Compromissos dos próximos 12 meses')
    expect(html).toContain('A pagar no período')
    expect(html).toContain('href="/"')
  })
})
