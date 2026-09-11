import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "bg-card text-card-foreground flex flex-col gap-6 border border-border cyber-chamfer py-6 shadow-sm transition-all duration-300",
  {
    variants: {
      variant: {
        default: "",
        terminal: "bg-[#0a0a0f] relative overflow-hidden",
        holographic: "bg-card/70 backdrop-blur-md relative overflow-hidden",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Card({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(cardVariants({ variant, className }))}
      {...props}
    />
  )
}

function CardTerminalHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-b border-border px-6 py-3", className)}
      {...props}
    >
      <div className="flex gap-1.5">
        <div className="size-2 rounded-full bg-[#ff3366]" />
        <div className="size-2 rounded-full bg-[#f59e0b]" />
        <div className="size-2 rounded-full bg-[#00ff88]" />
      </div>
      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[#6b7280]">
        terminal
      </span>
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-sm font-semibold uppercase tracking-wider", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-[#6b7280] font-mono", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

function CardCornerAccents({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <>
      <div className={cn("absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[#00ff88]", className)} />
      <div className={cn("absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-[#00ff88]", className)} />
      <div className={cn("absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#00ff88]", className)} />
      <div className={cn("absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#00ff88]", className)} />
      <div {...props} />
    </>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardTerminalHeader,
  CardCornerAccents,
  cardVariants,
}
