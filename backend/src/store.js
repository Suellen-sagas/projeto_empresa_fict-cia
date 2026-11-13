import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const INITIAL_BOOKS = [
  {
    id: 1,
    title: 'É Assim que Acaba',
    author: 'Colleen Hoover',
    genre: 'Romance',
    image: 'imagens/livro1.jpg',
    publisher: 'Galera',
    year: 2018,
    description: 'Lily acredita que encontrou uma nova chance para ser feliz, mas acontecimentos do passado fazem com que ela precise tomar decisões importantes sobre sua própria vida.',
    available: true
  },
  {
    id: 2,
    title: 'A Biblioteca da Meia-Noite',
    author: 'Matt Haig',
    genre: 'Ficção',
    image: 'imagens/livro2.jpg',
    publisher: 'Bertrand Brasil',
    year: 2021,
    description: 'Nora encontra uma biblioteca de vidas possíveis e reflete sobre escolhas e arrependimentos.',
    available: true
  },
  {
    id: 3,
    title: 'O Pequeno Príncipe',
    author: 'Antoine de Saint-Exupéry',
    genre: 'Clássico',
    image: 'imagens/livro3.webp',
    publisher: 'Diversas edições',
    year: 1943,
    description: 'Uma história sobre amizade, afeto e o que é essencial na vida.',
    available: true
  },
  {
    id: 4,
    title: 'Harry Potter',
    author: 'J. K. Rowling',
    genre: 'Fantasia',
    image: 'imagens/livro4.jpg',
    publisher: 'Rocco',
    year: 1997,
    description: 'A jornada de um jovem bruxo em uma escola de magia.',
    available: false
  }
];

const createInitialDatabase = () => ({ users: [], books: INITIAL_BOOKS, rentals: [] });

// PostgreSQL (Supabase): guarda o estado em JSONB para manter a mesma API e
// o mesmo comportamento transacional do prototipo local, sem arquivos efemeros.
function createPostgresStore(connectionString) {
  const { Pool } = pg;
  // O pooler Supabase usa a CA privada Supabase Root 2021.
  // Confiamos somente nesta CA publica, preservando verificacao de certificado/host.
  const ca = readFileSync(new URL('../certs/supabase-prod-ca-2021.crt', import.meta.url), 'utf8');
  // node-postgres permite que sslmode da URL substitua o objeto ssl.
  // Removemos os parametros SSL da URL para garantir a verificacao com a CA fornecida.
  const connection = new URL(connectionString);
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
    connection.searchParams.delete(key);
  }
  const pool = new Pool({
    connectionString: connection.toString(),
    ssl: { ca, rejectUnauthorized: true },
    max: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  });
  let initialization;

  async function initialize() {
    if (!initialization) {
      initialization = (async () => {
        const client = await pool.connect();
        try {
          await client.query('CREATE SCHEMA IF NOT EXISTS bookspace_private');
          await client.query(`CREATE TABLE IF NOT EXISTS bookspace_private.state (
            id SMALLINT PRIMARY KEY CHECK (id = 1),
            data JSONB NOT NULL
          )`);
          await client.query(`INSERT INTO bookspace_private.state (id, data)
            VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING`,
          [JSON.stringify(createInitialDatabase())]);
        } finally {
          client.release();
        }
      })().catch((error) => {
        initialization = null; // permite tentar novamente apos falha de rede
        throw error;
      });
    }
    await initialization;
  }

  async function read(reader) {
    await initialize();
    const response = await pool.query('SELECT data FROM bookspace_private.state WHERE id = 1');
    if (!response.rows.length) throw new Error('Banco de dados BookSpace nao inicializado.');
    return reader(response.rows[0].data);
  }

  async function change(mutator) {
    await initialize();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const response = await client.query('SELECT data FROM bookspace_private.state WHERE id = 1 FOR UPDATE');
      if (!response.rows.length) throw new Error('Banco de dados BookSpace nao inicializado.');
      const db = response.rows[0].data;
      const { result, changed = false } = await mutator(db);
      if (changed) {
        await client.query('UPDATE bookspace_private.state SET data = $1::jsonb WHERE id = 1',
          [JSON.stringify(db)]);
      }
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return { read, change };
}

export function createStore(file) {
  if (process.env.DATABASE_URL) return createPostgresStore(process.env.DATABASE_URL);
  const filename = path.resolve(file);
  let queue = Promise.resolve();

  async function load() {
    try {
      return JSON.parse(await readFile(filename, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const db = createInitialDatabase();
      await save(db);
      return db;
    }
  }

  async function save(db) {
    await mkdir(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(db, null, 2) + '\n', { mode: 0o600 });
    await rename(temporary, filename);
  }

  function read(reader) {
    return queue.then(async () => reader(await load()));
  }

  function change(mutator) {
    const task = queue.then(async () => {
      const db = await load();
      const { result, changed = false } = await mutator(db);
      if (changed) await save(db);
      return result;
    });
    queue = task.catch(() => {});
    return task;
  }

  return { read, change };
}
