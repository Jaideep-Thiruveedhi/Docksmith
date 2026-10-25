import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Both Node and Webpack preserve dependency junctions. This supports installations
// on another Windows drive, and behaves normally for ordinary node_modules folders.
const existing = process.env.NODE_OPTIONS ?? "";
const options = ["--preserve-symlinks", "--preserve-symlinks-main"]
  .filter((flag) => !existing.split(/\s+/).includes(flag))
  .join(" ");
const child = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/next/dist/bin/next", import.meta.url),
    ),
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: `${existing} ${options}`.trim() },
  },
);
child.on("error", (error) => {
  console.error(`Could not start Next.js: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
