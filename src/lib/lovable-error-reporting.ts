import { captureAppError } from "@/lib/services/error-monitoring";

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  captureAppError(error, {
    source: "react_error_boundary",
    ...context,
  });
}
