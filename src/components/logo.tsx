import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
  showText?: boolean;
  variant?: "default" | "light";
  className?: string;
}

const sizeMap: Record<LogoSize, { mark: string; text: string }> = {
  xs: { mark: "size-7 rounded-lg", text: "text-sm" },
  sm: { mark: "size-8 rounded-lg", text: "text-base" },
  md: { mark: "size-10 rounded-xl", text: "text-lg" },
  lg: { mark: "size-14 rounded-2xl", text: "text-2xl" },
  xl: { mark: "size-16 rounded-2xl", text: "text-3xl" },
};

function LogoMark({ size, decorative = false }: { size: string; decorative?: boolean }) {
  return (
    <img
      src="/sigic-mark.svg"
      alt={decorative ? "" : "Marca SIGIC"}
      aria-hidden={decorative || undefined}
      className={cn("shrink-0", size)}
      draggable={false}
    />
  );
}

export function Logo({ size = "md", showText = true, variant = "default", className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", variant === "light" && "text-white", className)}>
      <LogoMark size={sizeMap[size].mark} decorative />
      {showText && (
        <div className="min-w-0 leading-none">
          <span className={cn("font-display font-bold tracking-[0.04em]", sizeMap[size].text)}>SIGIC</span>
          {size !== "xs" && size !== "sm" && (
            <p className="mt-1 text-[9px] font-medium uppercase leading-tight tracking-[0.08em] text-current/65">
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
