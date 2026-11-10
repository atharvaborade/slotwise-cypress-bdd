import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const fault = process.env.LAB_FAULT || '';
if (fault && (process.env.NODE_ENV !== 'test' || !['double-booking', 'ownership'].includes(fault))) {
  throw new Error('LAB_FAULT is available only in test mode with a supported fault name.');
}
const dbPath = resolve(process.env.DB_PATH || '.data/appointments.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), provider TEXT NOT NULL, slot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed');`);
if (fault !== 'double-booking') db.exec("CREATE UNIQUE INDEX IF NOT EXISTS active_slot ON appointments(provider,slot) WHERE status='confirmed'");
const hashPassword = (password, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 64));
}
if (process.env.LAB_ADMIN_PASSWORD) {
  if (process.env.LAB_ADMIN_PASSWORD.length < 12) throw new Error('LAB_ADMIN_PASSWORD requires at least 12 characters');
  db.prepare('INSERT OR IGNORE INTO users(name,email,password,role) VALUES (?,?,?,?)').run('Lab administrator', 'admin@example.test', hashPassword(process.env.LAB_ADMIN_PASSWORD), 'admin');
}
const app = express();
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', (req, res, next) => {
  // Reject cross-origin writes; same-site cookies and JSON-only APIs provide additional barriers.
  if (!['GET', 'HEAD'].includes(req.method) && req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Cross-origin writes are not allowed' });
  next();
});
const attempts = new Map();
function throttle(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
  const key = req.ip;
  const entry = attempts.get(key) || { count: 0, until: now + 60_000 };
  attempts.set(key, entry); entry.count++;
  if (entry.count > (process.env.NODE_ENV === 'test' ? 1000 : 30)) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
  next();
}
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role });
const digest = token => createHash('sha256').update(token).digest('hex');
function createSession(res, user) {
  const token = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token), user.id, Date.now() + 8 * 60 * 60 * 1000);
  res.cookie('session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 60 * 60 * 1000, path: '/' });
}
function auth(req, res, next) {
  const token = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('session='))?.slice(8);
  const user = token && db.prepare('SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(digest(token), Date.now());
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  req.user = user; req.sessionToken = token; next();
}
const credentials = z.object({ email: z.email().max(254).transform(x => x.toLowerCase()), password: z.string().min(12).max(128) });
function parse(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Check the fields: valid email, password of 12–128 characters, and required values.' }); return null; }
  return parsed.data;
}
app.get('/api/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); });
app.post('/api/register', throttle, (req, res) => {
  const input = parse(credentials.extend({ name: z.string().trim().min(1).max(80) }).strict(), req, res); if (!input) return;
  try {
    const result = db.prepare('INSERT INTO users(name,email,password) VALUES (?,?,?)').run(input.name, input.email, hashPassword(input.password));
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);
    createSession(res, user); res.status(201).json({ user: publicUser(user) });
  } catch (error) { if (String(error).includes('UNIQUE')) return res.status(409).json({ error: 'An account with this email already exists' }); throw error; }
});
app.post('/api/login', throttle, (req, res) => {
  const input = parse(credentials, req, res); if (!input) return;
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(input.email);
  if (!user || !verifyPassword(input.password, user.password)) return res.status(401).json({ error: 'Email or password is incorrect' });
  createSession(res, user); res.json({ user: publicUser(user) });
});
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token=?').run(digest(req.sessionToken)); res.clearCookie('session', { path: '/' }); res.status(204).end();
});
const providers = [{ id: 'maya', name: 'Maya Shah', specialty: 'Career coaching', initials: 'MS' }, { id: 'alex', name: 'Alex Morgan', specialty: 'Portfolio review', initials: 'AM' }, { id: 'sam', name: 'Sam Patel', specialty: 'Interview practice', initials: 'SP' }];
app.get('/api/providers', (_req, res) => res.json({ providers }));
function validSlot(slot) {
  if (!/^\d{4}-\d{2}-\d{2}T(?:09|10|11|14|15|16):00:00\.000Z$/.test(slot)) return false;
  const date = new Date(slot);
  return Number.isFinite(date.getTime()) && date.toISOString() === slot && date.getTime() > Date.now() && date.getTime() < Date.now() + 90 * 86400000;
}
app.get('/api/slots', auth, (req, res) => {
  const provider = providers.find(p => p.id === req.query.provider);
  if (!provider) return res.status(400).json({ error: 'Choose a provider' });
  const taken = new Set(db.prepare("SELECT slot FROM appointments WHERE provider=? AND status='confirmed'").all(provider.id).map(x => x.slot));
  const slots = [];
  for (let day = 1; day <= 7; day++) for (const hour of [9,10,11,14,15,16]) {
    const date = new Date(); date.setUTCDate(date.getUTCDate()+day); date.setUTCHours(hour,0,0,0);
    const slot = date.toISOString(); if (!taken.has(slot)) slots.push(slot);
  }
  res.json({ slots });
});
app.get('/api/appointments', auth, (req, res) => res.json({ appointments: db.prepare('SELECT id,provider,slot,status FROM appointments WHERE user_id=? ORDER BY slot').all(req.user.id) }));
app.post('/api/appointments', auth, (req, res) => {
  const input = parse(z.object({ provider: z.enum(['maya','alex','sam']), slot: z.string().refine(validSlot) }).strict(), req, res); if (!input) return;
  try {
    const result = db.prepare('INSERT INTO appointments(user_id,provider,slot) VALUES (?,?,?)').run(req.user.id, input.provider, input.slot);
    res.status(201).json({ appointment: db.prepare('SELECT id,provider,slot,status FROM appointments WHERE id=?').get(result.lastInsertRowid) });
  } catch (error) { if (String(error).includes('UNIQUE')) return res.status(409).json({ error: 'That time was just booked. Choose another slot.' }); throw error; }
});
app.delete('/api/appointments/:id', auth, (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid appointment ID' });
  const row = db.prepare('SELECT * FROM appointments WHERE id=?').get(req.params.id);
  if (!row || (fault !== 'ownership' && row.user_id !== req.user.id)) return res.status(404).json({ error: 'Appointment not found' });
  if (row.status !== 'confirmed') return res.status(409).json({ error: 'Appointment already cancelled' });
  db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(row.id); res.status(204).end();
});
app.get('/api/admin/summary', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
  res.json({ users: db.prepare('SELECT count(*) AS count FROM users').get().count, appointments: db.prepare("SELECT count(*) AS count FROM appointments WHERE status='confirmed'").get().count });
});
app.use(express.static(resolve('public')));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body exceeds the 10kb limit' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error('Request failed:', error.code || error.name); res.status(500).json({ error: 'Unexpected server error' });
});
const server = app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Appointment Lab listening on port ${process.env.PORT || 3000}`));
function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
