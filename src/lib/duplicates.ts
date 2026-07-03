// ============================================================
// Detecção de clientes repetidos (sessão 124, item 8.5)
// ============================================================
// REGRA DA MARIA: avisar com link, NUNCA bloquear — a mesma pessoa
// pode fazer várias encomendas (casamento + baptizado, vários
// quadros…). Isto é só um aviso informativo no workbench.
//
// O matching corre em JS sobre a lista completa (a BD tem centenas de
// linhas, não milhões) porque a normalização de telefones não se faz
// bem em PostgREST: "+351 912 345 678" e "912345678" são a mesma
// pessoa.
// ============================================================

export type ContactLike = {
  email?: string | null;
  phone?: string | null;
};

export type DuplicateMatch<T> = {
  record: T;
  matchedBy: "email" | "telemóvel" | "email + telemóvel";
};

export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normaliza um telefone para comparação: só dígitos, sem indicativo
 * (+351 / 00351), e exige pelo menos 9 dígitos para evitar falsos
 * positivos com números incompletos. Devolve os últimos 9 dígitos.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00351")) digits = digits.slice(5);
  else if (digits.startsWith("351") && digits.length > 9) digits = digits.slice(3);
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

/**
 * Encontra registos com o mesmo email e/ou telefone que `current`.
 * `candidates` NÃO deve incluir o próprio registo (filtrar por id
 * antes de chamar). Sem email nem telefone válidos → sem matches.
 */
export function findDuplicates<T extends ContactLike>(
  current: ContactLike,
  candidates: readonly T[],
): DuplicateMatch<T>[] {
  const email = normalizeEmail(current.email);
  const phone = normalizePhone(current.phone);
  if (!email && !phone) return [];

  const out: DuplicateMatch<T>[] = [];
  for (const c of candidates) {
    const sameEmail = email !== null && normalizeEmail(c.email) === email;
    const samePhone = phone !== null && normalizePhone(c.phone) === phone;
    if (!sameEmail && !samePhone) continue;
    out.push({
      record: c,
      matchedBy:
        sameEmail && samePhone
          ? "email + telemóvel"
          : sameEmail
            ? "email"
            : "telemóvel",
    });
  }
  return out;
}
