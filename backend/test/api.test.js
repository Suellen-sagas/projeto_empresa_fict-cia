import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../src/app.js';

let server;
let root;
let base;
const makeUser = (email) => ({ name: 'Pessoa Teste', email, phone: '48999999999', password: 'senha123!' });

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'bookspace-test-'));
  server = createApp({ dbFile: path.join(root, 'db.json') }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

async function request(method, endpoint, data, token) {
  const response = await fetch(`${base}${endpoint}`, {
    method,
    headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

test('health e catalogo respondem sem login', async () => {
  const health = await request('GET', '/api/health');
  const books = await request('GET', '/api/livros?q=pr%C3%ADncipe');
  assert.equal(health.status, 200);
  assert.equal(books.status, 200);
  assert.equal(books.body.length, 1);
  assert.equal(books.body[0].id, 3);
});

test('cadastro, login, perfil, CRUD de alugueis e persistencia', async () => {
  const createdUser = await request('POST', '/api/auth/cadastro', makeUser('teste@bookspace.com'));
  assert.equal(createdUser.status, 201);
  assert.ok(createdUser.body.token);
  assert.ok(!('passwordHash' in createdUser.body.user));
  const token = createdUser.body.token;

  const duplicate = await request('POST', '/api/auth/cadastro', makeUser('teste@bookspace.com'));
  assert.equal(duplicate.status, 409);
  assert.equal((await request('POST', '/api/auth/login', { email: 'teste@bookspace.com', password: 'errada' })).status, 401);
  assert.equal((await request('GET', '/api/alugueis')).status, 401);
  assert.equal((await request('POST', '/api/auth/login', { email: 'teste@bookspace.com', password: 'senha123!' })).status, 200);

  const other = await request('POST', '/api/auth/cadastro', makeUser('outra@bookspace.com'));
  assert.equal(other.status, 201);
  const secondToken = other.body.token;

  assert.equal((await request('POST', '/api/alugueis', { bookIds: [1, 1] }, token)).status, 400);
  assert.equal((await request('POST', '/api/alugueis', { bookId: 4 }, token)).status, 409);
  const rental = await request('POST', '/api/alugueis', { bookIds: [1, 2] }, token);
  assert.equal(rental.status, 201);
  assert.equal(rental.body.length, 2);
  const id = rental.body[0].id;

  assert.equal((await request('POST', '/api/alugueis', { bookId: 1 }, secondToken)).status, 409);
  assert.equal((await request('GET', '/api/livros/1')).body.available, false);
  assert.equal((await request('GET', '/api/alugueis', undefined, secondToken)).body.length, 0);
  assert.equal((await request('PUT', `/api/alugueis/${id}`, { status: 'Devolvido' }, secondToken)).status, 404);
  assert.equal((await request('DELETE', `/api/alugueis/${id}`, undefined, token)).status, 409);

  const returned = await request('PUT', `/api/alugueis/${id}`, { status: 'Devolvido' }, token);
  assert.equal(returned.status, 200);
  assert.equal(returned.body.status, 'Devolvido');
  assert.equal((await request('GET', '/api/livros/1')).body.available, true);
  assert.equal((await request('DELETE', `/api/alugueis/${id}`, undefined, token)).status, 204);
  assert.equal((await request('GET', '/api/alugueis', undefined, token)).body.length, 1);

  const update = await request('PUT', '/api/usuarios/me', { name: 'Pessoa Atualizada', email: 'teste@bookspace.com', phone: '(48) 99999-9999' }, token);
  assert.equal(update.status, 200);
  assert.equal(update.body.name, 'Pessoa Atualizada');
  const fileContents = JSON.parse(await readFile(path.join(root, 'db.json'), 'utf8'));
  assert.equal(fileContents.users.length, 2);
  assert.equal(fileContents.rentals.length, 1);
  assert.ok(fileContents.users.every((u) => !('password' in u) && u.passwordHash));

  assert.equal((await request('POST', '/api/auth/logout', undefined, token)).status, 204);
  assert.equal((await request('GET', '/api/usuarios/me', undefined, token)).status, 401);
});
