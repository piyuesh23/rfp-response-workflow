"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserRole = "ADMIN" | "MANAGER" | "VIEWER";

interface UserRoleSelectProps {
  userId: string;
  currentRole: UserRole;
}

export function UserRoleSelect({ currentRole }: UserRoleSelectProps) {
  return (
    <Select defaultValue={currentRole}>
      <SelectTrigger className="w-32 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ADMIN">Admin</SelectItem>
        <SelectItem value="MANAGER">Manager</SelectItem>
        <SelectItem value="VIEWER">Viewer</SelectItem>
      </SelectContent>
    </Select>
  );
}
