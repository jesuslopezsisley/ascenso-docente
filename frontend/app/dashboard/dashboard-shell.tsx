"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "./actions";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";

/**
 * Chrome de /dashboard: barra lateral fija a la izquierda en escritorio,
 * menú hamburguesa en pantallas angostas. Es Client Component porque
 * necesita `usePathname()` para resaltar la sección activa y estado local
 * para abrir/cerrar el drawer móvil. La sesión la resuelve el layout
 * (Server Component) y baja acá solo lo que se pinta: nombre y correo.
 */
export function DashboardShell({
  user,
  children,
}: {
  user: { nombre: string; email: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-5">
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">
          Ascenso Docente
        </p>
        <p className="mt-0.5 font-serif text-lg text-foreground">Panel</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground/60"
              >
                {item.label}
                <span className="text-[10px] font-medium tracking-wide uppercase">
                  Próximamente
                </span>
              </span>
            );
          }

          const active = isNavItemActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border-l-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-accent bg-primary/10 font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="truncate text-sm font-medium text-foreground">
          {user.nombre}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {user.email}
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <Link
            href="/dashboard/cuenta"
            onClick={closeMenu}
            aria-current={
              isNavItemActive("/dashboard/cuenta", pathname) ? "page" : undefined
            }
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Mi cuenta
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      {/* Barra lateral fija — escritorio */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-surface lg:block">
        {sidebar}
      </aside>

      {/* Cabecera con hamburguesa — móvil / tablet */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <span className="text-xs font-semibold tracking-wide text-accent uppercase">
          Ascenso Docente
        </span>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          className="rounded-md border border-border p-2 text-foreground transition-colors hover:bg-muted"
        >
          <span className="block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
        </button>
      </header>

      {/* Drawer — móvil / tablet */}
      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-foreground/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col bg-surface shadow-xl">
            {sidebar}
          </div>
        </div>
      ) : null}

      {/* Contenido — pantallas existentes, sin cambios */}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
