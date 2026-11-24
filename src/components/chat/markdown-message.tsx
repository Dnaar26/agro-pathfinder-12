import * as React from "react";
import { Check, Copy, CalendarPlus, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ChatQuickAction {
  id: string;
  label: string;
  kind: "calendar" | "inventory" | "prompt";
  payload?: string;
}

interface MarkdownMessageProps {
  content: string;
  severity?: "optimo" | "preventivo" | "alto";
  quickActions?: ChatQuickAction[];
  onQuickAction?: (action: ChatQuickAction) => void;
  compact?: boolean;
}

const SEVERITY_STYLES: Record<NonNullable<MarkdownMessageProps["severity"]>, string> = {
  optimo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  preventivo: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  alto: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

const SEVERITY_LABELS: Record<NonNullable<MarkdownMessageProps["severity"]>, string> = {
  optimo: "Estado Óptimo",
  preventivo: "Manejo Preventivo",
  alto: "Riesgo Fitosanitario Alto",
};

/** Neutraliza etiquetas HTML crudas para prevenir inyecciones visuales o XSS */
function stripDangerousHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?(script|iframe|object|embed|svg|img|style|link|meta)[^>]*>/gi, "");
}

/** Convierte formato en línea (**negrita**, `código`, *cursiva*) en nodos React puros sin innerHTML */
function renderInline(text: string): React.ReactNode[] {
  const safe = stripDangerousHtml(text);
  const tokens = safe.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-xs text-foreground border border-border/60"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) {
      return <em key={idx}>{tok.slice(1, -1)}</em>;
    }
    return <React.Fragment key={idx}>{tok}</React.Fragment>;
  });
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false;
  const cells = splitTableRow(trimmed);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function parseMarkdownBlocks(raw: string): React.ReactNode[] {
  const clean = stripDangerousHtml(raw).replace(/\r\n/g, "\n");
  const lines = clean.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Tablas GFM (encabezado + fila separadora | :--- |)
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && !isTableSeparator(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      elements.push(
        <div
          key={`tbl-${i}`}
          data-testid="chat-markdown-table"
          className="my-3 w-full overflow-x-auto rounded-lg border border-border bg-card"
        >
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-muted/70 text-foreground">
              <tr>
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="border-b border-border px-3 py-2 font-semibold whitespace-nowrap"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="even:bg-muted/25">
                  {headers.map((_, cIdx) => (
                    <td
                      key={cIdx}
                      className="border-b border-border/60 px-3 py-2 align-top"
                    >
                      {renderInline(row[cIdx] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 2. Encabezados (#, ##, ###)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      elements.push(
        <h3
          key={`h-${i}`}
          className="mt-3 mb-1.5 text-sm font-bold tracking-tight text-foreground"
        >
          {renderInline(headingMatch[2])}
        </h3>
      );
      i++;
      continue;
    }

    // 3. Bloques de cita / Precaución (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        <blockquote
          key={`q-${i}`}
          data-testid="chat-warning-callout"
          className="my-2.5 rounded-r-md border-l-4 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs sm:text-sm text-foreground"
        >
          {renderInline(quoteLines.join(" "))}
        </blockquote>
      );
      continue;
    }

    // 4. Listas numeradas (1. ...)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 list-decimal space-y-1.5 pl-5">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 5. Listas con viñetas (- ... o * ...)
    if (/^[-•*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-•*]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 list-disc space-y-1 pl-5">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Párrafo estándar
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith(">") &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^[-•*]\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    elements.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInline(paraLines.join(" "))}
      </p>
    );
  }

  return elements;
}

export function MarkdownMessage({
  content,
  severity,
  quickActions = [],
  onQuickAction,
  compact = false,
}: MarkdownMessageProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API restricted in insecure context
    }
  };

  return (
    <div
      className="space-y-2.5 text-sm leading-relaxed"
      data-testid="chat-markdown-container"
    >
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          {severity ? (
            <span
              data-testid="chat-severity-badge"
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[severity]}`}
            >
              {SEVERITY_LABELS[severity]}
            </span>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            aria-label="Copiar respuesta del asistente"
            data-testid="chat-copy-button"
            className="h-8 min-w-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Copiar
              </>
            )}
          </Button>
        </div>
      )}

      <div className="space-y-2 break-words">{parseMarkdownBlocks(content)}</div>

      {quickActions.length > 0 && onQuickAction ? (
        <div
          className="flex flex-wrap gap-2 border-t border-border/60 pt-2.5"
          data-testid="chat-quick-actions"
        >
          {quickActions.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onQuickAction(action)}
              className="min-h-11 text-xs font-medium"
            >
              {action.kind === "calendar" ? (
                <CalendarPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              ) : action.kind === "inventory" ? (
                <PackageSearch className="mr-1.5 h-4 w-4" aria-hidden="true" />
              ) : null}
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
