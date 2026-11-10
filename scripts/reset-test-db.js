import { rmSync } from 'node:fs';

for (const suffix of ['', '-shm', '-wal']) {
  rmSync(`.data/cypress.sqlite${suffix}`, { force: true });
}
console.log('Prepared a clean Cypress test database.');
