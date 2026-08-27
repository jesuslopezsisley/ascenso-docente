/**
 * Navegación de /dashboard. Es una lista estática: este proyecto no tiene
 * roles ni planes, así que —a diferencia del mapa `roles → menú` del
 * proyecto de referencia (docs/arquitectura-base.md §5.1)— todos los
 * docentes ven los mismos enlaces.
 *
 * `disabled: true` marca una sección cuyo backend todavía no existe: se
 * muestra en gris con la nota "Próximamente" y no navega a ningún lado.
 */

export interface NavItem {
  label: string;
  href: string;
  disabled?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/dashboard" },
  { label: "Diagnóstico", href: "/dashboard/diagnostico" },
  { label: "Mi reporte", href: "/dashboard/reporte" },
  { label: "Revisar respuestas", href: "/dashboard/revisar" },
  { label: "Plan de estudio", href: "/dashboard/plan-estudio" },
  { label: "Mi progreso", href: "/dashboard/progreso" },
  { label: "Historial", href: "/dashboard/historial", disabled: true },
];

/**
 * Un enlace está activo si la ruta actual es exactamente su href o una
 * subruta suya. "/dashboard" (Inicio) solo hace match exacto para no
 * quedar resaltado en todas las demás pantallas.
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
