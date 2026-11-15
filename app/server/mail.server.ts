// E-mail de saída por SMTP (caixa contato@ da Hostinger). Sem as variáveis, não envia nada e o site segue normal.
// Variáveis (o dono cadastra no hPanel): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, MAIL_TO (opcional).
import nodemailer from "nodemailer";
import { SITE } from "~/lib/site";

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

type Mail = { replyTo?: string; subject: string; text: string };

/** Envia uma cópia para a caixa do site. Nunca lança: falha vira linha no log e o formulário continua valendo. */
export async function sendSiteMail({ replyTo, subject, text }: Mail): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const port = Number(process.env.SMTP_PORT) || 465;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM || `${SITE.name} <${process.env.SMTP_USER}>`,
      to: process.env.MAIL_TO || SITE.email,
      replyTo,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error("[mail] não enviou:", (err as Error).message);
    return false;
  }
}
