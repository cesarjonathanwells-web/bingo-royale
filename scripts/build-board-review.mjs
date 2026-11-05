/** Build the real board components into a file://-friendly review page.
 * No HTTP server, app session, game state, or production build is involved.
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = path.join(repo, 'apps/client');
const require = createRequire(path.join(client, 'package.json'));
const { build } = await import(pathToFileURL(require.resolve('vite')).href);
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href);
const { default: tailwindcss } = await import(pathToFileURL(require.resolve('@tailwindcss/vite')).href);
const output = path.resolve(process.argv[2] || '/private/tmp/bingo-board-experience-20261105/review.html');

const result = await build({
  root: client,
  configFile: false,
  plugins: [react(), tailwindcss()],
  // Vite's library mode intentionally leaves NODE_ENV for consumers. This
  // artifact runs directly in a browser, so resolve React's production branch.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  resolve: { alias: { '@': path.join(client, 'src') } },
  publicDir: false,
  logLevel: 'warn',
  build: {
    write: false,
    minify: false,
    cssCodeSplit: false,
    lib: {
      entry: path.join(client, 'src/dev/BoardExperienceReview.tsx'),
      name: 'BingoBoardReview',
      formats: ['iife'],
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
const css = outputs.filter(item => item.type === 'asset' && item.fileName.endsWith('.css'))
  .map(item => typeof item.source === 'string' ? item.source : Buffer.from(item.source).toString('utf8')).join('\n');
const images = pathToFileURL(path.join(client, 'public/images/')).href;
const js = outputs.filter(item => item.type === 'chunk').map(item => item.code).join('\n')
  .replaceAll('/images/', images).replaceAll('</script', '<\\/script');
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>Bingo Royale · Board experience review</title><style>' + css + '</style></head>'
  + '<body><div id="root"></div><script>' + js + '</script></body></html>';
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), cssBytes: Buffer.byteLength(css), serverRequired: false }));
