// `npm run deploy:app`: builds the app (with .env.production, so it uses the live-editing server) and uploads
// dist/ as the static-files Worker "neest" (cloud/app.wrangler.jsonc). Needs `npx wrangler login` once.
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run('npm run build');
run('npx wrangler deploy --config cloud/app.wrangler.jsonc');
