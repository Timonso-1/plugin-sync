export async function register() {
  // Import nur innerhalb des Blocks, damit Webpack ihn aus dem Edge-Bundle entfernt
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
