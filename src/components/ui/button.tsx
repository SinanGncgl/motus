import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-mono uppercase tracking-widest transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-transparent border-2 border-[#00ff88] text-[#00ff88] cyber-chamfer-sm hover:bg-[#00ff88] hover:text-[#0a0a0f] hover:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] focus-visible:ring-2 focus-visible:ring-[#00ff88] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        destructive:
          "bg-[#ff3366] text-white border-2 border-[#ff3366] cyber-chamfer-sm hover:brightness-110 hover:shadow-[0_0_5px_#ff3366,0_0_10px_#ff336640] focus-visible:ring-2 focus-visible:ring-[#ff3366] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        outline:
          "bg-transparent border border-[#2a2a3a] text-[#e0e0e0] cyber-chamfer-sm hover:border-[#00ff88] hover:text-[#00ff88] hover:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] focus-visible:ring-2 focus-visible:ring-[#00ff88] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        secondary:
          "bg-transparent border-2 border-[#ff00ff] text-[#ff00ff] cyber-chamfer-sm hover:bg-[#ff00ff] hover:text-[#0a0a0f] hover:shadow-[0_0_5px_#ff00ff,0_0_20px_#ff00ff60] focus-visible:ring-2 focus-visible:ring-[#ff00ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        ghost:
          "bg-transparent border-transparent text-[#6b7280] hover:bg-[#00ff8810] hover:text-[#00ff88]",
        link:
          "text-[#00ff88] underline-offset-4 hover:underline",
        glitch:
          "bg-[#00ff88] text-[#0a0a0f] border-2 border-[#00ff88] cyber-chamfer-sm hover:brightness-110 hover:shadow-[0_0_10px_#00ff88,0_0_20px_#00ff8860] focus-visible:ring-2 focus-visible:ring-[#00ff88] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
