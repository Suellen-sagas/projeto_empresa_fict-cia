// Teste de ponta a ponta no Chromium: front-end + API REST, sem mocks.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { chromium } from "playwright";
import { createApp } from "../src/app.js";

const root = path.resolve("..");
const temp = await mkdtemp(path.join(os.tmpdir(), "bookspace-browser-"));
const apiServer = createApp({ dbFile: path.join(temp, "db.json") }).listen(0, "127.0.0.1");
await new Promise((resolve) => apiServer.once("listening", resolve));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};
const site = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
  if (pathname === "/favicon.ico") {
    res.writeHead(204).end();
    return;
  }
  const filename = path.resolve(root, "." + pathname);
  if (!filename.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filename);
    res.writeHead(200, { "Content-Type": contentTypes[path.extname(filename)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => site.listen(5500, "127.0.0.1", resolve));

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((port) => {
    window.BOOKSPACE_API_URL = "http://127.0.0.1:" + port + "/api";
  }, apiServer.address().port);
  const start = "http://127.0.0.1:5500/Projeto-empresa-fict%C3%ADcia/";

  await page.goto(start + "index.html");
  await page.getByRole("link", { name: "Criar conta" }).click();
  await page.locator("#nome").fill("Cliente de Teste");
  await page.locator("#email").fill("cliente@example.com");
  await page.locator("#telefone").fill("48999999999");
  await page.locator("#senha").fill("senha123");
  await page.locator("#confirmar-senha").fill("senha123");
  await page.locator('form input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/livros.html");

  await page.locator(".livro-card").first().waitFor();
  assert.equal(await page.locator(".livro-card").count(), 4);
  await page.locator(".livro-card").first().getByRole("link", { name: "Ver detalhes" }).click();
  await page.locator("#bs-add").click();
  await page.waitForURL("**/carrinho.html");
  await page.locator("#bs-checkout").click();
  await page.waitForURL("**/alugueis.html");
  await page.getByRole("button", { name: "Registrar devolução" }).waitFor();
  await page.getByRole("button", { name: "Registrar devolução" }).click();
  await page.getByRole("button", { name: "Excluir registro" }).waitFor();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Excluir registro" }).click();
  await page.getByText("Nenhum aluguel registrado").waitFor();

  await page.getByRole("link", { name: "Minha conta" }).click();
  await page.locator("#nome").fill("Cliente Atualizado");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByText("Dados atualizados com sucesso!").waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".bs-menu").click();
  await page.getByRole("link", { name: "Livros" }).click();
  await page.locator(".livro-card").first().waitFor();
  await mkdir(path.join(temp, "artifacts"), { recursive: true });
  const screenshot = path.resolve("artifacts/sistema-bookspace-mobile.png");
  await mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });

  assert.deepEqual(errors, [], "Erros JavaScript no navegador: " + errors.join("; "));
  console.log("Navegador: cadastro, catálogo, aluguel, PUT, DELETE, perfil e versão mobile OK");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => site.close(resolve));
  await new Promise((resolve) => apiServer.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
