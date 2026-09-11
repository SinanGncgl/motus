/** Chamfered corners via clip-path */
export function cyberChamfer(sm = false) {
  return sm ? "cyber-chamfer-sm" : "cyber-chamfer";
}

/** Neon glow via Tailwind arbitrary shadow */
export function neonGlow(
  color: "green" | "magenta" | "cyan" = "green",
  size: "sm" | "md" | "lg" = "md"
) {
  const map = {
    green: {
      sm: "shadow-[0_0_3px_#00ff88,0_0_6px_#00ff8830]",
      md: "shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]",
      lg: "shadow-[0_0_10px_#00ff88,0_0_20px_#00ff8860,0_0_40px_#00ff8830]",
    },
    magenta: {
      sm: "shadow-[0_0_3px_#ff00ff,0_0_6px_#ff00ff30]",
      md: "shadow-[0_0_5px_#ff00ff,0_0_20px_#ff00ff60]",
      lg: "shadow-[0_0_10px_#ff00ff,0_0_30px_#ff00ff60,0_0_60px_#ff00ff30]",
    },
    cyan: {
      sm: "shadow-[0_0_3px_#00d4ff,0_0_6px_#00d4ff30]",
      md: "shadow-[0_0_5px_#00d4ff,0_0_20px_#00d4ff60]",
      lg: "shadow-[0_0_10px_#00d4ff,0_0_30px_#00d4ff60,0_0_60px_#00d4ff30]",
    },
  };
  return map[color][size];
}

/** Chromatic aberration class (defined in index.css) */
export function chromaticAberration() {
  return "cyber-chromatic";
}

/** Neon text glow class (defined in index.css) */
export function neonTextGlow(color: "green" | "magenta" | "cyan" = "green") {
  return `cyber-text-glow-${color}`;
}
