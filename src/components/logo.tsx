import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
  showText?: boolean;
  variant?: "default" | "light";
  className?: string;
}

const sizeMap: Record<LogoSize, { mark: string; text: string }> = {
  xs: { mark: "size-7", text: "text-sm" },
  sm: { mark: "size-8", text: "text-base" },
  md: { mark: "size-10", text: "text-lg" },
  lg: { mark: "size-14", text: "text-2xl" },
  xl: { mark: "size-16", text: "text-3xl" },
};

function LogoMark({ size, decorative = false }: { size: string; decorative?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("shrink-0 text-primary", size)}
      fill="none"
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "SIGIC"}
      focusable="false"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <path d="M14 13h5l5 4 5-4h5" />
        <path d="m16 14-4 3m20-3 4 3m-12-1v5" />
        <path d="M7.5 12.5c1.8-2.1 5.8-2.1 7.6 0-1.8 2.1-5.8 2.1-7.6 0Z" />
        <path d="M32.9 12.5c1.8-2.1 5.8-2.1 7.6 0-1.8 2.1-5.8 2.1-7.6 0Z" />
        <path d="M6.5 31c7-2 12.7 1.1 17.5 8.2M41.5 31c-7-2-12.7 1.1-17.5 8.2" />
        <path d="M11 38c4.7-1 8.7.1 13 4.5M37 38c-4.7-1-8.7.1-13 4.5" />
        <path d="M17 44c2.3-.6 4.6-.6 7 0m7 0c-2.3-.6-4.6-.6-7 0" />
      </g>
      <circle cx="24" cy="22" r="2.6" className="fill-highlight stroke-highlight" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ size = "md", showText = true, variant = "default", className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", variant === "light" && "text-white", className)}>
      <LogoMark size={sizeMap[size].mark} decorative />
      {showText && (
        <div className="min-w-0 leading-none">
          <span className={cn("font-display font-bold", sizeMap[size].text)}>SIGIC</span>
          {size !== "xs" && size !== "sm" && (
            <p className="mt-1 text-[10px] leading-tight text-current/65">
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
