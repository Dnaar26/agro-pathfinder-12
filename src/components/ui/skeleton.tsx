import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md bg-muted animate-pulse", className)} {...props} />;
}

export function SkeletonCard() {
  return <div className="rounded-xl border border-border bg-card p-4 space-y-3"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-8 w-1/2" /></div>;
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}