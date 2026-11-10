import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

When('I request the health endpoint', function () {
  cy.request('/api/health').then(response => { this.response = response; });
});

When('I request appointments without authentication', function () {
  cy.request({ url: '/api/appointments', failOnStatusCode: false }).then(response => { this.response = response; });
});

Given('I register a member through the API', function () {
  cy.registerByApi().then(member => { this.member = member; this.response = member.response; });
});

When('I request the providers endpoint', function () {
  cy.request('/api/providers').then(response => { this.response = response; });
});

Then('the API response status should be {int}', function (status) {
  expect(this.response.status).to.equal(status);
});

Then('the API response should contain status {string}', function (status) {
  expect(this.response.body.status).to.equal(status);
});

Then('the API error should be {string}', function (message) {
  expect(this.response.body.error).to.equal(message);
});

Then('three providers should be returned', function () {
  expect(this.response.body.providers).to.have.length(3);
  expect(this.response.body.providers.map(provider => provider.id)).to.deep.equal(['maya', 'alex', 'sam']);
});

