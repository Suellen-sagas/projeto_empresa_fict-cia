import express from 'express';
import cors from 'cors';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { createStore } from './store.js';

const scrypt = promisify(scryptCallback);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function publicUser({ id, name, email, phone }) {
  return { id, name, email, phone };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = await scrypt(password, salt, 64);
  return `${salt}:${digest.toString('hex')}`;
}

async function matchesPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2 || !/^[a-f0-9]{32}$/i.test(parts[0]) || !/^[a-f0-9]{128}$/i.test(parts[1])) return false;
  const expected = Buffer.from(parts[1], 'hex');
  const received = await scrypt(password, parts[0], expected.length);
  return timingSafeEqual(expected, received);
}

function validateProfile(body) {
  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim().toLowerCase();
  const phone = String(body?.phone ?? '').replace(/\D/g, '');
  if (name.length < 3 || name.length > 100) fail(400, 'O nome deve ter entre 3 e 100 caracteres.');
  if (email.length > 254 || !EMAIL.test(email)) fail(400, 'Informe um e-mail válido.');
  if (phone.length < 10 || phone.length > 11) fail(400, 'Informe telefone com DDD.');
  return { name, email, phone };
}

function validatePassword(password, optional = false) {
  if (optional && (password === undefined || password === '')) return false;
  if (typeof password !== 'string' || password.length < 6 || password.length > 128)
    fail(400, 'A senha deve ter de 6 a 128 caracteres.');
  return true;
}

function bookAvailable(db, book) {
  return Boolean(book.available) && !db.rentals.some((r) => r.bookId === book.id && r.status === 'Em andamento');
}

function showBook(db, book) {
  return { ...book, available: bookAvailable(db, book) };
}

function showRental(db, rental) {
  const book = db.books.find((b) => b.id === rental.bookId);
  return { ...rental, book: book ? showBook(db, book) : null };
}

