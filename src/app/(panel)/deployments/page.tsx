import { History } from "lucide-react";
import { Badge, Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { listDeployments } from "@/lib/db";
import { formatDateTime } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verlauf" };

export default function DeploymentsPage() {
  const deployments = listDeployments(300);

  return (
    <>
      <PageHeader title="Verlauf" subtitle="Die letzten 300 Aktionen über alle Server" />
      <Card flush>
        {deployments.length === 0 ? (
          <Empty icon={<History size={20} />} title="Noch keine Deployments" />
        ) : (
          <ul className="list">
            {deployments.map((entry) => (
              <li key={entry.id} className="list-row">
                <div className="list-main">
                  <div className="list-title">
                    {entry.plugin_name}
                    <StatusBadge status={entry.status} />
                    {entry.trigger === "auto" && <Badge tone="info">Auto</Badge>}
                  </div>
                  <div className="list-sub">
                    {entry.server_name}
                    {entry.version && ` · ${entry.version}`}
                    {entry.file_name && (
                      <>
                        {" · "}
                        <span className="mono">{entry.file_name}</span>
                      </>
                    )}
                    {entry.removed && ` · ersetzt ${entry.removed}`}
                  </div>
                  {entry.message && entry.status !== "success" && (
                    <div className={`list-sub ${entry.status === "error" ? "text-danger" : ""}`}>{entry.message}</div>
                  )}
                </div>
                <span className="list-meta">{formatDateTime(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
