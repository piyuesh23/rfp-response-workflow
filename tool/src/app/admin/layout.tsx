import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Only ADMIN role can access admin pages
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    redirect("/");
  }

  return <>{children}</>;
}
