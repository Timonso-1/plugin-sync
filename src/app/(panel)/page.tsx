import { History, Puzzle, Server, TriangleAlert } from "@/components/icons";
import Link from "next/link";
import { auth } from "@/auth";
import { Badge, Card, Empty, Stat, StatusBadge } from "@/components/ui";
import { dashboardStats, listDeployments, listPlugins, listServers, pluginsWithErrors } from "@/lib/db";
import { formatDateTime, formatRelative, formatToday } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const firstName = (session?.user?.name ?? "").split(" ")[0];

  const [stats, recent, failing, servers, plugins] = await Promise.all([
    dashboardStats(),
    listDeployments(8),
    pluginsWithErrors(),
    listServers(),
    listPlugins(),
  ]);

  return (
    <>
      <div className="page-header welcome">
        <div>
          <h1>
            <span className="muted">Willkommen zurück,</span> {firstName || "da"}
          </h1>
          <p className="muted">Was gerade auf deinen Servern läuft.</p>
        </div>
        <span className="date-label">{formatToday()}</span>
      </div>

      <div className="stats">
        <Stat label="Server" value={stats.servers} />
        <Stat label="Plugins" value={stats.plugins} hint={`${stats.autoUpdate} mit Auto-Update`} />
        <Stat label="Deploys heute" value={stats.deploysToday} />
        <Stat
          label="Fehler (24 Std.)"
          value={stats.errors24h}
          tone={stats.errors24h > 0 ? "danger" : undefined}
        />
        <Stat label="Probleme" value={failing.length} tone={failing.length > 0 ? "warning" : undefined} />
        <Stat label="Letzter Check" value={formatRelative(stats.lastCheck)} />
      </div>

      <div className="grid-main">
        <div className="stack">
          <Card
            title="Letzte Deployments"
            subtitle="Die neuesten Aktionen über alle Server"
            action={
              <Link href="/deployments" className="btn btn-ghost btn-sm">
                Alle ansehen
              </Link>
            }
            flush
          >
            {recent.length === 0 ? (
              <Empty icon={<History size={20} />} title="Noch keine Deployments">
                <Link href="/deploy">Jetzt Plugins deployen</Link>
              </Empty>
            ) : (
              <ul className="list">
                {recent.map((entry) => (
                  <li key={entry.id} className="list-row">
                    <div className="list-main">
                      <div className="list-title">
                        {entry.plugin_name}
                        <StatusBadge status={entry.status} />
                        {entry.trigger === "auto" && <Badge tone="info">Auto</Badge>}
                      </div>
                      <div className="list-sub">
                        {entry.version ?? "unbekannte Version"} · {entry.server_name}
                        {entry.status === "error" && entry.message ? ` · ${entry.message}` : ""}
                      </div>
                    </div>
                    <span className="list-meta">{formatDateTime(entry.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Probleme" subtitle="Plugins mit Fehler beim letzten Check" flush>
            {failing.length === 0 ? (
              <Empty title="Alles in Ordnung" />
            ) : (
              <ul className="list">
                {failing.map((plugin) => (
                  <li key={plugin.id} className="list-row">
                    <div className="list-main">
                      <div className="list-title">
                        <TriangleAlert size={14} className="text-warning" />
                        {plugin.name ?? plugin.ref}
                      </div>
                      <div className="list-sub text-danger">{plugin.last_error}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Server"
            action={
              <Link href="/servers" className="btn btn-ghost btn-sm">
                Verwalten
              </Link>
            }
            flush
          >
            {servers.length === 0 ? (
              <Empty icon={<Server size={20} />} title="Keine Server">
                <Link href="/servers">Server hinzufügen</Link>
              </Empty>
            ) : (
              <ul className="list">
                {servers.map((server) => (
                  <li key={server.id} className="list-row">
                    <div className="list-main">
                      <div className="list-title">{server.name}</div>
                    </div>
                    <span className="list-meta mono">{server.pelican_id}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Plugins"
            action={
              <Link href="/plugins" className="btn btn-ghost btn-sm">
                Verwalten
              </Link>
            }
            flush
          >
            {plugins.length === 0 ? (
              <Empty icon={<Puzzle size={20} />} title="Keine Plugins">
                <Link href="/plugins">Plugin hinzufügen</Link>
              </Empty>
            ) : (
              <ul className="list">
                {plugins.slice(0, 8).map((plugin) => (
                  <li key={plugin.id} className="list-row">
                    <div className="list-main">
                      <div className="list-title">{plugin.name ?? plugin.ref}</div>
                    </div>
                    <span className="list-meta mono">{plugin.current_version ?? "-"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
