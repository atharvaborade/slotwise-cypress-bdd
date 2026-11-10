import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import { selectors } from '../../common/selectors.js';

Given('I am an authenticated Slotwise member', function () {
  cy.registerByApi().then(member => { this.member = member; });
  cy.visit('/');
  cy.get(selectors.workspace).should('be.visible');
});

When('I book the first available appointment', function () {
  cy.get(`${selectors.slot} option`).first().invoke('val').then(slot => { this.bookedSlot = slot; });
  cy.bookFirstAvailableSlot();
});

Then('a confirmed appointment should be listed', () => {
  cy.contains(selectors.appointments, 'Confirmed').should('be.visible');
});

When('I choose the coach {string}', (coach) => {
  cy.contains(`${selectors.providers} button`, coach).click().should('have.attr', 'aria-pressed', 'true');
});

Then('the confirmed appointment should be with {string}', (coach) => {
  cy.contains(`${selectors.appointments} article`, coach).should('contain.text', 'Confirmed');
});

Given('I have a confirmed appointment', function () {
  cy.get(`${selectors.slot} option`).first().invoke('val').then(slot => { this.bookedSlot = slot; });
  cy.bookFirstAvailableSlot();
  cy.contains(selectors.appointments, 'Confirmed').should('be.visible');
});

When('I cancel the confirmed appointment', () => {
  cy.contains('button', 'Cancel appointment').click();
  cy.contains(selectors.notice, 'Appointment cancelled').should('be.visible');
});

Then('the appointment should be marked as cancelled', () => {
  cy.contains(selectors.appointments, 'Cancelled').should('be.visible');
});

Then('the released appointment time should become available', function () {
  cy.get(selectors.slot).find(`option[value="${this.bookedSlot}"]`).should('exist');
});

