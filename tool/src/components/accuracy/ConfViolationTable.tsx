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

export interface ConfViolationRow {
  id: string;
  tab: string;
  task: string;
  hours: number;
  conf: number;
  expectedHigh: number;
  actualHigh: number;
  delta: number;
}

export function ConfViolationTable({
  violations,
}: {
  violations: ConfViolationRow[];
}) {
  if (violations.length === 0) {
    return (
      <SectionEmpty message="No Conf buffer violations — every line item's highHrs matches the expected formula." />
    );
  }

  return (
    <div className="rounded-xl border ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead className="w-[90px] text-right">Hours</TableHead>
            <TableHead className="w-[70px] text-right">Conf</TableHead>
            <TableHead className="w-[120px] text-right">Expected High</TableHead>
            <TableHead className="w-[120px] text-right">Actual High</TableHead>
            <TableHead className="w-[90px] text-right">Delta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {violations.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <span>{v.task}</span>
                  <Badge variant="outline" className="w-fit text-[10px]">
                    {v.tab}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {v.hours}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {v.conf}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {v.expectedHigh}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {v.actualHigh}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-destructive">
                {v.delta > 0 ? "+" : ""}
                {v.delta}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
