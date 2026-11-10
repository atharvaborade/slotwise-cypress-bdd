import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import { selectors } from '../../common/selectors.js';

Given('I open the Slotwise registration page', () => {
  cy.visit('/');
  cy.get(selectors.authForm).should('be.visible');
});

When('I register with valid unique details', function () {
  cy.fixture('users').then(({ validMember }) => cy.uniqueEmail(validMember.emailPrefix).then(email => {
    this.member = { ...validMember, email };
    cy.get(selectors.name).type(this.member.name);
    cy.get(selectors.email).type(this.member.email);
    cy.get(selectors.password).type(this.member.password, { log: false });
    cy.get(selectors.authSubmit).click();
  }));
});

Then('the booking workspace should be displayed', () => {
  cy.get(selectors.workspace).should('be.visible');
});

Then('my member name should be shown', function () {
  cy.get(selectors.identity).should('have.text', this.member.name);
});

When('I submit invalid registration details', () => {
  cy.fixture('users').then(({ invalidMember }) => {
    cy.get(selectors.name).type(invalidMember.name);
    cy.get(selectors.email).invoke('attr', 'type', 'text').type(invalidMember.email);
    cy.get(selectors.password).type(invalidMember.password, { log: false });
    cy.get(selectors.authSubmit).click();
  });
});

Then('the registration should remain on screen', () => {
  cy.get(selectors.authForm).should('be.visible');
});

Then('an invalid-field message should be displayed', () => {
  cy.get(selectors.notice).should('contain.text', 'Check the fields');
});

Given('an existing member account', function () {
  cy.registerByApi().then(member => { this.member = member; });
  cy.clearCookies();
});

When('I switch to sign in', () => {
  cy.get(selectors.authToggle).click();
  cy.get(selectors.authSubmit).should('have.text', 'Sign in');
});

When('I sign in with the existing credentials', function () {
  cy.get(selectors.email).type(this.member.email);
  cy.get(selectors.password).type(this.member.password, { log: false });
  cy.get(selectors.authSubmit).click();
});

When('I sign out', () => {
  cy.get(selectors.logout).click();
});

Then('the registration form should be displayed', () => {
  cy.get(selectors.authForm).should('be.visible');
});

