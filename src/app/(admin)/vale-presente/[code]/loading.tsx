import { Loader2 } from "lucide-react";

export default function VoucherWorkbenchLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-[#F7F4F0]">
      <div className="flex flex-col items-center gap-3 text-cocoa-700">
        <Loader2 className="h-6 w-6 animate-spin text-[#C4A882]" />
        <p className="text-sm font-medium">A carregar vale…</p>
      </div>
    </div>
  );
}
