import { runUpdateCheck } from "./lib/updater";

const minutes = Number(process.env.UPDATE_INTERVAL_MINUTES ?? 30);

if (Number.isFinite(minutes) && minutes > 0) {
  const run = () =>
    runUpdateCheck()
      .then((summary) => {
        if (summary.updated.length || summary.failed.length) console.log("[updater]", summary);
      })
      .catch((error) => console.error("[updater]", error));

  setInterval(run, minutes * 60_000);
}
