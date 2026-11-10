const $ = id => document.getElementById(id);
let registering = true, selected = 'maya', providers = [];
let slotRequest = 0, availableSlotCount = 0, bookingInProgress = false;
const dateLabel = slot => new Intl.DateTimeFormat('en-GB', {dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(slot)) + ' UTC';
async function api(path, options = {}) {
  const response = await fetch('/api' + path, { ...options, headers: {'Content-Type':'application/json',...options.headers} });
  const body = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(body.error || 'Please try again.');
  return body;
}
function notice(message) { $('notice').textContent = message; }
async function guarded(button, action) {
  const booking = button === $('book');
  if (booking) bookingInProgress = true;
  button.disabled = true;
  try { await action(); } catch (error) { notice(error.message); } finally {
    if (booking) { bookingInProgress = false; button.disabled = availableSlotCount === 0; }
    else button.disabled = false;
  }
}
async function slots() {
  const request = ++slotRequest;
  const providerId = selected;
  availableSlotCount = 0;
  $('book').disabled = true;
  $('selection').textContent = providers.find(p => p.id === providerId).name + ' · loading times';
  const data = await api('/slots?provider=' + providerId);
  if (request !== slotRequest || providerId !== selected) return;
  availableSlotCount = data.slots.length;
  $('selection').textContent = providers.find(p => p.id === providerId).name + ' · 60 minutes';
  $('slot').replaceChildren(...data.slots.map(slot => { const option = document.createElement('option'); option.value = slot; option.textContent = dateLabel(slot); return option; }));
  if (!data.slots.length) { const option = document.createElement('option'); option.textContent='No times available'; $('slot').append(option); }
  $('book').disabled = !data.slots.length || bookingInProgress;
}
async function appointments() {
  const data = await api('/appointments');
  $('appointments').replaceChildren();
  if (!data.appointments.length) { const p = document.createElement('p'); p.textContent='Your next conversation starts here. Choose a coach and a time.'; $('appointments').append(p); }
  for (const appointment of data.appointments) {
    const article = document.createElement('article'); article.className='appointment'; article.setAttribute('aria-label', 'Appointment with ' + providers.find(p => p.id === appointment.provider).name);
    const title = document.createElement('strong'); title.textContent=providers.find(p => p.id === appointment.provider).name;
    const date = document.createElement('p'); date.className='small'; date.textContent=dateLabel(appointment.slot);
    const status = document.createElement('p'); status.className='small'; status.textContent=appointment.status === 'confirmed' ? 'Confirmed' : 'Cancelled';
    article.append(title,date,status);
    if (appointment.status === 'confirmed') {
      const button = document.createElement('button'); button.className='quiet'; button.textContent='Cancel appointment';
      button.onclick=()=>guarded(button,async()=>{ await api('/appointments/'+appointment.id,{method:'DELETE'}); await Promise.all([appointments(),slots()]); notice('Appointment cancelled. Your time is available again.'); });
      article.append(button);
    }
    $('appointments').append(article);
  }
}
async function workspace(user) {
  $('auth').hidden=true; $('workspace').hidden=false; $('logout').hidden=false; $('identity').textContent=user.name;
  providers=(await api('/providers')).providers;
  $('providers').replaceChildren(...providers.map(provider=>{
    const button=document.createElement('button'); button.className='provider'; button.setAttribute('aria-pressed',String(provider.id===selected));
    const avatar=document.createElement('span'); avatar.className='avatar'; avatar.textContent=provider.initials; avatar.setAttribute('aria-hidden','true');
    const name=document.createElement('strong'); name.textContent=provider.name;
    const specialty=document.createElement('span'); specialty.className='small'; specialty.textContent=provider.specialty;
    button.append(avatar,name,specialty);
    button.onclick=()=>guarded(button,async()=>{ selected=provider.id; for(const item of $('providers').children) item.setAttribute('aria-pressed',String(item===button)); await slots(); });
    return button;
  }));
  await Promise.all([slots(),appointments()]);
}
$('auth-toggle').onclick=()=>{
  registering=!registering; $('name-field').hidden=!registering; $('name').required=registering;
  $('auth-submit').textContent=registering?'Create account':'Sign in'; $('auth-toggle').textContent=registering?'Already have an account? Sign in':'New here? Create an account';
  $('password').autocomplete=registering?'new-password':'current-password'; notice('');
};
$('auth-form').onsubmit=event=>{
  event.preventDefault(); guarded($('auth-submit'),async()=>{
    const input={email:$('email').value,password:$('password').value}; if(registering) input.name=$('name').value;
    const {user}=await api(registering?'/register':'/login',{method:'POST',body:JSON.stringify(input)});
    $('password').value=''; await workspace(user); notice('Welcome, '+user.name+'. Choose a conversation worth your time.');
  });
};
$('book').onclick=()=>guarded($('book'),async()=>{
  await api('/appointments',{method:'POST',body:JSON.stringify({provider:selected,slot:$('slot').value})});
  await Promise.all([slots(),appointments()]); notice('Appointment confirmed. You’re all set.');
});
$('logout').onclick=()=>guarded($('logout'),async()=>{ await api('/logout',{method:'POST'}); location.reload(); });
api('/me').then(({user})=>workspace(user)).catch(()=>{});
