export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>No se pudo cargar la página</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f3f6f2" />
    <style>
      :root { color-scheme: light dark; --background: #f3f6f2; --card: #fff; --foreground: #202a23; --muted: #526156; --border: #d5ded6; --primary: #245c3d; --primary-foreground: #fff; --secondary: #e9eee9; }
      @media (prefers-color-scheme: dark) { :root { --background: #141b16; --card: #1c261f; --foreground: #ebf1ea; --muted: #b9c5ba; --border: #37453a; --primary: #9fc8a5; --primary-foreground: #142018; --secondary: #26312a; } }
      * { box-sizing: border-box; }
      body { font: 15px/1.55 system-ui, -apple-system, sans-serif; background: var(--background); color: var(--foreground); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; transition: background-color 220ms ease, color 220ms ease; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2.25rem; background: var(--card); border: 1px solid var(--border); border-radius: 1rem; box-shadow: 0 18px 45px rgb(22 39 29 / 8%); }
      h1 { font-size: 1.4rem; letter-spacing: -0.02em; margin: 0 0 0.6rem; }
      p { color: var(--muted); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.65rem; justify-content: center; flex-wrap: wrap; }
      a, button { min-height: 2.75rem; padding: 0.55rem 1rem; border-radius: 0.625rem; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid transparent; transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease; }
      a:focus-visible, button:focus-visible { outline: 3px solid var(--primary); outline-offset: 3px; }
      .primary { background: var(--primary); color: var(--primary-foreground); }
      .secondary { background: var(--secondary); color: var(--foreground); border-color: var(--border); }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; } }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>No se pudo cargar esta página</h1>
      <p>Ocurrió un problema. Puedes intentarlo de nuevo o volver al inicio.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Reintentar</button>
        <a class="secondary" href="/">Ir al inicio</a>
      </div>
    </div>
  </body>
</html>`;
}
