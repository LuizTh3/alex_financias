import type { ChangeEvent, ComponentProps } from 'react'
import { maskMoneyInput } from '../domain/format'

/**
 * Campo de dinheiro com máscara: digitar 67644 mostra 676,44. O valor é texto no formato
 * aceito por `parseMoneyToCents`. Funciona com `register` do React Hook Form.
 */
export function MoneyInput({ onChange, ...props }: Omit<ComponentProps<'input'>, 'type' | 'inputMode'>) {
  return <div className="money-input">
    <span aria-hidden="true">R$</span>
    <input {...props} type="text" inputMode="numeric" autoComplete="off" placeholder={props.placeholder ?? '0,00'}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        event.target.value = maskMoneyInput(event.target.value)
        onChange?.(event)
      }} />
  </div>
}
