# BookSpace — sistema web de empréstimo de livros

**Projeto acadêmico de empresa fictícia | ADS 21 | Sprints 1, 2 e 3**

## Problema e público-alvo

O **BookSpace** simula uma biblioteca/serviço de empréstimo gratuito de livros.
Seu público-alvo são **leitores e estudantes** que precisam consultar títulos disponíveis, reservar livros por 14 dias e acompanhar a devolução sem depender de controles manuais.

O projeto foi construído de forma incremental:
- **Sprint 1:** proposta, identidade visual e páginas iniciais em HTML/CSS.
- **Sprint 2:** navegação, formulários, validações e CRUD local em JavaScript.
- **Sprint 3:** API REST e integração das páginas com cadastro/login, livros e aluguéis.

## Funcionalidades

- Cadastro e login com validação dos campos.
- Catálogo de livros, pesquisa por título/autor e filtro de gênero.
- Detalhes, disponibilidade e carrinho de livros.
- Empréstimo gratuito por **14 dias**, consulta de registros e devolução.
- Exclusão de registro somente após devolução.
- Atualização de dados do usuário.
- Mensagens de erro e layout adaptável para celular e desktop.
- Dados persistidos no servidor em JSON para demonstração local.

## Tecnologias e estrutura

| Pasta/arquivo | Finalidade |
| --- | --- |
| `Projeto-empresa-fictícia/` | Front-end em HTML, CSS e JavaScript |
| `Projeto-empresa-fictícia/script.js` | Navegação, validações e chamadas `fetch` para a API |
| `backend/` | API REST em Node.js + Express |
| `backend/src/app.js` | Rotas HTTP e regras de negócio |
| `backend/src/store.js` | Persistência de dados em arquivo JSON |
| `backend/test/api.test.js` | Testes automatizados da API |

## Como rodar o sistema inteiro

**Requisito:** Node.js 20+ e VS Code com a extensão Live Server.

1. Faça download/clonagem do repositório e abra a pasta no VS Code.
2. Abra um terminal na pasta `backend` e execute:

```bash
npm install
npm run dev
```

3. Confira no navegador: **http://localhost:3000/api/health** (deve mostrar o status `ok`).
4. No VS Code, abra `Projeto-empresa-fictícia/index.html` com **Open with Live Server** (porta **5500**).
5. Crie uma conta, entre, escolha um livro disponível, adicione ao carrinho e finalize o aluguel. Depois, em **Meus aluguéis**, registre a devolução e exclua o registro.

> **Importante:** A API e o Live Server devem continuar em execução ao mesmo tempo. Não basta abrir o HTML com duplo clique. O endereço padrão da API é `http://localhost:3000/api`. Para outra hospedagem, configure `window.BOOKSPACE_API_URL` antes de carregar `script.js` ou ajuste a constante `API_URL`. Se o Live Server escolher outra porta, adicione sua origem na variável `CORS_ORIGINS` do back-end.

Para executar os testes, na pasta `backend`:

```bash
npm test
```

## CRUD usado na apresentação

| Ação | Método HTTP | Endpoint |
| --- | --- | --- |
| Criar aluguel | POST | `/api/alugueis` |
| Consultar aluguéis | GET | `/api/alugueis` |
| Registrar devolução | PUT | `/api/alugueis/:id` |
| Excluir registro devolvido | DELETE | `/api/alugueis/:id` |

Os dados são consultados e alterados no **servidor**, não apenas no navegador. O carrinho permanece temporariamente na sessão do navegador até a finalização. A API também possui rotas para autenticação, perfil e consulta de livros. Veja os exemplos completos em [backend/README.md](backend/README.md).

## Integrantes

- Suellen Sagas
- Ana Julia
- Julia Zonta
- Felipe Gralha

**Atenção para a avaliação:** cada integrante deve realizar contribuições próprias com commits reais identificáveis. O relatório final deve descrever apenas o que foi efetivamente feito e testado.

## Escopo acadêmico

A API usa arquivo JSON local e sessões em memória: reiniciar o servidor exige novo login. Não está preparada para hospedagem pública ou dados reais de usuários. Para produção, seriam necessários banco de dados gerenciado, autenticação persistente e outras medidas de segurança.

## Entrega da Sprint 3

O ZIP da disciplina deve conter quatro PDFs: `repositorio.pdf`, `commits.pdf`, `sistema.pdf` e `relatorio_sprint3.pdf`. Gerar evidências do projeto realmente funcionando, enviar até as 22h na data da disciplina e apresentar o sistema ao vivo.
