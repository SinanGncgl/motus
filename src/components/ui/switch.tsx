"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-[#00ff88] data-[state=unchecked]:bg-input inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-[#00ff88] focus-visible:ring-[3px] focus-visible:ring-[#00ff88]/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background data-[state=unchecked]:bg-[#6b7280] data-[state=checked]:bg-[#0a0a0f] pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
