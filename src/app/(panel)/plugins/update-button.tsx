"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { checkUpdates, type UpdateState } from "@/app/actions";

export default function UpdateButton({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<UpdateState>(checkUpdates, null);

  let message: string | null = null;
  if (state?.error) message = state.error;
  else if (state?.summary?.skipped) message = "Ein Check läuft bereits.";
  else if (state?.summary) {
    const { checked, updated, failed } = state.summary;
    message = `${checked} geprüft · ${updated.length} aktualisiert${failed.length ? ` · ${failed.length} Fehler` : ""}`;
  }

  return (
    <form action={action} className="update-button">
      {message && <span className={state?.error || state?.summary?.failed.length ? "text-danger small" : "muted small"}>{message}</span>}
      <button type="submit" className="btn btn-secondary" disabled={pending || disabled}>
        {pending ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}
        {pending ? "Prüfe..." : "Jetzt auf Updates prüfen"}
      </button>
    </form>
  );
}
