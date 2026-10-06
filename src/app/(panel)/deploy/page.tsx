import { Server } from "@/components/icons";
import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/ui";
import { listServers } from "@/lib/db";
import DeployForm from "./deploy-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deploy" };

export default async function DeployPage() {
  const servers = (await listServers()).map(({ id, name }) => ({ id, name }));

  return (
    <>
      <PageHeader
        title="Plugins deployen"
        subtitle="JARs hochladen, alte Versionen werden anhand des Plugin-Namens erkannt und ersetzt."
      />
      {servers.length === 0 ? (
        <Card>
          <Empty icon={<Server size={20} />} title="Noch keine Server angelegt">
            <Link href="/servers">Server hinzufügen</Link>
          </Empty>
        </Card>
      ) : (
        <DeployForm servers={servers} />
      )}
    </>
  );
}
