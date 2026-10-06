import type { LucideIcon } from "lucide-react";
import { History, LayoutDashboard, Puzzle, Server, Upload } from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { label: "Übersicht", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Verwaltung",
    items: [
      { href: "/deploy", label: "Deploy", icon: Upload },
      { href: "/plugins", label: "Plugins", icon: Puzzle },
      { href: "/servers", label: "Server", icon: Server },
    ],
  },
  { label: "Protokoll", items: [{ href: "/deployments", label: "Verlauf", icon: History }] },
];

export function findNav(pathname: string): { group: NavGroup; item: NavItem } | null {
  for (const group of NAV) {
    for (const item of group.items) {
      if (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) return { group, item };
    }
  }
  return null;
}
