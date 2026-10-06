import { Plus, Server, Trash2 } from "@/components/icons";
import { importServer, removeServer } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Card, Empty, PageHeader } from "@/components/ui";
import { listServers } from "@/lib/db";
import { listPelicanServers, type PelicanServer } from "@/lib/pelican";
import { errorMessage } from "@/lib/util";
import AddServerForm from "./add-server-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Server" };

export default async function ServersPage() {
  const servers = await listServers();

  let remote: PelicanServer[] = [];
  let remoteError: string | null = null;
  try {
    remote = await listPelicanServers();
  } catch (error) {
    remoteError = errorMessage(error);
  }
  const known = new Set(servers.map((server) => server.pelican_id));
  const available = remote.filter((server) => !known.has(server.identifier));

  return (
    <>
      <PageHeader title="Server" subtitle="Zielserver aus deinem Pelican-Panel" />

      <div className="grid-main">
        <Card title="Angelegte Server" subtitle={`${servers.length} Server`} flush>
          {servers.length === 0 ? (
            <Empty icon={<Server size={20} />} title="Noch keine Server">
              Übernimm sie rechts direkt aus Pelican.
            </Empty>
          ) : (
            <ul className="list">
              {servers.map((server) => (
                <li key={server.id} className="list-row">
                  <div className="list-main">
                    <div className="list-title">{server.name}</div>
                    <div className="list-sub">
                      <span className="mono">{server.pelican_id}</span> · {server.plugin_dir}
                    </div>
                  </div>
                  <form action={removeServer.bind(null, server.id)}>
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      title="Entfernen"
                      confirm={`${server.name} aus PluginSync entfernen? Auf dem Server selbst wird nichts gelöscht.`}
                    >
                      <Trash2 size={14} />
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="stack">
          <Card title="Aus Pelican übernehmen" subtitle="Server, auf die dein API-Key Zugriff hat" flush>
            {remoteError ? (
              <div className="card-pad">
                <Alert tone="danger">Pelican nicht erreichbar: {remoteError}</Alert>
              </div>
            ) : available.length === 0 ? (
              <Empty title="Alles übernommen">Alle Server deines API-Keys sind angelegt.</Empty>
            ) : (
              <ul className="list">
                {available.map((server) => (
                  <li key={server.identifier} className="list-row">
                    <div className="list-main">
                      <div className="list-title">{server.name}</div>
                      <div className="list-sub mono">{server.identifier}</div>
                    </div>
                    <form action={importServer.bind(null, server.name, server.identifier)}>
                      <SubmitButton variant="secondary" size="sm">
                        <Plus size={14} /> Übernehmen
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <AddServerForm />
        </div>
      </div>
    </>
  );
}
