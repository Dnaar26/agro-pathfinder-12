import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
  showText?: boolean;
  variant?: "default" | "light";
  className?: string;
}

const sizeMap: Record<LogoSize, { img: string; text: string }> = {
  xs: { img: "h-10 w-auto", text: "text-sm" },
  sm: { img: "h-12 w-auto", text: "text-base" },
  md: { img: "h-14 w-auto", text: "text-lg" },
  lg: { img: "h-20 w-auto", text: "text-2xl" },
  xl: { img: "h-24 w-auto", text: "text-3xl" },
};

export function Logo({ size = "md", showText = true, variant = "default", className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", variant === "light" && "text-white", className)}>
      <img
        src="/sigic-logo.png"
        alt="SIGIC"
        className={cn("block shrink-0", sizeMap[size].img)}
      />
      {showText && (
        <div className="leading-none">
          <span className={cn("font-display font-bold", sizeMap[size].text)}>
            SIGIC
          </span>
          {size !== "xs" && size !== "sm" && (
            <p className="text-[0.55em] opacity-60 leading-tight -mt-0.5">
              Gestión Inteligente de Cultivos
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoIcon({ size = "sm", className }: { size?: LogoSize; className?: string; }) {
  return (
    <img
      src="/sigic-logo.png"
      alt="SIGIC"
      className={cn("block shrink-0", sizeMap[size].img)}
    />
  );
}
