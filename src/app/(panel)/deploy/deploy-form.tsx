"use client";

import { Check, FileArchive, LoaderCircle, Power, RotateCw, Upload, X } from "@/components/icons";
import { useActionState, useRef, useState, type DragEvent } from "react";
import { deployUpload, type DeployState } from "@/app/actions";
import { Alert, Badge, Card, StatusBadge } from "@/components/ui";
import { formatBytes } from "@/lib/util";

export default function DeployForm({ servers }: { servers: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<DeployState, FormData>(deployUpload, null);
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set(servers.map((server) => server.id)));
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const jars = [...incoming].filter((file) => file.name.toLowerCase().endsWith(".jar"));
    setFiles((current) => {
      const byName = new Map(current.map((file) => [file.name, file]));
      for (const file of jars) byName.set(file.name, file);
      return [...byName.values()];
    });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const toggleServer = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = (form: FormData) => {
    form.delete("jars");
    for (const file of files) form.append("jars", file);
    for (const id of selected) form.append("servers", String(id));
    action(form);
  };

  const canSubmit = files.length > 0 && selected.size > 0 && !pending;

  return (
    <form action={submit} className="grid-main">
      <div className="stack">
        <Card title="Plugin-JARs" subtitle="Mehrere Dateien gleichzeitig möglich">
          <div
            className={`dropzone${dragging ? " is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
          >
            <Upload size={22} />
            <strong>JARs hierher ziehen</strong>
            <span className="muted">oder klicken, um Dateien auszuwählen</span>
            <input
              ref={inputRef}
              type="file"
              accept=".jar"
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="file-list">
              {files.map((file) => (
                <li key={file.name}>
                  <FileArchive size={16} className="muted" />
                  <span className="file-name">{file.name}</span>
                  <span className="muted">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${file.name} entfernen`}
                    onClick={() => setFiles((current) => current.filter((entry) => entry !== file))}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {state?.error && <Alert tone="danger">{state.error}</Alert>}

        {state?.results && (
          <Card title="Ergebnis" subtitle="Pro Server und Plugin" flush>
            <ul className="list">
              {state.results.map((result) => (
                <li key={result.serverId} className="result-block">
                  <div className="result-head">
                    <strong>{result.server}</strong>
                    {result.restarted ? (
                      <Badge tone="info">
                        <RotateCw size={11} /> Neustart ausgelöst
                      </Badge>
                    ) : (
                      <Badge>Kein Neustart</Badge>
                    )}
                  </div>
                  {result.error && <p className="text-danger small">{result.error}</p>}
                  {result.outcomes.map((outcome) => (
                    <div key={outcome.plugin} className="result-row">
                      <span>{outcome.plugin}</span>
                      <span className="result-msg muted">{outcome.message}</span>
                      <StatusBadge status={outcome.status} />
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="stack">
        <Card
          title="Zielserver"
          action={
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setSelected(selected.size === servers.length ? new Set() : new Set(servers.map((server) => server.id)))
              }
            >
              {selected.size === servers.length ? "Keine" : "Alle"}
            </button>
          }
        >
          <div className="option-list">
            {servers.map((server) => {
              const isOn = selected.has(server.id);
              return (
                <button
                  key={server.id}
                  type="button"
                  className={`option${isOn ? " is-on" : ""}`}
                  onClick={() => toggleServer(server.id)}
                  aria-pressed={isOn}
                >
                  <span className="checkbox">{isOn && <Check size={12} />}</span>
                  {server.name}
                </button>
              );
            })}
          </div>

          <label className="switch-row">
            <input type="checkbox" name="restart" defaultChecked className="switch" />
            <span>
              <Power size={14} /> Server danach neu starten
            </span>
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
            {pending ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}
            {pending
              ? "Deploye..."
              : `${files.length} Plugin${files.length === 1 ? "" : "s"} auf ${selected.size} Server deployen`}
          </button>
        </Card>
      </div>
    </form>
  );
}
