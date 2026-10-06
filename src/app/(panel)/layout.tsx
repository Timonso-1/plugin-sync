import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { PanelShell } from "@/components/panel-shell";
import { requireUser } from "@/lib/session";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <PanelShell
      user={{ name: user.name ?? "Unbekannt", email: user.email ?? null, image: user.image ?? null }}
      signOutAction={signOutAction}
    >
      {children}
    </PanelShell>
  );
}
