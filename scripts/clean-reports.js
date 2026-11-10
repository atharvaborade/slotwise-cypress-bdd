import { rmSync } from 'node:fs';

for (const path of ['cypress/reports', 'cypress/screenshots', 'cypress/videos']) {
  rmSync(path, { recursive: true, force: true });
}
console.log('Removed generated reports, screenshots and videos.');

