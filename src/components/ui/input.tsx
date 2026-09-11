import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full border border-border bg-input cyber-chamfer-sm px-3 py-1 text-[#00ff88] font-mono text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-mono placeholder:text-[#6b7280] focus-visible:border-[#00ff88] focus-visible:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
