import { History, PackageCheck, RefreshCw, ShieldCheck, Upload } from "@/components/icons";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { DiscordIcon, GithubIcon } from "@/components/brand-icons";

export const metadata = { title: "Anmelden" };

const ERRORS: Record<string, string> = {
  AccessDenied: "Dieser Account ist nicht freigegeben. Trag ihn in ALLOWED_USERS ein.",
  Configuration: "Die Anmeldung ist falsch konfiguriert. Prüfe AUTH_SECRET und die OAuth-Zugangsdaten.",
};

const FEATURES = [
  { icon: Upload, title: "Ein Upload, alle Server", text: "JARs einmal hochladen und auf beliebig viele Server verteilen." },
  { icon: RefreshCw, title: "Auto-Update", text: "Neue Releases von GitHub und Modrinth werden automatisch ausgerollt." },
  { icon: History, title: "Lückenloser Verlauf", text: "Jede ersetzte Version und jeder Neustart nachvollziehbar." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="login">
      <div className="login-glow" aria-hidden="true" />
      <div className="login-grid" aria-hidden="true" />

      <section className="login-intro">
        <div className="brand brand-lg">
          <span className="brand-mark">
            <PackageCheck size={20} />
          </span>
          <span className="brand-text">
            <strong>PluginSync</strong>
            <span>Deploy Panel</span>
          </span>
        </div>
        <h1>
          Plugins verteilen,
          <br />
          <span className="login-accent">ohne Dateimanager.</span>
        </h1>
        <ul className="login-features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="feature-icon">
                <Icon size={16} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="login-card">
        <div className="login-card-head">
          <h2>Anmelden</h2>
          <p className="muted">Mit einem freigegebenen Account fortfahren</p>
        </div>

        {error && <div className="alert alert-danger">{ERRORS[error] ?? "Anmeldung fehlgeschlagen. Bitte erneut versuchen."}</div>}

        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn btn-oauth btn-github">
            <GithubIcon size={18} />
            Mit GitHub anmelden
          </button>
        </form>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn btn-oauth btn-discord">
            <DiscordIcon size={18} />
            Mit Discord anmelden
          </button>
        </form>

        <p className="login-note">
          <ShieldCheck size={14} />
          Zugriff nur für Accounts aus der Freigabeliste
        </p>
      </section>
    </div>
  );
}
