"use client";

import { ChevronDown, ChevronRight, ChevronsUpDown, LogOut, PanelLeft, PackageCheck } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { findNav, NAV } from "./nav";

export interface ShellUser {
  name: string;
  email: string | null;
  image: string | null;
}

const STORAGE_KEY = "plugin-sync:sidebar";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "open");
  } catch {
    // Speicher nicht verfügbar, Zustand bleibt nur für diese Sitzung
  }
}

export function PanelShell({
  user,
  signOutAction,
  children,
}: {
  user: ShellUser;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());

  useEffect(() => setCollapsed(readCollapsed()), []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((value) => {
      writeCollapsed(!value);
      return !value;
    });
  };

  const toggleGroup = (label: string) =>
    setClosedGroups((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const active = findNav(pathname);

  return (
    <div className={`shell${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <PackageCheck size={18} />
          </span>
          <span className="brand-text">
            <strong>PluginSync</strong>
            <span>Deploy Panel</span>
          </span>
        </Link>

        <nav className="sidebar-nav">
          {NAV.map((group) => {
            const closed = closedGroups.has(group.label);
            return (
              <div key={group.label} className="nav-group">
                <button type="button" className="nav-group-label" onClick={() => toggleGroup(group.label)}>
                  {group.label}
                  <ChevronDown size={14} className={closed ? "rotate" : undefined} />
                </button>
                {!closed &&
                  group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = active?.item.href === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item${isActive ? " is-active" : ""}`}
                        title={item.label}
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        <UserMenu user={user} signOutAction={signOutAction} />
      </aside>

      <button type="button" className="sidebar-backdrop" aria-label="Menü schließen" onClick={() => setMobileOpen(false)} />

      <div className="inset">
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={toggleSidebar} aria-label="Seitenleiste umschalten">
            <PanelLeft size={16} />
          </button>
          <span className="topbar-divider" />
          <nav className="breadcrumb" aria-label="Brotkrumen">
            <span className="muted">{active?.group.label ?? "PluginSync"}</span>
            <ChevronRight size={14} className="muted" />
            <span>{active?.item.label ?? "Seite"}</span>
          </nav>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ user, signOutAction }: { user: ShellUser; signOutAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      {open && (
        <form action={signOutAction} className="user-popover">
          <button type="submit" className="popover-item">
            <LogOut size={15} />
            Abmelden
          </button>
        </form>
      )}
      <button type="button" className="user-trigger" onClick={() => setOpen((value) => !value)}>
        <Avatar user={user} />
        <span className="user-text">
          <strong>{user.name}</strong>
          {user.email && <span>{user.email}</span>}
        </span>
        <ChevronsUpDown size={15} className="muted" />
      </button>
    </div>
  );
}

function Avatar({ user }: { user: ShellUser }) {
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.image} alt="" className="avatar" referrerPolicy="no-referrer" />;
  }
  return <span className="avatar avatar-fallback">{user.name.slice(0, 1).toUpperCase()}</span>;
}
