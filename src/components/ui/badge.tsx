import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border font-mono text-[10px] uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-[#00ff88] focus:ring-offset-2 focus:ring-offset-[#0a0a0f]",
  {
    variants: {
      variant: {
        default:
          "border-[#00ff88] bg-transparent text-[#00ff88]",
        secondary:
          "border-[#ff00ff] bg-transparent text-[#ff00ff]",
        destructive:
          "border-[#ff3366]/50 bg-[#ff3366]/20 text-[#ff3366]",
        outline:
          "border-[#2a2a3a] bg-transparent text-[#6b7280]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
