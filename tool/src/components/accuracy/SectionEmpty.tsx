import { CheckCircle2 } from "lucide-react";

export function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-green-500/40 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
      <CheckCircle2 className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
