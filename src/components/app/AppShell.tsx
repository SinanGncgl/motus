import { cn } from "@/lib/utils";
import { GraduationCap, LayoutDashboard, Library, Quote, Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/words", label: "Words", icon: Library },
  { to: "/practice", label: "Practice", icon: GraduationCap },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#2a2a3a] bg-[#0a0a0f] px-4 py-6 lg:flex">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 px-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#00ff88] text-[#0a0a0f] shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]">
            <Quote className="size-4" />
          </span>
          <span className="font-heading text-sm font-semibold tracking-widest text-[#00ff88]">Motus</span>
        </NavLink>
        <p className="px-3 pt-1 text-[10px] uppercase tracking-[0.2em] text-[#6b7280]">Private workspace</p>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-[#6b7280] transition-all hover:border-[#00ff8830] hover:text-[#00ff88] hover:bg-[#00ff8808]",
                  isActive && "border-l-2 border-[#00ff88] bg-[#00ff8810] text-[#00ff88] shadow-[inset_0_0_10px_#00ff8810]"
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl cyber-chamfer border border-[#00ff8830] bg-[#00ff8805] p-3">
          <p className="text-xs font-medium text-[#00ff88]">Local mode</p>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">Your library and media stay on this machine.</p>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#2a2a3a] bg-[#0a0a0f] px-4 backdrop-blur lg:hidden">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-[#00ff88] text-[#0a0a0f]">
            <Quote className="size-3.5" />
          </span>
          <span className="font-heading text-sm font-semibold text-[#00ff88]">Motus</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  "flex size-9 items-center justify-center rounded-lg text-[#6b7280] hover:text-[#00ff88]",
                  isActive && "text-[#00ff88]"
                )
              }
            >
              <item.icon className="size-5" />
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
