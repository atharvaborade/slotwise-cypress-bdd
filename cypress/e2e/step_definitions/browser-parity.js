import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

const password='Synthetic-password-2026!';
const names={maya:'Maya Shah',alex:'Alex Morgan',sam:'Sam Patel'};
const email=prefix=>`${prefix}-${Date.now()}-${Cypress._.random(1e9)}@example.test`;
const cookie=response=>String(response.headers['set-cookie']||'').match(/session=([^;]+)/)?.[1];
const testTime=(day,hour)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+day);d.setUTCHours(hour,0,0,0);return d.toISOString();};

function createMember(world, overrides={}) {
  const member={name:'Casey Browser',email:email('browser'),password,...overrides};
  return cy.request('POST','/api/register',member).then(response=>{member.token=cookie(response);member.user=response.body.user;world.data.uiCredentials=member;return member;});
}
function openAnonymous(world) { world.data.uiCredentials??={name:'Casey Browser',email:email('browser'),password};cy.clearCookie('session');cy.visit('/');cy.get('#auth-form').should('be.visible'); }
function openMember(world, overrides={}) { return createMember(world,overrides).then(member=>{cy.setCookie('session',member.token);cy.visit('/');cy.contains('h2','Who would you like to meet?').should('be.visible');cy.get('#slot option').should('have.length.greaterThan',0);}); }
function fill(member,withName=false){if(withName)cy.get('#name').clear().type(member.name);cy.get('#email').clear().type(member.email);cy.get('#password').clear().type(member.password,{log:false});}
function choose(world,provider){cy.contains('#providers button',names[provider]).click().should('have.attr','aria-pressed','true');cy.get('#selection').should('have.text',`${names[provider]} · 60 minutes`);world.data.selectedProvider=provider;}
function article(world){return cy.contains('#appointments article',names[world.data.selectedProvider]);}

Given('an anonymous visitor opens Slotwise',function(){openAnonymous(this);});
Given('a member opens their booking workspace',function(){return openMember(this);});
Given('a registered member opens the sign-in form',function(){return createMember(this).then(()=>{openAnonymous(this);cy.get('#auth-toggle').click();});});
Given('a registered member opens the registration form',function(){return createMember(this).then(()=>openAnonymous(this));});
When('the visitor registers through the form',function(){fill(this.data.uiCredentials,true);cy.get('#auth-submit').click();});
Then('their booking workspace and name are displayed',function(){cy.get('#workspace').should('be.visible');cy.get('#identity').should('have.text',this.data.uiCredentials.name);cy.get('#logout').should('be.visible');cy.get('#password').should('have.value','');});
When('the member reloads the page',()=>{cy.reload();cy.get('#workspace').should('be.visible');});
When('the member signs out through the navigation',()=>{cy.get('#logout').click();cy.get('#auth-form').should('be.visible');});
Then('the registration form is displayed',()=>{cy.get('#name').should('be.visible');cy.get('#auth-submit').should('have.text','Create account');cy.request({url:'/api/me',failOnStatusCode:false}).its('status').should('eq',401);});
When('the visitor signs back in through the form',function(){cy.get('#auth-toggle').then($b=>{if($b.is(':visible')&&$b.text().includes('Already'))cy.wrap($b).click();});fill(this.data.uiCredentials);cy.get('#auth-submit').click();});
When('the visitor signs in with an incorrect password through the form',function(){fill(this.data.uiCredentials);cy.get('#password').clear().type('Incorrect-password-2026!',{log:false});cy.get('#auth-submit').click();});
Then('the form explains {string} and can be submitted again',(message)=>{cy.get('#notice').should('have.text',message);cy.get('#auth-submit').should('be.enabled');});
Then('the booking workspace stays hidden',()=>cy.get('#workspace').should('not.be.visible'));
When('the visitor switches to the sign-in form',()=>cy.get('#auth-toggle').click());
When('the visitor switches back to registration',()=>cy.get('#auth-toggle').click());
Then('the name field is hidden and password completion is for an existing account',()=>{cy.get('#name').should('not.be.visible').and('not.have.attr','required');cy.get('#password').should('have.attr','autocomplete','current-password');cy.get('#auth-submit').should('have.text','Sign in');});
Then('the name field is required and password completion is for a new account',()=>{cy.get('#name').should('be.visible').and('have.attr','required');cy.get('#password').should('have.attr','autocomplete','new-password');});
When('the visitor submits registration with an invalid {string} in the browser',function(field){fill(this.data.uiCredentials,true);const values={name:'',email:'invalid-email',password:'short'};if(field==='password'){cy.get('#password').realClick();cy.realPress(['Control','A']);cy.realType('short');}else{cy.get(`#${field}`).clear();if(values[field])cy.get(`#${field}`).type(values[field]);}cy.get('#auth-submit').click();});
Then('the {string} field reports native validation failure',(field)=>{cy.get(`#${field}`).should('match',':invalid').then($e=>expect($e[0].checkValidity()).to.eq(false));});
Then('the browser session is still anonymous',()=>cy.request({url:'/api/me',failOnStatusCode:false}).its('status').should('eq',401));

