import './commands.js';
import 'cypress-axe';
import 'cypress-real-events/support';

beforeEach(() => {
  cy.clearCookies();
  cy.clearLocalStorage();
});

afterEach(function () {
  if (this.currentTest?.state === 'failed') {
    cy.screenshot(`failure-${Cypress.spec.name}-${this.currentTest.title}`, {
      capture: 'runner',
    });
  }
});

