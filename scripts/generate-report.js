import reporter from 'multiple-cucumber-html-reporter';
import { existsSync, mkdirSync } from 'node:fs';

const jsonDir = 'cypress/reports/cucumber-json';
if (!existsSync(`${jsonDir}/cucumber-report.json`)) {
  throw new Error('No Cucumber JSON found. Run npm test before generating the report.');
}
mkdirSync('cypress/reports/cucumber-html', { recursive: true });
reporter.generate({
  jsonDir,
  reportPath: 'cypress/reports/cucumber-html',
  pageTitle: 'Slotwise Cypress BDD Report',
  reportName: 'Slotwise Cypress Quality Report',
  displayDuration: true,
  metadata: {
    browser: { name: 'Chrome' },
    device: 'Local / GitHub-hosted runner',
    platform: { name: process.platform },
  },
  customData: {
    title: 'Execution information',
    data: [
      { label: 'Project', value: 'Slotwise Cypress BDD' },
      { label: 'Framework', value: 'Cypress + Cucumber + JavaScript' },
      { label: 'Generated', value: new Date().toISOString() },
    ],
  },
});
console.log('HTML report: cypress/reports/cucumber-html/index.html');

