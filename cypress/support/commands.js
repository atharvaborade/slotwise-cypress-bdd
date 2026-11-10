Cypress.Commands.add('uniqueEmail', (prefix = 'member') => {
  const worker = Cypress.env('ciBuildId') || Cypress.browser.name;
  return cy.wrap(`${prefix}.${worker}.${Date.now()}.${Cypress._.random(100000)}@example.test`, { log: false });
});

Cypress.Commands.add('registerByApi', (overrides = {}) => {
  return cy.fixture('users').then(({ validMember }) => cy.uniqueEmail(validMember.emailPrefix).then(email => {
    const member = { ...validMember, email, ...overrides };
    return cy.request('POST', '/api/register', {
      name: member.name,
      email: member.email,
      password: member.password,
    }).then(response => ({ ...member, response }));
  }));
});

Cypress.Commands.add('loginByApi', ({ email, password }) => {
  return cy.request('POST', '/api/login', { email, password });
});

Cypress.Commands.add('registerThroughUi', (member) => {
  cy.visit('/');
  cy.get('#name').type(member.name);
  cy.get('#email').type(member.email);
  cy.get('#password').type(member.password, { log: false });
  cy.get('#auth-submit').click();
  cy.get('#workspace').should('be.visible');
});

Cypress.Commands.add('bookFirstAvailableSlot', () => {
  cy.get('#slot option').should('have.length.greaterThan', 0);
  cy.get('#slot option').first().invoke('val').then(slot => {
    cy.get('#slot').select(slot);
    cy.get('#book').should('be.enabled').click();
    cy.contains('#notice', 'Appointment confirmed').should('be.visible');
  });
});

