"use client";

// ============================================================
// Texto de pesquisa que sobrevive a abrir uma ficha e voltar atrás
// ============================================================
// As listas guardavam a pesquisa em useState: ao abrir uma encomenda e
// voltar, a página montava de novo com a caixa vazia e a lista inteira.
// Aqui a pesquisa vive no sessionStorage (dura até fechar o separador),
// lida com useSyncExternalStore: o servidor vê "" (sem hydration
// mismatch) e o cliente lê o valor guardado. O snapshot é uma string,
// por isso é estável entre leituras (ver armadilha React #185).
// ============================================================

import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "fbr-search:";
const listeners = new Set<() => void>();
// Cópia em memória: é a fonte de verdade enquanto a página está aberta,
// para a caixa continuar a funcionar mesmo sem sessionStorage (janela
// privada, storage bloqueado).
const memory = new Map<string, string>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function read(key: string): string {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  let stored = "";
  try {
    stored = sessionStorage.getItem(PREFIX + key) ?? "";
  } catch {
    // sem storage → começa vazio
  }
  memory.set(key, stored);
  return stored;
}

export function useSessionSearch(key: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => "",
  );
  const setValue = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        if (next) sessionStorage.setItem(PREFIX + key, next);
        else sessionStorage.removeItem(PREFIX + key);
      } catch {
        // sessionStorage indisponível: a pesquisa funciona, só não fica guardada.
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, setValue];
}
