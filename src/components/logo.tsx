import { useId } from "react";
import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
  showText?: boolean;
  variant?: "default" | "light";
  className?: string;
}

const sizeMap: Record<LogoSize, { mark: string; text: string; tagline: string }> = {
  xs: { mark: "size-7", text: "text-sm", tagline: "text-[8px]" },
  sm: { mark: "size-9", text: "text-lg", tagline: "text-[8px]" },
  md: { mark: "size-11", text: "text-xl", tagline: "text-[9px]" },
  lg: { mark: "size-14", text: "text-3xl", tagline: "text-[10px]" },
  xl: { mark: "size-16", text: "text-4xl", tagline: "text-[11px]" },
};

/**
 * Isotipo SIGIC: brote de dos hojas (surcos) bajo un nodo dorado de precisión,
 * sobre una escuadra de esmeralda con brillo de vidrio. Debe mantenerse en
 * sincronía con public/sigic-mark.svg (favicon) y los íconos PNG.
 */
function LogoMark({ size, decorative = false }: { size: string; decorative?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `${name}-${uid}`;
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("shrink-0 drop-shadow-[0_2px_6px_rgba(8,61,44,0.3)]", size)}
      fill="none"
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "SIGIC"}
      focusable="false"
    >
      <defs>
        <linearGradient id={id("bg")} x1="8" y1="2" x2="40" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2aa37a" />
          <stop offset=".55" stopColor="#0f6b4c" />
          <stop offset="1" stopColor="#083d2c" />
        </linearGradient>
        <linearGradient id={id("leaf")} x1="24" y1="22" x2="24" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9ecdb" />
        </linearGradient>
        <linearGradient id={id("gold")} x1="21" y1="9" x2="27" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff1bd" />
          <stop offset="1" stopColor="#d4a03c" />
        </linearGradient>
        <linearGradient id={id("rim")} x1="8" y1="2" x2="40" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity=".25" />
        </linearGradient>
        <radialGradient
          id={id("gloss")}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(24 2) scale(30 22)"
        >
          <stop offset="0" stopColor="#fff" stopOpacity=".3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id("clip")}>
          <rect x="2" y="2" width="44" height="44" rx="13" />
        </clipPath>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${id("bg")})`} />
      <g clipPath={`url(#${id("clip")})`}>
        <ellipse cx="24" cy="2" rx="30" ry="22" fill={`url(#${id("gloss")})`} />
      </g>
      <rect x="2.5" y="2.5" width="43" height="43" rx="12.5" stroke={`url(#${id("rim")})`} />
      <path d="M24 38C15 37.5 10.5 31 11 22.5 19 22.5 24 28 24 38Z" fill={`url(#${id("leaf")})`} />
      <path d="M24 38C33 37.5 37.5 31 37 22.5 29 22.5 24 28 24 38Z" fill={`url(#${id("leaf")})`} />
      <path
        d="M24 35.5C21 31 17.5 27.5 14.5 25.5M24 35.5C27 31 30.5 27.5 33.5 25.5"
        stroke="#0f6b4c"
        strokeOpacity=".38"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path d="M16 41.5Q24 44 32 41.5" stroke="#fff" strokeOpacity=".4" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="24" cy="12.5" r="6.4" stroke="#fff" strokeOpacity=".45" strokeWidth="1.2" />
      <circle cx="24" cy="12.5" r="3.3" fill={`url(#${id("gold")})`} />
    </svg>
  );
}

export function Logo({ size = "md", showText = true, variant = "default", className }: LogoProps) {
  const s = sizeMap[size];
  return (
    <div className={cn("flex items-center gap-3", variant === "light" ? "text-white" : "text-foreground", className)}>
      <LogoMark size={s.mark} decorative />
      {showText && (
        <div className="min-w-0 leading-none">
          <span className={cn("block font-display font-bold tracking-[0.06em]", s.text)}>SIGIC</span>
          {size !== "xs" && size !== "sm" && (
            <p className={cn("mt-1.5 font-medium uppercase leading-tight tracking-[0.16em] text-current/60", s.tagline)}>
              Gestión Inteligente de Cultivos
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoIcon({ size = "sm", className }: { size?: LogoSize; className?: string }) {
  return <LogoMark size={cn(sizeMap[size].mark, className)} />;
}
