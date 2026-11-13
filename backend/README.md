# BookSpace — API REST (Sprint 3)

Back-end acadêmico em **Node.js + Express 5**, com cadastro/login, catálogo de livros e CRUD de aluguéis. Usa arquivo JSON no computador e **PostgreSQL (Supabase)** quando a variável segura `DATABASE_URL` é configurada no servidor.

## Como iniciar

1. Instale Node.js **20 ou superior**.
2. Abra o terminal na pasta `backend`.
3. Execute:

```bash
npm install
npm run dev
```

4. Abra **http://localhost:3000/api/health** no navegador. A resposta contém `status: "ok"` e `database: "arquivo-local"` (ou `"postgresql"` quando o banco online está conectado).
5. Para os testes automatizados, rode `npm test`.

Sem `DATABASE_URL`, os dados ficam em `backend/data/db.json` (criado automaticamente e ignorado no Git). Com `DATABASE_URL`, o servidor passa a salvar usuários, livros e aluguéis no PostgreSQL, sem modificar as rotas. Os quatro livros iniciais são criados automaticamente quando a base está vazia. Configure variáveis apenas no ambiente do servidor (veja `.env.example`).


## Banco de dados permanente no Render + Supabase

1. Em <https://supabase.com/dashboard>, crie um projeto gratuito (por exemplo, `bookspace`) e guarde a senha do banco **somente para você**.
2. Abra o projeto no Supabase, clique em **Connect** e selecione **Session pooler** (porta **5432**, compatível com conexões IPv4). Copie a URL completa `postgresql://...` e substitua `[YOUR-PASSWORD]` pela senha do projeto. Se a senha tiver caracteres especiais como `@` ou `#`, codifique esses caracteres para URL.
3. No Render, abra o serviço da API → **Environment → Add Environment Variable**. Use a chave **`DATABASE_URL`** e o valor dessa URL. **Nunca coloque a URL/senha no GitHub ou no Netlify.** Salve e faça redeploy.
4. Abra **https://projeto-empresa-fict-cia.onrender.com/api/health**. A resposta deve conter `"status":"ok"` e `"database":"postgresql"`. Isso confirma leitura do banco de dados.
5. Faça um cadastro novo no site e teste o login. Contas anteriores guardadas no arquivo local/temporário **não são migradas automaticamente**.

O servidor cria automaticamente a estrutura `bookspace_private.state` no PostgreSQL, numa área privada não exposta pela API REST do Supabase. O estado é salvo em coluna JSONB com transações e bloqueio de linha, preservando as regras existentes da API e evitando conflitos entre dois aluguéis simultâneos. Para consultar usuários **somente no SQL Editor do Supabase**, sem revelar senhas:

```sql
SELECT usuario->>'name' AS nome, usuario->>'email' AS email
FROM bookspace_private.state,
LATERAL jsonb_array_elements(data->'users') AS usuario;
```

O servidor mantém tokens de sessão em memória, então após uma reinicialização será necessário fazer login novamente. Dados do PostgreSQL permanecem armazenados. Nunca compartilhe a variável `DATABASE_URL` ou os hashes das senhas.

## Rotas

| Método | Rota | Função | Precisa de token? |
| --- | --- | --- | --- |
| GET | `/api/health` | Testar se a API está ativa | Não |
| GET | `/api/livros` | Listar livros; aceita `?q=` e `?genero=` | Não |
| GET | `/api/livros/:id` | Detalhar livro | Não |
| POST | `/api/auth/cadastro` | Criar usuário | Não |
| POST | `/api/auth/login` | Entrar e obter token | Não |
| POST | `/api/auth/logout` | Encerrar sessão | Sim |
| GET | `/api/usuarios/me` | Consultar próprio perfil | Sim |
| PUT | `/api/usuarios/me` | Atualizar próprio perfil | Sim |
| GET | `/api/alugueis` | Listar aluguéis do usuário | Sim |
| POST | `/api/alugueis` | Alugar um ou vários livros | Sim |
| PUT | `/api/alugueis/:id` | Registrar devolução | Sim |
| DELETE | `/api/alugueis/:id` | Excluir registro já devolvido | Sim |

## Demonstração no Postman / Insomnia

**1 — Cadastro** (POST `http://localhost:3000/api/auth/cadastro`):

```json
{
  "name": "Suellen Teste",
  "email": "suellen.teste@example.com",
  "phone": "48999999999",
  "password": "senha123"
}
```

A resposta contém `user` e `token`. Copie o token e use nos próximos pedidos o cabeçalho:

```text
Authorization: Bearer SEU_TOKEN_AQUI
```

**2 — Criar aluguel** (POST `/api/alugueis`):

```json
{ "bookIds": [1, 2] }
```

Alternativamente, `{ "bookId": 1 }`. Guarde o `id` do aluguel retornado.

**3 — Ler aluguéis** (GET `/api/alugueis`): confira os registros.

**4 — Atualizar aluguel** (PUT `/api/alugueis/ID_DO_ALUGUEL`):

```json
{ "status": "Devolvido" }
```

**5 — Excluir aluguel** (DELETE `/api/alugueis/ID_DO_ALUGUEL`). A exclusão exige registrar a devolução antes.

## Como integrar ao front-end

O site (pasta `Projeto-empresa-fictícia`) já está integrado à API REST usando `fetch` nos endpoints abaixo:

- login/cadastro: `/api/auth/login` e `/api/auth/cadastro`
- catálogo e detalhes: `/api/livros` e `/api/livros/:id`
- finalizar carrinho: `POST /api/alugueis` com `{ "bookIds": [1, 2] }`
- meus aluguéis: `GET`, `PUT` e `DELETE /api/alugueis`
- minha conta: `GET` e `PUT /api/usuarios/me`

Abra o front-end com **Live Server** na porta 5500, enquanto a API estiver rodando na porta 3000. Para requisições autenticadas, envie o token no cabeçalho `Authorization: Bearer ...`.

## Observações importantes

Este é um back-end **didático, para execução local e apresentação**, não um sistema pronto para produção. As senhas recebem hash com `scrypt`; usuários só acessam seus próprios aluguéis; o servidor impede alugar um livro indisponível. As sessões ficam em memória, portanto é preciso fazer login novamente após reiniciar o servidor. O arquivo JSON é adequado ao protótipo local. Para demonstrar online, use PostgreSQL com `DATABASE_URL`; para uma aplicação comercial, ainda seriam necessárias autenticação/sessões persistentes, backups e infraestrutura apropriada.
