"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { addPlugin, type FormState } from "@/app/actions";
import { GithubIcon } from "@/components/brand-icons";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Card } from "@/components/ui";

type Source = "github" | "modrinth";

export default function AddPluginForm({ servers }: { servers: { id: number; name: string }[] }) {
  const [state, action] = useActionState<FormState, FormData>(addPlugin, null);
  const [source, setSource] = useState<Source>("modrinth");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card title="Plugin hinzufügen" subtitle="Wird beim nächsten Check automatisch deployt">
      <form ref={formRef} action={action} className="form">
        <input type="hidden" name="source" value={source} />
        <div className="segmented" role="tablist">
          <button
            type="button"
            className={source === "modrinth" ? "is-on" : undefined}
            onClick={() => setSource("modrinth")}
          >
            Modrinth
          </button>
          <button type="button" className={source === "github" ? "is-on" : undefined} onClick={() => setSource("github")}>
            <GithubIcon size={14} /> GitHub Release
          </button>
        </div>

        {source === "modrinth" ? (
          <>
            <label className="field">
              <span>Projekt-Slug</span>
              <input name="ref" required placeholder="worldedit" autoComplete="off" />
              <small>Aus der URL: modrinth.com/plugin/<b>worldedit</b></small>
            </label>
            <label className="field">
              <span>Loader</span>
              <input name="loaders" defaultValue="paper" />
              <small>Kommagetrennt, z. B. paper oder velocity</small>
            </label>
            <label className="field">
              <span>Spielversion</span>
              <input name="game_version" placeholder="1.21.10" />
              <small>Optional, leer bedeutet neueste Version</small>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Repository</span>
              <input name="ref" required placeholder="Timonso-1/mein-plugin" autoComplete="off" />
              <small>Private Repos benötigen GITHUB_TOKEN</small>
            </label>
            <label className="field">
              <span>Asset-Filter (Regex)</span>
              <input name="asset_pattern" placeholder="-all\.jar$" />
              <small>Optional, Standard ist die erste .jar ohne -sources/-javadoc</small>
            </label>
          </>
        )}

        {servers.length > 0 && (
          <div className="field">
            <span>Server</span>
            <div className="chip-form">
              {servers.map((server) => (
                <label key={server.id} className="chip">
                  <input type="checkbox" name="servers" value={server.id} defaultChecked />
                  <span>{server.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="switch-row">
          <input type="checkbox" name="stable_only" defaultChecked className="switch" />
          <span>Nur stabile Releases (keine Beta/Alpha)</span>
        </label>
        <label className="switch-row">
          <input type="checkbox" name="auto_update" defaultChecked className="switch" />
          <span>Auto-Update aktiv</span>
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
