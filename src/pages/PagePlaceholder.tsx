import type { ReactNode } from 'react'

/** Estrutura provisória das telas novas, substituída na fase 5 da refatoração. */
export function PagePlaceholder({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <main className="workspace">
    <header><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div></header>
    <div className="notice mt-6" role="status">Tela em construção.</div>
    <div className="muted mt-4">{children}</div>
  </main>
}
