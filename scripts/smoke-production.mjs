const baseUrlValue = process.env.SMOKE_BASE_URL ?? process.env.RENDER_EXTERNAL_URL;

if (!baseUrlValue) {
  console.error("Define SMOKE_BASE_URL con la URL pública de producción.");
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(baseUrlValue);
} catch {
  console.error("SMOKE_BASE_URL debe ser una URL válida.");
  process.exit(1);
}

if (baseUrl.protocol !== "https:" && process.env.SMOKE_ALLOW_HTTP !== "true") {
  console.error("SMOKE_BASE_URL debe usar HTTPS en producción. Para una prueba local explícita use SMOKE_ALLOW_HTTP=true.");
  process.exit(1);
}

baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "");
baseUrl.search = "";
baseUrl.hash = "";

async function request(path) {
  const url = new URL(path, `${baseUrl.origin}${baseUrl.pathname}/`);
  const response = await fetch(url, {
    headers: { accept: "application/json, text/html, text/plain" },
    signal: AbortSignal.timeout(15_000),
  });

  return {
    response,
    body: await response.text(),
    url: url.toString(),
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checks = [
  async () => {
    const { response, body } = await request("/healthz");
    assert(response.status === 200, `/healthz respondió ${response.status}`);
    assert(body.trim() === "ok", "/healthz no devolvió el cuerpo esperado");
    assert(response.headers.get("x-request-id"), "/healthz no devolvió X-Request-Id");
    assert(response.headers.get("x-content-type-options") === "nosniff", "/healthz no devolvió headers de seguridad");
    return "/healthz OK";
  },
  async () => {
    const { response, body } = await request("/readyz");
    assert(response.status === 200, `/readyz no está listo: HTTP ${response.status} ${body}`);
    const payload = JSON.parse(body);
    assert(payload.status === "ready", `/readyz devolvió estado ${payload.status}`);
    assert(Object.values(payload.checks ?? {}).every(Boolean), "/readyz reportó una dependencia no disponible");
    return "/readyz OK";
  },
  async () => {
    const { response, body } = await request("/auth?mode=login");
    assert(response.status === 200, `/auth?mode=login respondió ${response.status}`);
    assert(body.length > 0, "/auth?mode=login devolvió una respuesta vacía");
    return "/auth?mode=login OK";
  },
];

try {
  const results = [];
  for (const check of checks) results.push(await check());
  console.log(`Smoke de producción correcto para ${baseUrl.origin}`);
  for (const result of results) console.log(`- ${result}`);
} catch (error) {
  console.error(`Smoke de producción fallido para ${baseUrl.origin}:`, error instanceof Error ? error.message : error);
  process.exit(1);
}
