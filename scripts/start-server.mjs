import fs from 'node:fs';
import { spawn } from 'node:child_process';

const serverPath = fs.existsSync('dist/server/index.mjs')
  ? 'dist/server/index.mjs'
  : '.output/server/index.mjs';

const child = spawn(process.execPath, [serverPath], { stdio: 'inherit' });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
