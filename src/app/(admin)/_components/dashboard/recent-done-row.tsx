"use client";

import { CheckSquare, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDoneAgo } from "./format-helpers";

// Linha de uma tarefa/item concluído na secção "Concluídas recentes".
// Reutilizada pela ChecklistCard (mescla checklist + tarefas atribuídas)
// e pela TasksCard (afazeres globais).
export function RecentDoneRow({
  text,
  doneAt,
  badge,
  onReopen,
}: {
  text: string;
  doneAt: string | null;
  badge?: string;
  onReopen?: () => void;
}) {
  const when = doneAt ? formatDoneAgo(doneAt) : null;
  return (
    <div className="group flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-cream-50 transition-colors">
      <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" strokeWidth={2} />
      <span className="flex-1 text-sm text-cocoa-500 dark:text-[#6E6E73] line-through truncate">
        {text}
      </span>
      {badge && (
        <Badge
          variant="outline"
          className="h-4 px-1.5 py-0 text-[10px] font-normal bg-violet-50 text-violet-700 border-violet-200"
        >
          {badge}
        </Badge>
      )}
      {when && <span className="text-[10px] text-cocoa-500 shrink-0">{when}</span>}
      {onReopen && (
        <button
          type="button"
          onClick={onReopen}
          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] text-cocoa-700 hover:text-cocoa-900"
          title="Reabrir"
        >
          <RotateCcw className="h-3 w-3" />
          Reabrir
        </button>
      )}
    </div>
  );
}
