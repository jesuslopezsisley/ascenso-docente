import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DashboardShell } from "./dashboard-shell";

// El contenido depende de la sesión del usuario (cookie), no se puede
// cachear estáticamente (docs/arquitectura-base.md §5.1).
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell
      user={{ nombre: session.user.nombre, email: session.user.email }}
    >
      {children}
    </DashboardShell>
  );
}
