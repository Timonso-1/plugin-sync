"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { addServer, type FormState } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Card } from "@/components/ui";

export default function AddServerForm() {
  const [state, action] = useActionState<FormState, FormData>(addServer, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card title="Manuell hinzufügen">
      <form ref={formRef} action={action} className="form">
        <label className="field">
          <span>Name</span>
          <input name="name" required placeholder="Testserver 1" />
        </label>
        <label className="field">
          <span>Pelican-ID</span>
          <input name="pelican_id" required placeholder="1a2b3c4d" className="mono" />
          <small>Kurze ID aus der Server-URL im Panel</small>
        </label>
        <label className="field">
          <span>Plugin-Ordner</span>
          <input name="plugin_dir" defaultValue="/plugins" className="mono" />
        </label>
        {state?.error && <Alert tone="danger">{state.error}</Alert>}
        {state?.ok && <Alert tone="success">{state.ok}</Alert>}
        <SubmitButton pendingLabel="Speichere...">
          <Plus size={15} /> Hinzufügen
        </SubmitButton>
      </form>
    </Card>
  );
}
