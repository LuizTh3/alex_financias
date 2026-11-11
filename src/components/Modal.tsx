import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Janela sobreposta (shadcn Dialog). Fica aberta enquanto montada; fechar chama `onClose`.
 * Clicar fora não fecha, para não perder o que foi digitado; durante `busy` nada fecha.
 */
export function Modal({ title, children, busy = false, onClose }: {
  title: string; children: ReactNode; busy?: boolean; onClose: () => void,
}) {
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <DialogContent aria-describedby={undefined} showCloseButton={!busy} className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-lg"
      onInteractOutside={event => event.preventDefault()}>
      <DialogHeader><DialogTitle className="pr-8 text-lg">{title}</DialogTitle></DialogHeader>
      <div>{children}</div>
    </DialogContent>
  </Dialog>
}
