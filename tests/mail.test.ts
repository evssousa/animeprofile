// E-mail de saída: sem SMTP configurado nada é enviado e nada quebra.
import { afterEach, describe, expect, it } from "vitest";
import { mailConfigured, sendSiteMail } from "~/server/mail.server";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("mail", () => {
  it("sem variáveis, não configura nem envia", async () => {
    delete process.env.SMTP_HOST;
    expect(mailConfigured()).toBe(false);
    expect(await sendSiteMail({ subject: "x", text: "y" })).toBe(false);
  });
  it("com servidor inválido, devolve false sem lançar erro", async () => {
    Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "a@b.c", SMTP_PASSWORD: "x" });
    expect(mailConfigured()).toBe(true);
    expect(await sendSiteMail({ subject: "x", text: "y" })).toBe(false);
  });
});
