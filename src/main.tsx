import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './contexts/AuthContext'
import { configurationError } from './lib/firebase'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { OverviewPage } from './pages/OverviewPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { CardsPage } from './pages/CardsPage'
import { ForecastPage } from './pages/ForecastPage'
import { IncomesPage } from './pages/IncomesPage'
import { ReceivablesPage } from './pages/ReceivablesPage'
import { ExpensesPage } from './pages/ExpensesPage'
import './styles.css'

/** Vitrine de componentes: só existe no `npm run dev`, fica fora do build de produção. */
const ComponentsPreview = import.meta.env.DEV
  ? lazy(() => import('./pages/ComponentsPreview').then(module => ({ default: module.ComponentsPreview })))
  : null

/** Endereços da v0.2.0 levados à tela equivalente, para favoritos antigos continuarem funcionando. */
const legacyRoutes: [string, string][] = [
  ['/lancamentos', '/faturas'], ['/categorias', '/cartoes'], ['/despesas-fixas', '/despesas'],
  ['/futuros', '/previsao'], ['/conta', '/'], ['/como-usar', '/'],
]

function App() {
  if (configurationError) return <main className="p-10" role="alert">{configurationError}</main>
  return <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/entrar" element={<LoginPage />} />
        {ComponentsPreview && <Route path="/dev/componentes" element={<Suspense><ComponentsPreview /></Suspense>} />}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/faturas" element={<InvoicesPage />} />
            <Route path="/cartoes" element={<CardsPage />} />
            <Route path="/previsao" element={<ForecastPage />} />
            <Route path="/rendas" element={<IncomesPage />} />
            <Route path="/despesas" element={<ExpensesPage />} />
            <Route path="/a-receber" element={<ReceivablesPage />} />
            {legacyRoutes.map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
}
// Animações do Animate UI (motion) respeitam a preferência de reduzir movimento do sistema.
createRoot(document.getElementById('root')!).render(<StrictMode><MotionConfig reducedMotion="user"><App /></MotionConfig></StrictMode>)
