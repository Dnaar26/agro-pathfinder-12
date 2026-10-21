import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const candidates = ["dist/server/index.mjs", ".output/server/index.mjs"];
const serverPath = candidates
  .map((candidate) => path.resolve(process.cwd(), candidate))
  .find((candidate) => fs.existsSync(candidate));

if (!serverPath) {
  console.error(`No se encontró el servidor compilado. Se esperaba uno de: ${candidates.join(", ")}`);
  console.error("Ejecuta npm run build antes de npm run start.");
  process.exit(1);
}

const child = spawn(process.execPath, [serverPath], { stdio: "inherit" });

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error("No se pudo iniciar el servidor compilado:", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`El servidor terminó por la señal ${signal}`);
  }
  process.exit(code ?? 0);
});
