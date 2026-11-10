import { Before, After } from '@badeball/cypress-cucumber-preprocessor';

Before(function ({ pickle }) {
  this.scenarioName = pickle.name;
  this.startedAt = new Date().toISOString();
});

After(function () {
  cy.task('log', `[BDD] ${this.scenarioName} completed`, { log: false });
});

