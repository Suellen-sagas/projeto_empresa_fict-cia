/* BookSpace • Sprint 3 | Interface integrada à API REST.
 * Execute o back-end em localhost:3000 e o front-end pelo Live Server (porta 5500).
 * O carrinho fica temporariamente no navegador; contas, livros e aluguéis ficam na API.
 */
(() => {
  "use strict";

  const API_URL = window.BOOKSPACE_API_URL || "http://localhost:3000/api";
  const SESSION_KEY = "bookspace_s3_session";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
    );
  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const displayDate = (iso) =>
    iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "-";

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }
  function saveSession(response) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      token: response.token,
      user: response.user
    }));
  }
  function clearSession() {
    const userId = readSession()?.user?.id;
    sessionStorage.removeItem(SESSION_KEY);
    if (userId) sessionStorage.removeItem("bookspace_s3_cart_" + userId);
  }
  function cartKey() {
    return "bookspace_s3_cart_" + readSession()?.user?.id;
  }
  function cart() {
    try {
      const ids = JSON.parse(sessionStorage.getItem(cartKey()) || "[]");
      return Array.isArray(ids) ? ids.filter(Number.isSafeInteger) : [];
    } catch {
      return [];
    }
  }
  function setCart(ids) {
    sessionStorage.setItem(cartKey(), JSON.stringify(ids));
  }
  function notify(message, error = false) {
    let element = $("#bs-alert");
    if (!element) {
      element = document.createElement("div");
      element.id = "bs-alert";
      element.setAttribute("role", "status");
      document.body.appendChild(element);
    }
    element.className = "bs-alert" + (error ? " bs-error" : "");
    element.textContent = message;
    element.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => { element.hidden = true; }, 5000);
  }
  function showLoading(element) {
    if (element) element.innerHTML = '<p class="bs-empty">Carregando dados...</p>';
  }
  function requireUser() {
    if (readSession()?.token) return true;
    location.replace("index.html");
    return false;
  }
  async function api(endpoint, options = {}) {
    const { method = "GET", data, auth = false } = options;
    const headers = { Accept: "application/json" };
    if (data !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = readSession()?.token;
      if (!token) {
        location.replace("index.html");
        throw new Error("Faça login para continuar.");
      }
      headers.Authorization = "Bearer " + token;
    }
    let response;
    try {
      response = await fetch(API_URL + endpoint, {
        method,
        headers,
        body: data === undefined ? undefined : JSON.stringify(data)
      });
    } catch {
      throw new Error("Não foi possível conectar à API. Inicie o back-end na porta 3000.");
    }
    const payload = response.status === 204
      ? null
      : await response.json().catch(() => null);
    if (!response.ok) {
      if (auth && response.status === 401) {
        clearSession();
        location.replace("index.html");
      }
      throw new Error(payload?.error || "Erro na requisição (" + response.status + ").");
    }
    return payload;
  }

  function navigation() {
    $$(".sair").forEach((link) => link.addEventListener("click", async (event) => {
      event.preventDefault();
      const token = readSession()?.token;
      clearSession();
      try {
        if (token) await fetch(API_URL + "/auth/logout", {
          method: "POST",
          headers: { Authorization: "Bearer " + token }
        });
      } catch (error) {
        console.warn("Não foi possível encerrar a sessão no servidor.", error);
      } finally {
        location.href = "index.html";
      }
    }));
    const nav = $("header nav");
    if (!nav) return;
    const button = document.createElement("button");
    button.className = "bs-menu";
    button.type = "button";
    button.textContent = "☰ Menu";
    button.setAttribute("aria-expanded", "false");
    nav.before(button);
    button.addEventListener("click", () => {
      const opened = nav.classList.toggle("bs-nav-open");
      button.setAttribute("aria-expanded", String(opened));
    });
  }

  function register() {
    const form = $("form");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = $("#nome").value.trim();
      const email = $("#email").value.trim().toLowerCase();
      const phone = $("#telefone").value.replace(/\D/g, "");
      const password = $("#senha").value;
      const confirmation = $("#confirmar-senha").value;
      if (name.length < 3) return notify("Digite seu nome completo.", true);
      if (!validEmail(email)) return notify("Digite um e-mail válido.", true);
      if (phone.length < 10 || phone.length > 11) return notify("Digite telefone com DDD.", true);
      if (password.length < 6) return notify("A senha precisa ter pelo menos 6 caracteres.", true);
      if (password !== confirmation) return notify("As senhas não coincidem.", true);
      if (!$('input[type="checkbox"]')?.checked) return notify("Aceite os termos de uso.", true);

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const response = await api("/auth/cadastro", {
          method: "POST",
          data: { name, email, phone, password }
        });
        saveSession(response);
        location.href = "livros.html";
      } catch (error) {
        notify(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  function login() {
    const form = $("form");
    if (!form) return;
    $(".options a")?.addEventListener("click", (event) => {
      event.preventDefault();
      notify("Recuperação de senha ainda não disponível neste protótipo.", true);
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = $("#email").value.trim().toLowerCase();
      const password = $("#senha").value;
      if (!validEmail(email) || !password) return notify("Informe e-mail e senha válidos.", true);
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const response = await api("/auth/login", {
          method: "POST",
          data: { email, password }
        });
        saveSession(response);
        location.href = "livros.html";
      } catch (error) {
        notify(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  async function catalog() {
    if (!requireUser()) return;
    const grid = $(".grade-livros");
    const input = $(".filtros input");
    const select = $(".filtros select");
    if (!grid) return;
    showLoading(grid);
    const books = await api("/livros");
    if (select) select.innerHTML =
      '<option value="">Todos os gêneros</option>' +
      [...new Set(books.map((book) => book.genre))]
        .map((genre) => '<option value="' + escapeHTML(genre) + '">' + escapeHTML(genre) + '</option>')
        .join("");

    function render() {
      const query = (input?.value || "").trim().toLocaleLowerCase("pt-BR");
      const genre = select?.value || "";
      const results = books.filter((book) =>
        (book.title + " " + book.author).toLocaleLowerCase("pt-BR").includes(query) &&
        (!genre || book.genre === genre)
      );
      grid.innerHTML = results.length
        ? results.map((book) =>
          '<article class="livro-card">' +
          '<img src="' + escapeHTML(book.image) + '" alt="Capa do livro ' + escapeHTML(book.title) + '">' +
          '<div class="livro-info"><span class="genero">' + escapeHTML(book.genre) + '</span>' +
          '<h2>' + escapeHTML(book.title) + '</h2><p class="autor">' + escapeHTML(book.author) + '</p>' +
          '<p class="' + (book.available ? "disponivel" : "indisponivel") + '">' +
          (book.available ? "Disponível" : "Indisponível") + '</p>' +
          '<a class="botao" href="livro.html?id=' + encodeURIComponent(book.id) + '">Ver detalhes</a>' +
          '</div></article>'
        ).join("")
        : '<p class="bs-empty">Nenhum livro encontrado.</p>';
    }
    input?.addEventListener("input", render);
    select?.addEventListener("change", render);
    render();
  }

  async function detail() {
    if (!requireUser()) return;
    const area = $(".detalhes");
    if (!area) return;
    const id = Number(new URLSearchParams(location.search).get("id"));
    if (!Number.isSafeInteger(id) || id < 1) {
      area.innerHTML = '<p>Livro inválido. <a href="livros.html">Voltar ao catálogo</a></p>';
      return;
    }
    showLoading(area);
    let book;
    try {
      book = await api("/livros/" + id);
    } catch (error) {
      area.innerHTML = '<p>Livro não encontrado. <a href="livros.html">Voltar ao catálogo</a></p>';
      throw error;
    }
    area.innerHTML =
      '<img class="capa" src="' + escapeHTML(book.image) + '" alt="Capa do livro ' + escapeHTML(book.title) + '">' +
      '<div class="informacoes"><span class="genero">' + escapeHTML(book.genre) + '</span>' +
      '<h1>' + escapeHTML(book.title) + '</h1><p class="autor">' + escapeHTML(book.author) + '</p>' +
      '<p class="descricao">' + escapeHTML(book.description) + '</p>' +
      '<div class="dados"><p><strong>Editora:</strong> ' + escapeHTML(book.publisher) + '</p>' +
      '<p><strong>Ano:</strong> ' + escapeHTML(book.year) + '</p>' +
      '<p><strong>Status:</strong> ' + (book.available ? "Disponível" : "Indisponível") + '</p>' +
      '<p><strong>Prazo de aluguel:</strong> 14 dias</p></div>' +
      '<button type="button" id="bs-add" class="botao" ' + (book.available ? "" : "disabled") + '>' +
      (book.available ? "Adicionar ao carrinho" : "Indisponível") + '</button></div>';

    $("#bs-add")?.addEventListener("click", () => {
      if (!book.available) return;
      if (cart().includes(book.id)) return notify("Este livro já está no seu carrinho.", true);
      setCart([...cart(), book.id]);
      location.href = "carrinho.html";
    });
  }

  async function basket() {
    if (!requireUser()) return;
    const area = $(".carrinho-area");
    if (!area) return;
    showLoading(area);
    let books = await api("/livros");
    async function render() {
      const items = cart().map((id) => books.find((book) => book.id === id)).filter(Boolean);
      area.innerHTML =
        '<div class="bs-cart-items">' +
        (items.length ? items.map((book) =>
          '<article class="item-carrinho"><img src="' + escapeHTML(book.image) + '" alt="Capa de ' + escapeHTML(book.title) + '">' +
          '<div class="item-info"><h2>' + escapeHTML(book.title) + '</h2><p>' + escapeHTML(book.author) + '</p>' +
          '<p>Período: 14 dias</p>' +
          (!book.available ? '<p class="indisponivel">Indisponível</p>' : '') +
          '<button type="button" class="bs-action bs-remove" data-id="' + book.id + '">Remover</button>' +
          '</div></article>'
        ).join("") : '<p class="bs-empty">Seu carrinho está vazio.</p>') +
        '</div><aside class="resumo"><h2>Resumo</h2><p>Quantidade de livros: <strong>' + items.length + '</strong></p>' +
        '<p>Prazo: <strong>14 dias por livro</strong></p><p>Valor: <strong>Gratuito</strong></p>' +
        '<button type="button" class="finalizar bs-action" id="bs-checkout" ' +
        (!items.length || items.some((book) => !book.available) ? "disabled" : "") + '>Finalizar aluguel</button>' +
        '<a href="livros.html" class="continuar">Continuar escolhendo</a></aside>';
      $$(".bs-remove", area).forEach((button) => button.addEventListener("click", () => {
        setCart(cart().filter((id) => id !== Number(button.dataset.id)));
        render();
        notify("Livro removido.");
      }));
      $("#bs-checkout")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api("/alugueis", {
            method: "POST", auth: true, data: { bookIds: items.map((book) => book.id) }
          });
          setCart([]);
          location.href = "alugueis.html";
        } catch (error) {
          notify(error.message, true);
          try {
            books = await api("/livros");
            await render();
          } catch (refreshError) {
            notify(refreshError.message, true);
          }
        } finally {
          button.disabled = false;
        }
      });
    }
    render();
  }

  async function myRentals() {
    if (!requireUser()) return;
    const area = $(".alugueis");
    if (!area) return;
    async function render() {
      showLoading(area);
      const data = await api("/alugueis", { auth: true });
      area.innerHTML = data.length ? data.map((rental) => {
        const book = rental.book;
        if (!book) return "";
        return '<article class="aluguel-card">' +
          '<img src="' + escapeHTML(book.image) + '" alt="Capa de ' + escapeHTML(book.title) + '">' +
          '<div class="aluguel-info"><h2>' + escapeHTML(book.title) + '</h2>' +
          '<p class="autor">' + escapeHTML(book.author) + '</p>' +
          '<div class="dados"><p><strong>Retirada:</strong> ' + displayDate(rental.start) + '</p>' +
          '<p><strong>Devolução prevista:</strong> ' + displayDate(rental.end) + '</p></div></div>' +
          '<div class="status"><span>' + escapeHTML(rental.status) + '</span><p>14 dias</p>' +
          (rental.status === "Em andamento" ?
            '<button type="button" class="bs-action bs-return" data-id="' + escapeHTML(rental.id) + '">Registrar devolução</button>' :
            '<button type="button" class="bs-action danger bs-delete" data-id="' + escapeHTML(rental.id) + '">Excluir registro</button>') +
          '</div></article>';
      }).join("") : '<p class="bs-empty">Nenhum aluguel registrado. <a href="livros.html">Escolher livros</a></p>';
    }
    area.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-id]");
      if (!button) return;
      const id = encodeURIComponent(button.dataset.id);
      if (button.classList.contains("bs-delete") && !confirm("Excluir este registro?")) return;
      button.disabled = true;
      try {
        if (button.classList.contains("bs-return")) {
          await api("/alugueis/" + id, { method: "PUT", data: { status: "Devolvido" }, auth: true });
          notify("Devolução registrada.");
        } else {
          await api("/alugueis/" + id, { method: "DELETE", auth: true });
          notify("Registro excluído.");
        }
        await render();
      } catch (error) {
        notify(error.message, true);
        button.disabled = false;
      }
    });
    await render();
  }

  async function profile() {
    if (!requireUser()) return;
    const form = $(".form-perfil");
    if (!form) return;
    const user = await api("/usuarios/me", { auth: true });
    $("#nome").value = user.name;
    $("#email").value = user.email;
    $("#telefone").value = user.phone;
    if ($(".avatar")) $(".avatar").textContent = user.name.charAt(0).toUpperCase();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = $("#nome").value.trim();
      const email = $("#email").value.trim().toLowerCase();
      const phone = $("#telefone").value.replace(/\D/g, "");
      const password = $("#senha").value;
      if (name.length < 3 || !validEmail(email) || phone.length < 10 || phone.length > 11)
        return notify("Revise nome, e-mail e telefone.", true);
      if (password && password.length < 6) return notify("Nova senha precisa ter pelo menos 6 caracteres.", true);
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const data = { name, email, phone };
        if (password) data.password = password;
        const updated = await api("/usuarios/me", { method: "PUT", data, auth: true });
        const session = readSession();
        saveSession({ token: session.token, user: updated });
        $("#senha").value = "";
        if ($(".avatar")) $(".avatar").textContent = updated.name.charAt(0).toUpperCase();
        notify("Dados atualizados com sucesso!");
      } catch (error) {
        notify(error.message, true);
      } finally {
        button.disabled = false;
      }
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
    "conta.html": profile
  };
  const name = location.pathname.split("/").pop() || "index.html";
  if (routes[name]) Promise.resolve().then(routes[name]).catch((error) => {
    console.error(error);
    notify(error.message || "Erro inesperado.", true);
  });
})();