-- 002: mensagens dos formulários públicos (Contato e Faça parte).
-- O painel admin lista e marca como respondidas; o e-mail de aviso entra quando o SMTP for configurado.

CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(20) NOT NULL,              -- contato | faca-parte
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  extra JSON NULL,                        -- campos próprios do formulário (área, redes, portfólio)
  ip_hash CHAR(64) NULL,                  -- só para limitar envios repetidos; não guarda o IP
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_contact_status (status, created_at),
  KEY idx_contact_ip (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
