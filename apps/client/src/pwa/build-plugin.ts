import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Precache only public static assets; HTML navigation always goes to the network. */
export function pwaBuild(): Plugin {
  let root = '';
  return {
    name: 'bingo-pwa',
    apply: 'build',
    configResolved(config) { root = config.root; },
    generateBundle(_options, bundle) {
      const template = readFileSync(path.join(root, 'src/pwa/service-worker.js'), 'utf8');
      const files = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png',
        '/icons/favicon-32.png', '/icons/favicon-64.png', '/apple-touch-icon.png'];
      for (const folder of ['unreal-balls', 'unreal-icons']) {
        files.push(...readdirSync(path.join(root, 'public/images', folder)).filter(name => name.endsWith('.png')).sort()
          .map(name => `/images/${folder}/${name}`));
      }
      files.push('/images/stage/machine-back.webp', '/images/stage/machine-front.webp');
      const hash = createHash('sha256').update(template);
      for (const file of files) hash.update(readFileSync(path.join(root, 'public', file)));
      for (const [file, output] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        if (/\.(js|css)$/.test(file)) {
          files.push(`/${file}`);
          hash.update(output.type === 'chunk' ? output.code : output.source);
        }
      }
      const version = hash.digest('hex').slice(0, 16);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template
        .replace('__BUILD_VERSION__', version)
        .replace('__PRECACHE_ASSETS__', JSON.stringify(files)) });
    },
  };
}
