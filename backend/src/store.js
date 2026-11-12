import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

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

export function createStore(file) {
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