export function createApp({ dbFile = process.env.DB_FILE || path.resolve('data/db.json') } = {}) {
  const app = express();
  const store = createStore(dbFile);
  // Sessoes em memoria: reiniciar o servidor exige login novamente.
  const sessions = new Map();
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((x) => x.trim()).filter(Boolean);

  app.disable('x-powered-by');
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: '32kb' }));

  function createSession(userId) {
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId, expiresAt: Date.now() + 7 * DAY_MS });
    return token;
  }

  async function requireAuth(req, _res, next) {
    try {
      const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(req.get('Authorization') || '');
      const token = match?.[1];
      const session = token && sessions.get(token);
      if (!session || session.expiresAt <= Date.now()) {
        if (token) sessions.delete(token);
        fail(401, 'Entre na sua conta para continuar.');
      }
      const user = await store.read((db) => db.users.find((u) => u.id === session.userId));
      if (!user) fail(401, 'Sessão inválida. Faça login novamente.');
      req.user = publicUser(user);
      req.token = token;
      next();
    } catch (error) { next(error); }
  }

  app.get('/api/health', async (_req, res, next) => {
    try {
      // Verifica a leitura real do armazenamento, nao apenas se o servidor esta de pe.
      await store.read(() => null);
      res.json({
        status: 'ok',
        service: 'BookSpace API',
        database: process.env.DATABASE_URL ? 'postgresql' : 'arquivo-local'
      });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/cadastro', async (req, res) => {
    const profile = validateProfile(req.body);
    validatePassword(req.body?.password);
    const passwordHash = await hashPassword(req.body.password);
    const user = await store.change((db) => {
      if (db.users.some((u) => u.email === profile.email)) fail(409, 'Este e-mail já está cadastrado.');
      const created = { id: randomUUID(), ...profile, passwordHash };
      db.users.push(created);
      return { result: publicUser(created), changed: true };
    });
    res.status(201).json({ user, token: createSession(user.id) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!EMAIL.test(email) || typeof password !== 'string') fail(400, 'Informe e-mail e senha.');
    const user = await store.read((db) => db.users.find((u) => u.email === email));
    if (!user || !(await matchesPassword(password, user.passwordHash))) fail(401, 'E-mail ou senha incorretos.');
    res.json({ user: publicUser(user), token: createSession(user.id) });
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    sessions.delete(req.token);
    res.status(204).send();
  });

  app.get('/api/usuarios/me', requireAuth, (req, res) => res.json(req.user));

  app.put('/api/usuarios/me', requireAuth, async (req, res) => {
    const profile = validateProfile(req.body);
    const changePassword = validatePassword(req.body?.password, true);
    const passwordHash = changePassword ? await hashPassword(req.body.password) : null;
    const user = await store.change((db) => {
      if (db.users.some((u) => u.email === profile.email && u.id !== req.user.id)) fail(409, 'Este e-mail já está cadastrado.');
      const target = db.users.find((u) => u.id === req.user.id);
      if (!target) fail(404, 'Usuário não encontrado.');
      Object.assign(target, profile);
      if (passwordHash) target.passwordHash = passwordHash;
      return { result: publicUser(target), changed: true };
    });
    res.json(user);
  });

  app.get('/api/livros', async (req, res) => {
    const q = String(req.query.q || '').trim().toLocaleLowerCase('pt-BR');
    const genre = String(req.query.genero || '').trim().toLocaleLowerCase('pt-BR');
    const books = await store.read((db) => db.books
      .filter((b) => (!q || `${b.title} ${b.author}`.toLocaleLowerCase('pt-BR').includes(q)) &&
        (!genre || b.genre.toLocaleLowerCase('pt-BR') === genre))
      .map((b) => showBook(db, b)));
    res.json(books);
  });

  app.get('/api/livros/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) fail(400, 'ID de livro inválido.');
    const book = await store.read((db) => {
      const found = db.books.find((b) => b.id === id);
      return found ? showBook(db, found) : null;
    });
    if (!book) fail(404, 'Livro não encontrado.');
    res.json(book);
  });

  app.get('/api/alugueis', requireAuth, async (req, res) => {
    const rentals = await store.read((db) => db.rentals
      .filter((r) => r.userId === req.user.id)
      .map((r) => showRental(db, r)));
    res.json(rentals);
  });

  app.post('/api/alugueis', requireAuth, async (req, res) => {
    const ids = req.body?.bookIds ?? (req.body?.bookId === undefined ? null : [req.body.bookId]);
    if (!Array.isArray(ids) || !ids.length || ids.length > 10 ||
        ids.some((id) => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length)
      fail(400, 'Informe bookId ou bookIds (até 10 IDs únicos de livros).');

    const created = await store.change((db) => {
      for (const id of ids) {
        const book = db.books.find((b) => b.id === id);
        if (!book) fail(404, `Livro ${id} não encontrado.`);
        if (!bookAvailable(db, book)) fail(409, `Livro ${id} está indisponível.`);
      }
      const start = new Date();
      const end = new Date(start.getTime() + 14 * DAY_MS);
      const iso = (date) => date.toISOString().slice(0, 10);
      const rentals = ids.map((bookId) => ({
        id: randomUUID(), userId: req.user.id, bookId,
        start: iso(start), end: iso(end), status: 'Em andamento'
      }));
      db.rentals.push(...rentals);
      return { result: rentals.map((r) => showRental(db, r)), changed: true };
    });
    res.status(201).json(created);
  });

  app.put('/api/alugueis/:id', requireAuth, async (req, res) => {
    if (req.body?.status !== 'Devolvido') fail(400, 'A atualização permitida é status = "Devolvido".');
    const updated = await store.change((db) => {
      const rental = db.rentals.find((r) => r.id === req.params.id && r.userId === req.user.id);
      if (!rental) fail(404, 'Aluguel não encontrado.');
      if (rental.status === 'Devolvido') fail(409, 'Este aluguel já foi devolvido.');
      rental.status = 'Devolvido';
      return { result: showRental(db, rental), changed: true };
    });
    res.json(updated);
  });

  app.delete('/api/alugueis/:id', requireAuth, async (req, res) => {
    await store.change((db) => {
      const index = db.rentals.findIndex((r) => r.id === req.params.id && r.userId === req.user.id);
      if (index === -1) fail(404, 'Aluguel não encontrado.');
      if (db.rentals[index].status !== 'Devolvido') fail(409, 'Registre a devolução antes de excluir o aluguel.');
      db.rentals.splice(index, 1);
      return { result: null, changed: true };
    });
    res.status(204).send();
  });

  app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição muito grande.' });
    if (!error.status || error.status >= 500) console.error(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno no servidor.' });
  });
  return app;
}
