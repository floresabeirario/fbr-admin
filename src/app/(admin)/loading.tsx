import { Loader2 } from "lucide-react";

// Fallback de carregamento para TODAS as páginas do grupo (admin) que não
// tenham um loading.tsx próprio (os workbenches têm). Sem isto, ao navegar
// ou ao abrir a app o ecrã ficava parado, sem feedback nenhum, até o
// servidor acabar de ir buscar os dados — parecia que a app estava "presa".
// Com este ficheiro, a sidebar aparece logo e o conteúdo mostra um spinner
// enquanto os dados chegam.
export default function AdminLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-cream-50">
      <div className="flex flex-col items-center gap-3 text-cocoa-700">
        <Loader2 className="h-6 w-6 animate-spin text-[#C4A882]" />
        <p className="text-sm font-medium">A carregar…</p>
      </div>
    </div>
  );
}
