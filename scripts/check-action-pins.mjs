import { readFileSync, readdirSync } from 'node:fs';
for (const name of readdirSync('.github/workflows')) {
  const text = readFileSync(`.github/workflows/${name}`, 'utf8');
  for (const match of text.matchAll(/uses:\s+([^\s#]+)/g)) {
    if (!/^[^@]+@[a-f0-9]{40}$/.test(match[1])) {
      throw new Error(`Action must use a full commit SHA: ${match[1]}`);
    }
  }
}
