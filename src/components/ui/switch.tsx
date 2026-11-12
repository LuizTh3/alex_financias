"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "@animate-ui/react/primitives/radix-ui"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-start rounded-full border border-input bg-input/60 p-0.5 transition-colors outline-none after:absolute after:-inset-x-2 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:justify-end data-[state=checked]:border-primary data-[state=checked]:bg-primary dark:bg-input/40 dark:data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 rounded-full bg-muted-foreground shadow-sm data-[state=checked]:bg-primary-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
