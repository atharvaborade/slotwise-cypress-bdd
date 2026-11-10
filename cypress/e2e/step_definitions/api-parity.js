import { Before, Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

const password = 'Synthetic-password-2026!';
const unique = prefix => `${prefix}-${Date.now()}-${Cypress._.random(1e9)}@example.test`;
const cookie = response => String(response.headers['set-cookie'] || '').match(/session=([^;]+)/)?.[1];
const supportedHours = [9, 10, 11, 14, 15, 16];
let scenarioSequence = 0;
let scenarioSlots = new Map();

Before(function () {
  this.data = { accounts: {}, appointments: {} };
  scenarioSlots = new Map();
  return cy.task('nextScenarioSequence').then(sequence => { scenarioSequence = sequence; });
});

function futureSlot(label, visible = false) {
  if (scenarioSlots.has(label)) return scenarioSlots.get(label);
  const hash = [...label].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const date = new Date();
  const position = scenarioSequence * supportedHours.length + scenarioSlots.size;
  date.setUTCDate(date.getUTCDate() + (visible ? 1 + hash % 7 : 8 + Math.floor(position / supportedHours.length)));
  date.setUTCHours(supportedHours[position % supportedHours.length], 0, 0, 0);
  const slot = date.toISOString();
  scenarioSlots.set(label, slot);
  return slot;
}
function registration(problem) {
  const data = { name: 'Casey Example', email: unique('member'), password };
  const changes = {
    'blank name': () => { data.name = '   '; }, 'missing name': () => { delete data.name; },
    'oversized name': () => { data.name = 'N'.repeat(81); }, 'invalid email': () => { data.email = 'not-an-email'; },
    'oversized email': () => { data.email = `${'a'.repeat(250)}@example.test`; }, 'short password': () => { data.password = 'short'; },
    'oversized password': () => { data.password = 'p'.repeat(129); }, 'client admin role': () => { data.role = 'admin'; },
    'unexpected field': () => { data.unexpected = 'rejected'; }, 'a one-character name': () => { data.name = 'C'; },
    'an eighty-character name': () => { data.name = 'N'.repeat(80); }, 'a twelve-character password': () => { data.password = 'p'.repeat(12); },
    'a 128-character password': () => { data.password = 'p'.repeat(128); },
  };
  if (!changes[problem]) throw new Error(`Unknown registration example: ${problem}`);
  changes[problem](); return data;
}
function request(world, alias, method, url, body, extra = {}) {
  const account = alias && world.data.accounts[alias];
  return cy.task('httpRequest', { method, url, body, headers: extra.headers, token: account?.token }).then(response => { world.response = response; return response; });
}
function createAccount(world, alias, overrides = {}) {
  const account = { name: alias, email: unique(alias), password, ...overrides };
  return cy.task('httpRequest', { method: 'POST', url: '/api/register', body: { name: account.name, email: account.email, password: account.password } })
    .then(response => {
      expect(response.status).to.eq(201); account.user = response.body.user; account.token = cookie(response);
      world.data.accounts[alias] = account; return account;
    });
}
function history(world, alias) { return request(world, alias, 'GET', '/api/appointments').then(response => { expect(response.status).to.eq(200); return response.body.appointments; }); }
function reserve(world, alias, provider, label, slot = futureSlot(label)) {
  return request(world, alias, 'POST', '/api/appointments', { provider, slot }).then(response => {
    expect(response.status).to.eq(201); world.data.appointments[label] = response.body.appointment; return response.body.appointment;
  });
}
function visitor(world) { const alias = `visitor-${Cypress._.random(1e9)}`; world.data.visitor = alias; world.data.accounts[alias] = {}; return alias; }

Given('a member named {string} exists', function (alias) { return createAccount(this, alias); });
Given('members named {string} and {string} exist', function (first, second) { return createAccount(this, first).then(() => createAccount(this, second)); });
When('an anonymous visitor sends {string} to {string}', function (method, path) {
  const body = method === 'POST' && path === '/api/appointments' ? { provider: 'maya', slot: futureSlot('anonymous') } : undefined;
  return request(this, null, method, path, body);
});
Then('the response status is {int}', function (status) { expect(this.response.status).to.eq(status); });
Then('the response error is {string}', function (message) { expect(this.response.body.error).to.eq(message); });
Then('the response content type is JSON', function () { expect(this.response.headers['content-type']).to.match(/^application\/json/); });

When('a visitor registers with a padded name and mixed-case email', function () {
  const alias = visitor(this); const data = { name: '  Casey Example  ', email: unique('casey').toUpperCase(), password };
  this.data.registration = data;
  return request(this, alias, 'POST', '/api/register', data).then(response => { this.data.accounts[alias].token = cookie(response); });
});
When('a visitor submits registration with {string}', function (problem) { const alias = visitor(this); return request(this, alias, 'POST', '/api/register', registration(problem)); });
When('a visitor registers with {string}', function (boundary) {
  const alias = visitor(this); this.data.registration = registration(boundary);
  return request(this, alias, 'POST', '/api/register', this.data.registration).then(response => { this.data.accounts[alias].token = cookie(response); });
});
Then('the registered identity is normalized and contains no password', function () {
  const user = this.response.body.user; expect(user.name).to.eq(this.data.registration.name.trim()); expect(user.email).to.eq(this.data.registration.email.toLowerCase());
  expect(user.role).to.eq('member'); expect(Object.keys(user).sort()).to.deep.eq(['email','id','name','role']);
});
Then('that visitor can retrieve the same member identity', function () {
  const expected = this.response.body.user; return request(this, this.data.visitor, 'GET', '/api/me').then(response => expect(response.body.user).to.deep.eq(expected));
});
Then('the visitor remains signed out', function () { return request(this, this.data.visitor, 'GET', '/api/me').then(response => expect(response.status).to.eq(401)); });
When("another visitor registers with the owner's email in uppercase", function () {
  const alias = visitor(this); return request(this, alias, 'POST', '/api/register', { name:'Other', email:this.data.accounts.owner.email.toUpperCase(), password });
});
When('a visitor signs in with {string}', function (problem) {
  const alias = visitor(this); const owner = this.data.accounts.owner; const data = { email:owner.email, password:owner.password };
  if (problem === 'wrong password') data.password='Incorrect-password-2026!'; else if (problem === 'unknown email') data.email=unique('unknown');
  else if (problem === 'invalid email') data.email='not-an-email'; else if (problem === 'short password') data.password='short'; else if (problem === 'missing password') delete data.password;
  return request(this, alias, 'POST', '/api/login', data);
});
When("a visitor signs in using the owner's email in uppercase", function () {
  const alias=visitor(this), owner=this.data.accounts.owner;
  return request(this, alias, 'POST', '/api/login', {email:owner.email.toUpperCase(),password:owner.password}).then(response => { this.data.accounts[alias].token=cookie(response); });
});
Then('the session cookie is HTTP-only and same-site strict', function () { const value=String(this.response.headers['set-cookie']); expect(value).to.match(/HttpOnly/i); expect(value).to.match(/SameSite=Strict/i); });
Then('the response identity contains no password', function () { expect(Object.keys(this.response.body.user).sort()).to.deep.eq(['email','id','name','role']); });
When('that visitor signs out and replays the old session cookie', function () {
  const alias=this.data.visitor, old=this.data.accounts[alias].token;
  return request(this,alias,'POST','/api/logout').then(()=>{this.data.accounts.replay={token:old};return request(this,'replay','GET','/api/me');});
});
When('a visitor requests their identity with a fabricated session cookie', function () { const alias=visitor(this);this.data.accounts[alias].token='a'.repeat(64);return request(this,alias,'GET','/api/me'); });
When('{string} requests the administrator summary', function (alias) { return request(this,alias,'GET','/api/admin/summary'); });
Given('the configured administrator is signed in', function () {
  this.data.accounts.administrator={}; return request(this,'administrator','POST','/api/login',{email:'admin@example.test',password:'Synthetic-admin-password-2026!'}).then(r=>{expect(r.status).to.eq(200);this.data.accounts.administrator.token=cookie(r);});
});
When('the administrator requests the summary', function () { return request(this,'administrator','GET','/api/admin/summary'); });
Then('the summary contains numeric user and confirmed-appointment totals', function () { expect(this.response.body.users).to.be.a('number');expect(this.response.body.appointments).to.be.a('number'); });

When('{string} requests available times for {string}', function (alias,provider) { return request(this,alias,'GET',`/api/slots?provider=${provider}`); });
Then('the available times are unique supported UTC hours in the next seven days', function () {
  const slots=this.response.body.slots;expect(slots.length).to.be.greaterThan(0);expect(new Set(slots).size).to.eq(slots.length);
  slots.forEach(slot=>{const date=new Date(slot);expect(date.toISOString()).to.eq(slot);expect(supportedHours).to.include(date.getUTCHours());});
  expect(slots).to.deep.eq([...slots].sort());
});
When('{string} requests availability with {string}', function (alias,problem) { return request(this,alias,'GET',problem==='no provider'?'/api/slots':'/api/slots?provider=unknown'); });
When('{string} books a future {string} appointment called {string}', function (alias,provider,label) {
  return request(this,alias,'POST','/api/appointments',{provider,slot:futureSlot(label)}).then(r=>{if(r.status===201)this.data.appointments[label]=r.body.appointment;});
});
Given('{string} has a future {string} appointment called {string}', function (alias,provider,label) { return reserve(this,alias,provider,label); });
Then('{string} sees {string} as {string} in their appointment history', function (alias,label,status) { return history(this,alias).then(items=>expect(items.find(x=>x.id===this.data.appointments[label].id)).to.deep.eq({...this.data.appointments[label],status})); });
Then('{string} has no appointments', function (alias) { return history(this,alias).then(items=>expect(items).to.deep.eq([])); });
Then('{string} sees exactly one appointment', function (alias) { return history(this,alias).then(items=>expect(items).to.have.length(1)); });
Given('{string} has two appointments created in reverse time order', function (alias) { const times=[futureSlot('chronology-one'),futureSlot('chronology-two')].sort();return reserve(this,alias,'alex','later',times[1]).then(()=>reserve(this,alias,'sam','earlier',times[0])); });
When('{string} cancels appointment {string}', function (alias,label) { return request(this,alias,'DELETE',`/api/appointments/${this.data.appointments[label].id}`); });
Then('{string} sees their appointments ordered by time', function (alias) { return history(this,alias).then(items=>expect(items.map(x=>x.id)).to.deep.eq([this.data.appointments.earlier.id,this.data.appointments.later.id])); });
When('{string} attempts to book the same coach and time as {string}', function (alias,label) { const {provider,slot}=this.data.appointments[label];return request(this,alias,'POST','/api/appointments',{provider,slot}); });
When('both members simultaneously request the same future {string} appointment', function (provider) {
  const requests=['owner','other'].map(alias=>({method:'POST',url:'/api/appointments',body:{provider,slot:futureSlot('concurrent')},token:this.data.accounts[alias].token}));
  return cy.task('parallelRequests',requests).then(responses=>{this.data.concurrentResponses=responses;});
});
Then('exactly one request succeeds with 201 and the other receives 409', function () { expect(this.data.concurrentResponses.map(x=>x.status).sort()).to.deep.eq([201,409]); });
Then('exactly one confirmed appointment exists across those two accounts', function () { return history(this,'owner').then(a=>history(this,'other').then(b=>{expect([...a,...b]).to.have.length(1);expect([...a,...b][0].status).to.eq('confirmed');})); });
When('the members reserve different coaches at the same future time', function () {
  const slot=futureSlot('different-coaches');return request(this,'owner','POST','/api/appointments',{provider:'maya',slot}).then(a=>request(this,'other','POST','/api/appointments',{provider:'alex',slot}).then(b=>{this.data.parallelResponses=[a,b];}));
});
Then('both requests succeed with 201', function () { expect(this.data.parallelResponses.map(x=>x.status)).to.deep.eq([201,201]); });
Then('each member sees only their own confirmed appointment', function () { return history(this,'owner').then(a=>history(this,'other').then(b=>{expect(a).to.have.length(1);expect(b).to.have.length(1);expect(a[0].provider).to.eq('maya');expect(b[0].provider).to.eq('alex');})); });
When('{string} cancels using {string}', function (alias,id) { return request(this,alias,'DELETE',`/api/appointments/${id}`); });
When('{string} requests an appointment with {string}', function (alias,problem) {
  const data={provider:'maya',slot:futureSlot('invalid-booking')},date=new Date(data.slot);
  const changes={
    'a past date':()=>data.slot='2020-01-01T09:00:00.000Z','a malformed date':()=>data.slot='not-a-date','a date beyond 90 days':()=>{date.setUTCDate(date.getUTCDate()+100);data.slot=date.toISOString();},
    'an impossible date':()=>data.slot=`${new Date().getUTCFullYear()}-02-30T09:00:00.000Z`,'a noncanonical timestamp':()=>data.slot=data.slot.replace('.000Z','Z'),'an unsupported hour':()=>{date.setUTCHours(8);data.slot=date.toISOString();},
    'nonzero minutes':()=>{date.setUTCMinutes(30);data.slot=date.toISOString();},'an unknown provider':()=>data.provider='unknown','no provider':()=>delete data.provider,'no slot':()=>delete data.slot,
    'client-supplied owner':()=>data.user_id=this.data.accounts[alias].user.id,'client-supplied status':()=>data.status='cancelled'};
  changes[problem]();return request(this,alias,'POST','/api/appointments',data);
});
Given('{string} chooses a visible future time for {string}', function (alias,provider) { const date=new Date();date.setUTCDate(date.getUTCDate()+7);date.setUTCHours(16,0,0,0);this.data.visible={alias,provider,slot:date.toISOString()}; });
When('{string} reserves that visible time', function (alias) { return reserve(this,alias,this.data.visible.provider,'visible',this.data.visible.slot); });
Then('the time is absent from {string} availability for {string}', function (provider,alias) { return request(this,alias,'GET',`/api/slots?provider=${provider}`).then(r=>expect(r.body.slots).not.to.include(this.data.visible.slot)); });
Then('the time remains available for {string} to {string}', function (provider,alias) { return request(this,alias,'GET',`/api/slots?provider=${provider}`).then(r=>expect(r.body.slots).to.include(this.data.visible.slot)); });
Then('the time is available again for {string} to {string}', function (provider,alias) { return request(this,alias,'GET',`/api/slots?provider=${provider}`).then(r=>expect(r.body.slots).to.include(this.data.visible.slot)); });

When('a visitor checks application health and discovers coaches', function () { return cy.request('/api/health').then(h=>cy.request('/api/providers').then(c=>{this.data.health=h.body;this.data.catalogue=c.body;})); });
Then('health is reported as {string}', function (status) { expect(this.data.health).to.deep.eq({status}); });
Then('the catalogue contains all three distinct coaches and their specialties', function () { expect(this.data.catalogue.providers.map(({id,name,specialty})=>({id,name,specialty}))).to.deep.eq([{id:'maya',name:'Maya Shah',specialty:'Career coaching'},{id:'alex',name:'Alex Morgan',specialty:'Portfolio review'},{id:'sam',name:'Sam Patel',specialty:'Interview practice'}]); });
When('{string} sends malformed JSON to {string}', function (alias,path) { return request(this,alias,'POST',path,'{"unclosed":',{headers:{'Content-Type':'application/json'}}); });
When('a visitor sends a JSON registration body larger than the supported limit', function () { return request(this,null,'POST','/api/register',{name:'N'.repeat(11*1024),email:unique('large'),password}); });
When('{string} attempts a cross-origin {string}', function (alias,operation) {
  const account=this.data.accounts[alias],headers={Origin:'https://untrusted.example'};
  const calls={registration:()=>request(this,alias,'POST','/api/register',{name:'X',email:unique('x'),password},{headers}),'sign-in':()=>request(this,alias,'POST','/api/login',{email:account.email,password:account.password},{headers}),
    'sign-out':()=>request(this,alias,'POST','/api/logout',undefined,{headers}),booking:()=>request(this,alias,'POST','/api/appointments',{provider:'sam',slot:futureSlot('cross-origin')},{headers}),cancellation:()=>request(this,alias,'DELETE',`/api/appointments/${this.data.appointments.protected.id}`,undefined,{headers})};
  return calls[operation]();
});
Then('{string} is still signed in', function (alias) { return request(this,alias,'GET','/api/me').then(r=>expect(r.body.user.id).to.eq(this.data.accounts[alias].user.id)); });
Then('private responses are not cached and browser security headers are present', function () { const h=this.response.headers;expect(h['cache-control']).to.eq('no-store');expect(h['x-content-type-options']).to.eq('nosniff');expect(h['x-frame-options']).to.eq('SAMEORIGIN');expect(h['content-security-policy']).to.include("default-src 'self'"); });
