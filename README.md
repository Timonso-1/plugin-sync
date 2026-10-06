# PluginSync

Verteilt Minecraft-Plugins über die Pelican Client-API auf mehrere Server. Alte Versionen werden anhand des
Plugin-Namens aus `plugin.yml`, `paper-plugin.yml` oder `velocity-plugin.json` erkannt und ersetzt, nicht anhand des
Dateinamens.

## Funktionen

- **Deploy**: JARs hochladen, Server auswählen, alte Version löschen, neue hochladen, optional Neustart
- **Auto-Update**: GitHub Releases (auch private Repos mit Token) und Modrinth, Intervall per `UPDATE_INTERVAL_MINUTES`
- **Verlauf**: jede Aktion pro Server und Plugin
- **Login**: GitHub oder Discord, nur Accounts aus `ALLOWED_USERS`

## Voraussetzungen

- Node.js 22.13 oder neuer (nutzt das eingebaute `node:sqlite`)
- Pelican **Client**-API-Key (Konto -> API-Schlüssel), kein Application-Key

## Lokal starten

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npx auth secret              # schreibt AUTH_SECRET
npm run dev
```

OAuth-Callback-URLs:

- GitHub: `http://localhost:3000/api/auth/callback/github`
- Discord: `http://localhost:3000/api/auth/callback/discord`

## Plugin-Quellen

| Quelle | Feld | Beispiel |
| --- | --- | --- |
| Modrinth | Projekt-Slug aus der URL | `modrinth.com/plugin/worldedit` -> `worldedit`, Loader `paper` |
| GitHub | `owner/repo` | `Timonso-1/mein-plugin`, optional Asset-Regex wie `-all\.jar$` |

"Nur stabile Releases" überspringt Beta- und Alpha-Versionen (Modrinth) bzw. Pre-Releases (GitHub).

## Deploy mit Coolify

- Build Pack: Dockerfile
- Persistentes Volume auf `/app/data` (SQLite-Datenbank)
- Umgebungsvariablen aus `.env.example` setzen, zusätzlich `AUTH_URL=https://<deine-domain>`
- Callback-URLs in GitHub und Discord auf die Domain umstellen

## Hinweise

- Upload und Download laufen über signierte URLs direkt zu Wings. Der Wings-Node muss daher von der App aus erreichbar
  sein.
- Ist dieselbe Version bereits installiert (gleicher Name, gleiche Version, gleiche Dateigröße), wird übersprungen und
  nicht neu gestartet.
