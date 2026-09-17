// ============================================================
// Texto seguro para hidratação (React #418)
// ============================================================
// O parser de HTML do browser NÃO guarda o texto do servidor tal e
// qual: todo o U+000D (CR), sozinho ou em "\r\n", é convertido para
// "\n", e os caracteres de controlo C0 são descartados. É o próprio
// standard do HTML ("preprocessing the input stream"), não um capricho
// de um browser.
//
// O React, ao hidratar, volta a calcular o texto a partir dos DADOS
// (que ainda têm o CR) e compara-o com o que está no DOM. Diferente →
// "Hydration failed because the server rendered text didn't match the
// client" (#418): a árvore é deitada fora e redesenhada no cliente, e o
// erro entra no healthcheck.
//
// Onde é que isto aparece: em texto escrito por PESSOAS — uma mensagem
// de WhatsApp colada de outro lado, um campo do formulário do site. No
// ecrã não se vê nada (o CR é invisível), por isso o erro parece não ter
// causa nenhuma. A correcção é normalizar do lado do SERVIDOR, antes de
// o texto entrar na árvore: assim o HTML e o payload que o browser
// recebe dizem exactamente a mesma coisa.
// ============================================================

// CR (sozinho ou em "\r\n") e controlos C0 — excepto \t e \n, que o
// parser preserva e que são legítimos em texto de várias linhas.
const SUSPEITOS = /[\r\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const CONTROLOS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Normaliza uma string para hidratar sem mismatch. Devolve-a intacta quando já é segura. */
export function hydrationSafeText<T extends string | null | undefined>(value: T): T {
  if (typeof value !== "string" || !SUSPEITOS.test(value)) return value;
  return value.replace(/\r\n?/g, "\n").replace(CONTROLOS, "") as T;
}

/**
 * O mesmo, para linhas da base de dados (objectos e arrays com strings
 * lá dentro, JSONB incluído). Só clona o que muda — uma lista de 2000
 * encomendas sem CR nenhum sai pela mesma referência, sem cópia.
 */
export function hydrationSafeDeep<T>(value: T): T {
  if (typeof value === "string") return hydrationSafeText(value) as T;

  if (Array.isArray(value)) {
    let mudou = false;
    const saida = value.map((v) => {
      const novo = hydrationSafeDeep(v);
      if (novo !== v) mudou = true;
      return novo;
    });
    return (mudou ? saida : value) as T;
  }

  if (value && typeof value === "object") {
    // Só objectos simples (linhas da BD / JSONB). Datas e instâncias
    // de classes passam ao lado — não é texto para o ecrã.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    let mudou = false;
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const novo = hydrationSafeDeep(v);
      if (novo !== v) mudou = true;
      saida[k] = novo;
    }
    return (mudou ? saida : value) as T;
  }

  return value;
}
