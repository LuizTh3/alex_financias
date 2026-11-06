import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './contexts/AuthContext'
import { configurationError } from './lib/firebase'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { CatalogPage } from './pages/CatalogPage'
import { EntriesPage } from './pages/EntriesPage'
import { InvoicesPage } from './pages/InvoicesPage'
import './styles.css'
function App() {
  if (configurationError) return <main className="p-10" role="alert">{configurationError}</main>
  return <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/entrar" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/faturas" element={<InvoicesPage />} />
            <Route path="/lancamentos" element={<EntriesPage />} />
            <Route path="/cartoes" element={<CatalogPage key="cards" kind="cards" />} />
            <Route path="/categorias" element={<CatalogPage key="categories" kind="categories" />} />
            {['/', '/despesas-fixas', '/a-receber', '/futuros'].map(path =>
              <Route key={path} path={path} element={<DashboardPage />} />)}
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
