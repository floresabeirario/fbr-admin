import { Loader2 } from "lucide-react";

export default function PartnerWorkbenchLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-cream-50">
      <div className="flex flex-col items-center gap-3 text-cocoa-700">
        <Loader2 className="h-6 w-6 animate-spin text-[#C4A882]" />
        <p className="text-sm font-medium">A carregar parceiro…</p>
      </div>
    </div>
  );
}
