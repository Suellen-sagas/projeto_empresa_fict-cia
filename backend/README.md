# BookSpace — API REST (Sprint 3)

Back-end acadêmico em **Node.js + Express 5**, com cadastro/login, catálogo de livros e CRUD de aluguéis. Usa JSON em disco para persistência local, sem precisar instalar banco de dados.

## Como iniciar

1. Instale Node.js **20 ou superior**.
2. Abra o terminal na pasta `backend`.
3. Execute:

```bash
npm install
npm run dev
```

4. Abra **http://localhost:3000/api/health** no navegador. A resposta deve ser `{"status":"ok","service":"BookSpace API"}`.
5. Para os testes automatizados, rode `npm test`.

Por padrão, os dados são salvos em `backend/data/db.json` (gerado automaticamente e ignorado no Git). Os quatro livros do site já vêm cadastrados. `PORT`, `DB_FILE` e `CORS_ORIGINS` podem ser configurados como variáveis de ambiente (veja `.env.example`).

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

O site atual (pasta `Projeto-empresa-fictícia`) usa `localStorage`, então **ainda não está conectado à API**. Na Sprint 3, substituir essa persistência por chamadas `fetch` aos endpoints acima:

- login/cadastro: `/api/auth/login` e `/api/auth/cadastro`
- catálogo e detalhes: `/api/livros` e `/api/livros/:id`
- finalizar carrinho: `POST /api/alugueis` com `{ "bookIds": [1, 2] }`
- meus aluguéis: `GET`, `PUT` e `DELETE /api/alugueis`
- minha conta: `GET` e `PUT /api/usuarios/me`

Abra o front-end com **Live Server** na porta 5500, enquanto a API estiver rodando na porta 3000. Para requisições autenticadas, envie o token no cabeçalho `Authorization: Bearer ...`.

## Observações importantes

Este é um back-end **didático, para execução local e apresentação**, não um sistema pronto para produção. As senhas recebem hash com `scrypt`; usuários só acessam seus próprios aluguéis; o servidor impede alugar um livro indisponível. As sessões ficam em memória, portanto é preciso fazer login novamente após reiniciar o servidor. O arquivo JSON é adequado ao protótipo local, mas em produção seria necessário banco de dados, autenticação persistente segura e infraestrutura apropriada.
