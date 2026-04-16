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

export interface GapRow {
  id: string;
  clauseRef: string;
  title: string;
  domain: string;
  clarityRating: string;
}

function clarityVariant(
  clarity: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (clarity) {
    case "CLEAR":
      return "default";
    case "NEEDS_CLARIFICATION":
      return "secondary";
    case "AMBIGUOUS":
      return "destructive";
    case "MISSING_DETAIL":
      return "destructive";
    default:
      return "outline";
  }
}

export function GapTable({ gaps }: { gaps: GapRow[] }) {
  if (gaps.length === 0) {
    return (
      <SectionEmpty message="No gaps — every TOR requirement has a linked estimate line item." />
    );
  }

  return (
    <div className="rounded-xl border ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Clause Ref</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-[140px]">Domain</TableHead>
            <TableHead className="w-[180px]">Clarity</TableHead>
            <TableHead className="w-[180px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gaps.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-mono text-xs">{g.clauseRef}</TableCell>
              <TableCell className="whitespace-normal">{g.title}</TableCell>
              <TableCell className="text-xs">
                <Badge variant="outline">{g.domain}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={clarityVariant(g.clarityRating)}>
                  {g.clarityRating.replaceAll("_", " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground italic">
                Add to estimate
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
