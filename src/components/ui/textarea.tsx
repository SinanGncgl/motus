import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[60px] w-full border border-border bg-input cyber-chamfer-sm px-3 py-2 text-[#00ff88] font-mono text-sm placeholder:text-[#6b7280] focus-visible:border-[#00ff88] focus-visible:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
