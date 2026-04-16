import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionEmpty } from "./SectionEmpty";

export interface OrphanRow {
  id: string;
  tab: string;
  task: string;
  hours: number;
  justification: string | null;
}

export function OrphanTable({ orphans }: { orphans: OrphanRow[] }) {
  if (orphans.length === 0) {
    return (
      <SectionEmpty message="No orphans — every line item traces back to a TOR requirement or has a justification." />
    );
  }

  return (
    <div className="rounded-xl border ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Tab</TableHead>
            <TableHead>Task</TableHead>
            <TableHead className="w-[90px] text-right">Hours</TableHead>
            <TableHead>Justification</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orphans.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="text-xs">
                <Badge variant="outline">{o.tab}</Badge>
              </TableCell>
              <TableCell className="whitespace-normal">{o.task}</TableCell>
              <TableCell className="text-right font-mono text-xs">
                {o.hours}
              </TableCell>
              <TableCell className="whitespace-normal text-xs text-muted-foreground">
                {o.justification ?? (
                  <span className="italic text-destructive">
                    None (unjustified orphan)
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