When('the member selects each coach in turn',function(){['alex','maya','sam'].forEach(provider=>{cy.intercept('GET',`/api/slots?provider=${provider}`).as(`slots-${provider}`);choose(this,provider);cy.wait(`@slots-${provider}`).then(call=>{this.data.lastAvailability=call.response.body.slots;});});});
Then('the last coach is selected and only its times are displayed',function(){cy.get('#selection').should('have.text','Sam Patel · 60 minutes');cy.contains('#providers button','Maya Shah').should('have.attr','aria-pressed','false');cy.get('#slot option').then(options=>expect([...options].map(x=>x.value)).to.deep.eq(this.data.lastAvailability));});
When('the member chooses their reserved test time with {string}',function(provider){const choices={alex:[2,9],maya:[3,10],sam:[6,16]};choose(this,provider);this.data.selectedSlot=testTime(...choices[provider]);cy.get('#slot').select(this.data.selectedSlot);});
When('the member confirms the appointment',()=>cy.get('#book').click());
Then('the selected appointment is shown as confirmed',function(){article(this).should('contain.text','Confirmed').find('button').should('have.text','Cancel appointment');cy.request('/api/appointments').then(r=>{expect(r.body.appointments).to.have.length(1);expect(r.body.appointments[0]).to.include({provider:this.data.selectedProvider,slot:this.data.selectedSlot,status:'confirmed'});});});
When('the member selects {string} and cancels that appointment',function(provider){choose(this,provider);article(this).contains('button','Cancel appointment').click();});
Then('the selected appointment is shown as cancelled without a cancel button',function(){article(this).should('contain.text','Cancelled').find('button').should('not.exist');cy.get('#notice').should('contain.text','Appointment cancelled');});
Then('the selected time is available again',function(){cy.get(`#slot option[value="${this.data.selectedSlot}"]`).should('exist');});
Given('another member reserves that selected time',function(){const primary=this.data.uiCredentials;return createMember(this,{name:'Competitor'}).then(other=>{cy.request({method:'POST',url:'/api/appointments',body:{provider:this.data.selectedProvider,slot:this.data.selectedSlot},headers:{Cookie:`session=${other.token}`}}).its('status').should('eq',201);this.data.uiCredentials=primary;cy.setCookie('session',primary.token);});});
Then('the page explains the time was just booked and allows another attempt',()=>{cy.get('#notice').should('have.text','That time was just booked. Choose another slot.');cy.get('#book').should('be.enabled');});
Then("the member's appointment list is empty",()=>{cy.get('#appointments article').should('not.exist');cy.get('#appointments').should('contain.text','Your next conversation starts here.');cy.request('/api/appointments').its('body.appointments').should('deep.eq',[]);});
Given('another member already has an appointment',function(){return createMember(this,{name:'Other'}).then(other=>cy.request({method:'POST',url:'/api/appointments',body:{provider:'sam',slot:testTime(6,14)},headers:{Cookie:`session=${other.token}`}}));});

When('the member selects Sam while Alex availability is still loading',function(){const alex=testTime(4,14),sam=testTime(4,15);cy.intercept('GET','/api/slots?provider=alex',{delay:500,body:{slots:[alex]}}).as('alexDelayed');cy.intercept('GET','/api/slots?provider=sam',{body:{slots:[sam]}}).as('samFast');cy.contains('#providers button','Alex Morgan').click();cy.contains('#providers button','Sam Patel').click();cy.wait('@samFast');cy.wait('@alexDelayed');this.data.raceExpected=sam;});
Then('Sam remains selected after the delayed Alex response arrives',function(){cy.contains('#providers button','Sam Patel').should('have.attr','aria-pressed','true');cy.get('#selection').should('have.text','Sam Patel · 60 minutes');cy.get('#slot option').then(x=>expect([...x].map(o=>o.value)).to.deep.eq([this.data.raceExpected]));});
When("the member books the coach's final available time",function(){this.data.selectedProvider='sam';this.data.selectedSlot=testTime(5,14);let booked=false;cy.intercept('GET','/api/slots?provider=sam',req=>req.reply({body:{slots:booked?[]:[this.data.selectedSlot]}}));cy.intercept('POST','/api/appointments',req=>req.continue(()=>{booked=true;}));choose(this,'sam');cy.get('#slot').select(this.data.selectedSlot);cy.get('#book').click();cy.get('#notice').should('contain.text','Appointment confirmed');});
Then('no available times are explained and the confirmation button stays disabled',()=>{cy.get('#slot').should('contain.text','No times available');cy.get('#book').should('be.disabled');});

Given('a {string} visitor opens Slotwise on a mobile viewport',function(state){cy.viewport(390,844);return state==='signed-in'?openMember(this):openAnonymous(this);});
Given('a {string} visitor opens Slotwise',function(state){return state==='signed-in'?openMember(this):openAnonymous(this);});
Then('the page fits without horizontal scrolling',()=>cy.document().then(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(doc.defaultView.innerWidth)));
Then('the primary {string} action is visible',(state)=>cy.contains('button',state==='signed-in'?'Confirm appointment':'Create account').should('be.visible'));
Then('the page has no detected WCAG A or AA violations',()=>{cy.injectAxe();cy.checkA11y(undefined,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});});
When('the visitor begins keyboard navigation',()=>cy.realPress('Tab'));
Then('the skip link receives focus',()=>cy.get('.skip').should('be.focused'));
When('the visitor continues to the registration form using the keyboard',()=>{cy.realPress('Tab');cy.realPress('Tab');});
Then('the name field receives focus',()=>cy.get('#name').should('be.focused'));
When('the member confirms the appointment using the keyboard',()=>{cy.get('#slot').focus();cy.realPress('Tab');cy.get('#book').should('be.focused');cy.realPress('Enter');});
When('the member cancels that appointment using the keyboard',function(){article(this).contains('button','Cancel appointment').focus().should('be.focused');cy.realPress('Enter');});
Given('a member whose name contains markup opens their workspace',function(){this.data.dialogs=[];cy.on('window:alert',text=>this.data.dialogs.push(text));return openMember(this,{name:'<img src=x onerror=alert(1)>'});});
Then('the member name is visible as literal text without executable markup',function(){cy.get('#identity').should('have.text','<img src=x onerror=alert(1)>').find('img').should('not.exist');expect(this.data.dialogs).to.deep.eq([]);});
