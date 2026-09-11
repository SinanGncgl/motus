import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted relative overflow-hidden cyber-chamfer-sm", className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[cyber-shimmer_2s_infinite] bg-gradient-to-r from-transparent via-[#00ff8810] to-transparent" />
    </div>
  )
}

export { Skeleton }
