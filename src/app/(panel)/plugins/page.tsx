import { Puzzle, Trash2 } from "lucide-react";
import { removePlugin, savePluginServers, toggleAutoUpdate } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { listPlugins, listServers, pluginServerIds } from "@/lib/db";
import { formatRelative } from "@/lib/util";
import AddPluginForm from "./add-plugin-form";
import UpdateButton from "./update-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plugins" };

export default function PluginsPage() {
  const plugins = listPlugins();
  const servers = listServers();

  return (
    <>
      <PageHeader
        title="Plugins"
        subtitle="Quellen für den automatischen Update-Check"
        aside={<UpdateButton disabled={plugins.length === 0} />}
      />

      <div className="grid-main">
        <Card title="Überwachte Plugins" subtitle={`${plugins.length} eingetragen`} flush>
          {plugins.length === 0 ? (
            <Empty icon={<Puzzle size={20} />} title="Noch keine Plugins">
              Lege rechts dein erstes Plugin an.
            </Empty>
          ) : (
            <ul className="list">
              {plugins.map((plugin) => {
                const assigned = new Set(pluginServerIds(plugin.id));
                return (
                  <li key={plugin.id} className="plugin-row">
                    <div className="plugin-head">
                      <div className="list-main">
                        <div className="list-title">
                          {plugin.name ?? plugin.ref}
                          <Badge tone={plugin.source === "github" ? "neutral" : "success"}>
                            {plugin.source === "github" ? "GitHub" : "Modrinth"}
                          </Badge>
                          {!plugin.stable_only && <Badge tone="warning">inkl. Beta</Badge>}
                        </div>
                        <div className="list-sub">
                          <span className="mono">{plugin.ref}</span>
                          {plugin.loaders && ` · ${plugin.loaders}`}
                          {plugin.game_version && ` · MC ${plugin.game_version}`}
                        </div>
                      </div>
                      <div className="plugin-version">
                        <span className="mono">{plugin.current_version ?? "noch nicht deployt"}</span>
                        <span className="muted small">geprüft {formatRelative(plugin.last_checked)}</span>
                      </div>
                    </div>

                    {plugin.last_error && <p className="text-danger small plugin-error">{plugin.last_error}</p>}

                    <div className="plugin-actions">
                      <form action={savePluginServers.bind(null, plugin.id)} className="chip-form">
                        {servers.map((server) => (
                          <label key={server.id} className="chip">
                            <input
                              type="checkbox"
                              name="servers"
                              value={server.id}
                              defaultChecked={assigned.has(server.id)}
                            />
                            <span>{server.name}</span>
                          </label>
                        ))}
                        {servers.length > 0 && (
                          <SubmitButton variant="ghost" size="sm" pendingLabel="Speichere">
                            Speichern
                          </SubmitButton>
                        )}
                      </form>

                      <div className="row-actions">
                        <form action={toggleAutoUpdate.bind(null, plugin.id, !plugin.auto_update)}>
                          <SubmitButton variant="secondary" size="sm">
                            <span className={`dot${plugin.auto_update ? " dot-on" : ""}`} />
                            Auto-Update {plugin.auto_update ? "an" : "aus"}
                          </SubmitButton>
                        </form>
                        <form action={removePlugin.bind(null, plugin.id)}>
                          <SubmitButton
                            variant="ghost"
                            size="sm"
                            title="Löschen"
                            confirm={`${plugin.name ?? plugin.ref} aus PluginSync entfernen? Auf den Servern bleibt das Plugin installiert.`}
                          >
                            <Trash2 size={14} />
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="stack">
          <AddPluginForm servers={servers.map(({ id, name }) => ({ id, name }))} />
        </div>
      </div>
    </>
  );
}
