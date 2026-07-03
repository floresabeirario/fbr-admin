// Gera um par de chaves VAPID para as notificações push (Web Push).
//
// Correr UMA vez: `node scripts/generate-vapid.mjs`
// Copiar as 3 linhas para as env vars do projecto (Vercel + .env.local):
//
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...            (SEGREDO — nunca no cliente nem no git)
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY=... (igual à pública; exposta ao browser)
//
// A chave pública vai também para o browser (subscrição do push); a
// privada assina os pedidos ao serviço de push e é secreta. Gerar novas
// chaves invalida TODAS as subscrições existentes (os utilizadores têm de
// voltar a activar as notificações), por isso guarda-as bem.

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("\n# Chaves VAPID para as notificações push — cola nas env vars:\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(
  "\n# E define também o assunto (email de contacto exigido pelo protocolo):",
);
console.log("VAPID_SUBJECT=mailto:info@floresabeirario.pt\n");
