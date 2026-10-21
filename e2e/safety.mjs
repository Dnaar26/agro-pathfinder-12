const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalTarget(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (url.protocol === "http:" || url.protocol === "https:") && LOCAL_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

export function assertE2ETargetAllowed({ baseURL, apiURLs = [], allowRemote, explicitEmail }) {
  const hasRemoteTarget = !isLocalTarget(baseURL) || apiURLs.some((apiURL) => !isLocalTarget(apiURL));
  if (!hasRemoteTarget) return;

  if (!allowRemote) {
    throw new Error("E2E bloqueado: BASE_URL o Supabase apuntan a un destino remoto. Para continuar, configura E2E_ALLOW_REMOTE=true y usa un proyecto exclusivo de pruebas.");
  }

  if (!explicitEmail) {
    throw new Error("E2E remoto requiere E2E_AUTH_EMAIL explícito para evitar crear o modificar una cuenta predeterminada.");
  }
}
