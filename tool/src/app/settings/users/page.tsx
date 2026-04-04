import { auth } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserRoleSelect } from "./UserRoleSelect";
import { InviteUserButton } from "./InviteUserButton";

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "VIEWER";
  lastLoginAt: string | null;
};

const MOCK_USERS: MockUser[] = [
  {
    id: "1",
    name: "Piyuesh Modi",
    email: "piyuesh@qed42.com",
    role: "ADMIN",
    lastLoginAt: "2026-04-04T09:15:00Z",
  },
  {
    id: "2",
    name: "Anoop John",
    email: "anoop@qed42.com",
    role: "MANAGER",
    lastLoginAt: "2026-04-03T14:30:00Z",
  },
  {
    id: "3",
    name: "Divya Sharma",
    email: "divya@qed42.com",
    role: "MANAGER",
    lastLoginAt: "2026-04-02T11:00:00Z",
  },
  {
    id: "4",
    name: "Rohan Verma",
    email: "rohan@qed42.com",
    role: "VIEWER",
    lastLoginAt: "2026-03-28T16:45:00Z",
  },
  {
    id: "5",
    name: "Sneha Patil",
    email: "sneha@qed42.com",
    role: "VIEWER",
    lastLoginAt: null,
  },
];

const ROLE_BADGE_VARIANT: Record<
  MockUser["role"],
  "default" | "secondary" | "outline"
> = {
  ADMIN: "default",
  MANAGER: "secondary",
  VIEWER: "outline",
};

function formatLastLogin(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function UsersPage() {
  const session = await auth();

  if (!session?.user?.role || !canManageUsers(session.user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-xl text-destructive">
              Access Denied
            </CardTitle>
            <CardDescription>
              You do not have permission to manage users. This page is
              restricted to Admins only.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage team access and roles for the Presales Tool.
          </p>
        </div>
        <InviteUserButton />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Team Members</CardTitle>
          <CardDescription>
            {MOCK_USERS.length} users with access
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_USERS.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_BADGE_VARIANT[user.role]}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatLastLogin(user.lastLoginAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <UserRoleSelect userId={user.id} currentRole={user.role} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
