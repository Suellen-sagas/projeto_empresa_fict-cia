// Evidências das páginas públicas do próprio GitHub para a entrega acadêmica.
// É um complemento: sempre conferir os PDFs antes de enviar no Classroom.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

await mkdir("artifacts", { recursive: true });
const base = "https://github.com/Suellen-sagas/projeto_empresa_fict-cia";
const browser = await chromium.launch({ headless: true });
try {
  const pages = [
    { route: "", target: "repositorio.pdf", label: "Repositório" },
    { route: "/commits/main/", target: "commits.pdf", label: "Commits da main" }
  ];
  for (const item of pages) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      const response = await page.goto(base + item.route, { waitUntil: "domcontentloaded", timeout: 20000 });
      if (!response?.ok()) throw new Error("HTTP " + response?.status());
      await page.locator("main").first().waitFor({ timeout: 15000 });
      if (!item.route) {
        // O GitHub carrega a lista de arquivos dinamicamente.
        await page.getByRole("link", { name: "backend", exact: true }).first()
          .waitFor({ timeout: 12000 }).catch(() => {});
      }
      await page.waitForTimeout(1500);
      await page.pdf({
        path: path.resolve("artifacts", item.target),
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" }
      });
      console.log(item.label + ": arquivo PDF gerado a partir do GitHub público.");
    } catch (error) {
      console.warn("Evidência não disponível: " + item.label + " — " + error.message);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
