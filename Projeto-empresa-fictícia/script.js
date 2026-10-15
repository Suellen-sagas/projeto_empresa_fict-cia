/* BookSpace • Sprint 2 | JavaScript DOM, eventos, formulários e CRUD local. */
(() => {
  "use strict";
  const P = "bookspace_s2_v4_";
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const get = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(P + key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const put = (key, value) =>
    localStorage.setItem(P + key, JSON.stringify(value));
  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const books = [
    {
      id: 1,
      title: "É Assim que Acaba",
      author: "Colleen Hoover",
      genre: "Romance",
      image: "imagens/livro1.jpg",
      publisher: "Galera",
      year: 2018,
      description:
        "Lily acredita que encontrou uma nova chance para ser feliz, mas acontecimentos do passado fazem com que ela precise tomar decisões importantes sobre sua própria vida.",
      available: true,
    },
    {
      id: 2,
      title: "A Biblioteca da Meia-Noite",
      author: "Matt Haig",
      genre: "Ficção",
      image: "imagens/livro2.jpg",
      publisher: "Bertrand Brasil",
      year: 2021,
      description:
        "Nora encontra uma biblioteca de vidas possíveis e reflete sobre escolhas e arrependimentos.",
      available: true,
    },
    {
      id: 3,
      title: "O Pequeno Príncipe",
      author: "Antoine de Saint-Exupéry",
      genre: "Clássico",
      image: "imagens/livro3.webp",
      publisher: "Diversas edições",
      year: 1943,
      description:
        "Uma história sobre amizade, afeto e o que é essencial na vida.",
      available: true,
    },
    {
      id: 4,
      title: "Harry Potter",
      author: "J. K. Rowling",
      genre: "Fantasia",
      image: "imagens/livro4.jpg",
      publisher: "Rocco",
      year: 1997,
      description: "A jornada de um jovem bruxo em uma escola de magia.",
      available: false,
    },
  ];
  const bookById = (id) => books.find((b) => b.id === Number(id));
  const users = () => get("users", []);
  const session = () => get("session", null);
  const currentUser = () => users().find((u) => u.id === session()?.id);
  const userKey = (kind) => `${kind}_${currentUser()?.id ?? "guest"}`;
  const cart = () => get(userKey("cart"), []);
  const rentals = () => get(userKey("rentals"), []);
  const setCart = (data) => put(userKey("cart"), data);
  const setRentals = (data) => put(userKey("rentals"), data);
  const notify = (msg, error = false) => {
    let el = $("#bs-alert");
    if (!el) {
      el = document.createElement("div");
      el.id = "bs-alert";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.className = `bs-alert${error ? " bs-error" : ""}`;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => (el.hidden = true), 4500);
  };
  // Hash apenas para não salvar a senha em texto claro: NÃO equivale a autenticação segura.
  async function passwordHash(password, salt) {
    const bytes = new TextEncoder().encode(salt + ":" + password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const salt = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random();
  const dateISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const datePlus = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return dateISO(d);
  };
  const displayDate = (iso) =>
    iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "-";
  const activeRent = (id) =>
    rentals().some((r) => r.bookId === id && r.status === "Em andamento");
  function requireUser() {
    if (currentUser()) return true;
    location.replace("index.html");
    return false;
  }
  function navigation() {
    $$(".sair").forEach((a) =>
      a.addEventListener("click", () => localStorage.removeItem(P + "session")),
    );
    const nav = $("header nav");
    if (!nav) return;
    const btn = document.createElement("button");
    btn.className = "bs-menu";
    btn.type = "button";
    btn.textContent = "☰ Menu";
    btn.setAttribute("aria-expanded", "false");
    nav.before(btn);
    btn.addEventListener("click", () => {
      const opened = nav.classList.toggle("bs-nav-open");
      btn.setAttribute("aria-expanded", String(opened));
    });
  }
  function register() {
    const form = $("form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#nome").value.trim(),
        email = $("#email").value.trim().toLowerCase(),
        phone = $("#telefone").value.replace(/\D/g, ""),
        pass = $("#senha").value,
        confirmation = $("#confirmar-senha").value;
      if (name.length < 3) return notify("Digite seu nome completo.", true);
      if (!validEmail(email)) return notify("Digite um e-mail válido.", true);
      if (phone.length < 10 || phone.length > 11)
        return notify("Digite telefone com DDD.", true);
      if (pass.length < 6)
        return notify("A senha precisa ter pelo menos 6 caracteres.", true);
      if (pass !== confirmation)
        return notify("As senhas não coincidem.", true);
      if (!$('input[type="checkbox"]')?.checked)
        return notify("Aceite os termos de uso.", true);
      if (users().some((u) => u.email === email))
        return notify("E-mail já cadastrado neste navegador.", true);
      try {
        const newSalt = salt(),
          id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        const hash = await passwordHash(pass, newSalt);
        put("users", [
          ...users(),
          { id, name, email, phone, salt: newSalt, hash },
        ]);
        put("session", { id });
        location.href = "livros.html";
      } catch (err) {
        notify("Não foi possível cadastrar. Use o Live Server.", true);
        console.error(err);
      }
    });
  }
  function login() {
    const form = $("form");
    if (!form) return;
    $(".options a")?.addEventListener("click", (e) => {
      e.preventDefault();
      notify(
        "Recuperação de senha precisa de um servidor. Para o protótipo, crie outra conta.",
        true,
      );
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#email").value.trim().toLowerCase(),
        pass = $("#senha").value;
      if (!validEmail(email) || !pass)
        return notify("Informe e-mail e senha válidos.", true);
      const user = users().find((u) => u.email === email);
      if (!user) return notify("E-mail ou senha incorretos.", true);
      try {
        if ((await passwordHash(pass, user.salt)) !== user.hash)
          return notify("E-mail ou senha incorretos.", true);
        put("session", { id: user.id });
        location.href = "livros.html";
      } catch (err) {
        notify("Abra o projeto com Live Server.", true);
        console.error(err);
      }
    });
  }
  function catalog() {
    if (!requireUser()) return;
    const grid = $(".grade-livros"),
      input = $(".filtros input"),
      select = $(".filtros select");
    if (!grid) return;
    if (select)
      select.innerHTML =
        '<option value="">Todos os gêneros</option>' +
        [...new Set(books.map((b) => b.genre))]
          .map(
            (g) => `<option value="${escapeHTML(g)}">${escapeHTML(g)}</option>`,
          )
          .join("");
    const render = () => {
      const query = (input?.value || "").trim().toLocaleLowerCase("pt-BR"),
        genre = select?.value || "";
      const results = books.filter(
        (b) =>
          `${b.title} ${b.author}`.toLocaleLowerCase("pt-BR").includes(query) &&
          (!genre || genre === b.genre),
      );
      grid.innerHTML = results.length
        ? results
            .map(
              (b) =>
                `<article class="livro-card"><img src="${b.image}" alt="Capa do livro ${escapeHTML(b.title)}"><div class="livro-info"><span class="genero">${escapeHTML(b.genre)}</span><h2>${escapeHTML(b.title)}</h2><p class="autor">${escapeHTML(b.author)}</p><p class="${b.available && !activeRent(b.id) ? "disponivel" : "indisponivel"}">${b.available && !activeRent(b.id) ? "Disponível" : "Indisponível"}</p><a class="botao" href="livro.html?id=${b.id}">Ver detalhes</a></div></article>`,
            )
            .join("")
        : '<p class="bs-empty">Nenhum livro encontrado.</p>';
    };
    input?.addEventListener("input", render);
    select?.addEventListener("change", render);
    render();
  }
  function detail() {
    if (!requireUser()) return;
    const area = $(".detalhes"),
      id = new URLSearchParams(location.search).get("id"),
      book = bookById(id);
    if (!area) return;
    if (!book) {
      area.innerHTML =
        '<p>Livro não encontrado. <a href="livros.html">Voltar ao catálogo</a></p>';
      return;
    }
    const available = book.available && !activeRent(book.id);
    area.innerHTML = `<img class="capa" src="${book.image}" alt="Capa do livro ${escapeHTML(book.title)}"><div class="informacoes"><span class="genero">${escapeHTML(book.genre)}</span><h1>${escapeHTML(book.title)}</h1><p class="autor">${escapeHTML(book.author)}</p><p class="descricao">${escapeHTML(book.description)}</p><div class="dados"><p><strong>Editora:</strong> ${escapeHTML(book.publisher)}</p><p><strong>Ano:</strong> ${book.year}</p><p><strong>Status:</strong> ${available ? "Disponível" : "Indisponível"}</p><p><strong>Prazo de aluguel:</strong> 14 dias</p></div><button type="button" id="bs-add" class="botao" ${available ? "" : "disabled"}>${available ? "Adicionar ao carrinho" : "Indisponível"}</button></div>`;
    $("#bs-add")?.addEventListener("click", () => {
      if (!available) return;
      if (cart().includes(book.id))
        return notify("Este livro já está no seu carrinho.", true);
      setCart([...cart(), book.id]);
      location.href = "carrinho.html";
    });
  }
  function basket() {
    if (!requireUser()) return;
    const area = $(".carrinho-area");
    if (!area) return;
    function render() {
      const items = cart().map(bookById).filter(Boolean);
      area.innerHTML = `<div class="bs-cart-items">${items.length ? items.map((b) => `<article class="item-carrinho"><img src="${b.image}" alt="Capa de ${escapeHTML(b.title)}"><div class="item-info"><h2>${escapeHTML(b.title)}</h2><p>${escapeHTML(b.author)}</p><p>Período: 14 dias</p><button type="button" class="bs-action bs-remove" data-id="${b.id}">Remover</button></div></article>`).join("") : '<p class="bs-empty">Seu carrinho está vazio.</p>'}</div><aside class="resumo"><h2>Resumo</h2><p>Quantidade de livros: <strong>${items.length}</strong></p><p>Prazo: <strong>14 dias por livro</strong></p><p>Valor: <strong>Gratuito</strong></p><button type="button" class="finalizar bs-action" id="bs-checkout" ${items.length ? "" : "disabled"}>Finalizar aluguel</button><a href="livros.html" class="continuar">Continuar escolhendo</a></aside>`;
      $$(".bs-remove", area).forEach((btn) =>
        btn.addEventListener("click", () => {
          setCart(cart().filter((id) => id !== Number(btn.dataset.id)));
          render();
          notify("Livro removido.");
        }),
      );
      $("#bs-checkout")?.addEventListener("click", () => {
        const valid = cart().filter(
          (id) => bookById(id)?.available && !activeRent(id),
        );
        if (!valid.length)
          return notify("Não há livros disponíveis para finalizar.", true);
        const created = valid.map((bookId) => ({
          id: salt(),
          bookId,
          start: datePlus(0),
          end: datePlus(14),
          status: "Em andamento",
        }));
        setRentals([...rentals(), ...created]);
        setCart([]);
        location.href = "alugueis.html";
      });
    }
    render();
  }
  function myRentals() {
    if (!requireUser()) return;
    const area = $(".alugueis");
    if (!area) return;
    function render() {
      const data = rentals();
      area.innerHTML = data.length
        ? data
            .map((r) => {
              const b = bookById(r.bookId);
              if (!b) return "";
              return `<article class="aluguel-card"><img src="${b.image}" alt="Capa de ${escapeHTML(b.title)}"><div class="aluguel-info"><h2>${escapeHTML(b.title)}</h2><p class="autor">${escapeHTML(b.author)}</p><div class="dados"><p><strong>Retirada:</strong> ${displayDate(r.start)}</p><p><strong>Devolução prevista:</strong> ${displayDate(r.end)}</p></div></div><div class="status"><span>${escapeHTML(r.status)}</span><p>14 dias</p>${r.status === "Em andamento" ? `<button type="button" class="bs-action bs-return" data-id="${escapeHTML(r.id)}">Registrar devolução</button>` : `<button type="button" class="bs-action danger bs-delete" data-id="${escapeHTML(r.id)}">Excluir registro</button>`}</div></article>`;
            })
            .join("")
        : '<p class="bs-empty">Nenhum aluguel registrado. <a href="livros.html">Escolher livros</a></p>';
      $$(".bs-return", area).forEach((btn) =>
        btn.addEventListener("click", () => {
          setRentals(
            rentals().map((r) =>
              r.id === btn.dataset.id ? { ...r, status: "Devolvido" } : r,
            ),
          );
          render();
          notify("Devolução registrada.");
        }),
      );
      $$(".bs-delete", area).forEach((btn) =>
        btn.addEventListener("click", () => {
          if (!confirm("Excluir este registro?")) return;
          setRentals(rentals().filter((r) => r.id !== btn.dataset.id));
          render();
          notify("Registro excluído.");
        }),
      );
    }
    render();
  }
  function profile() {
    if (!requireUser()) return;
    const form = $(".form-perfil"),
      user = currentUser();
    if (!form || !user) return;
    $("#nome").value = user.name;
    $("#email").value = user.email;
    $("#telefone").value = user.phone;
    $(".avatar") &&
      ($(".avatar").textContent = user.name.charAt(0).toUpperCase());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#nome").value.trim(),
        email = $("#email").value.trim().toLowerCase(),
        phone = $("#telefone").value.replace(/\D/g, ""),
        pass = $("#senha").value;
      if (
        name.length < 3 ||
        !validEmail(email) ||
        phone.length < 10 ||
        phone.length > 11
      )
        return notify("Revise nome, e-mail e telefone.", true);
      if (users().some((u) => u.email === email && u.id !== user.id))
        return notify("E-mail já usado por outra conta.", true);
      if (pass && pass.length < 6)
        return notify("Nova senha precisa ter 6 caracteres.", true);
      const update = { ...user, name, email, phone };
      if (pass) {
        try {
          update.salt = salt();
          update.hash = await passwordHash(pass, update.salt);
        } catch (err) {
          return notify("Não foi possível alterar a senha.", true);
        }
      }
      put(
        "users",
        users().map((u) => (u.id === user.id ? update : u)),
      );
      $("#senha").value = "";
      if ($(".avatar")) $(".avatar").textContent = name[0].toUpperCase();
      notify("Dados atualizados com sucesso!");
    });
  }
  navigation();
  const routes = {
    "index.html": login,
    "cadastro.html": register,
    "livros.html": catalog,
    "livro.html": detail,
    "carrinho.html": basket,
    "alugueis.html": myRentals,
    "conta.html": profile,
  };
  const name = location.pathname.split("/").pop() || "index.html";
  routes[name]?.();
})();
