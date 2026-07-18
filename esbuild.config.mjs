import esbuild from "esbuild";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import process from "node:process";

const prod = process.argv[2] === "production";

const common = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "browser",
  external: ["react", "react-dom", "react-dom/client"],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  treeShaking: true,
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  loader: {
    ".ts": "ts",
    ".tsx": "tsx",
  },
};

if (!prod) {
  const context = await esbuild.context({ ...common, define: { __GEMIHUB_DESKTOP__: "false" }, sourcemap: "inline", outfile: "main.js" });
  await context.watch();
} else {
  await mkdir(".build", { recursive: true });
  await esbuild.build({ ...common, define: { __GEMIHUB_DESKTOP__: "false" }, outfile: "main.js" });
  await esbuild.build({ ...common, define: { __GEMIHUB_DESKTOP__: "true" }, outfile: ".build/main.gemihub-desktop.js" });
  const diff = spawnSync("diff", ["-u", "--label", "a/main.js", "--label", "b/main.js", "main.js", ".build/main.gemihub-desktop.js"], { encoding: "utf8" });
  if (diff.status !== 1 || !diff.stdout.startsWith("--- a/main.js\n+++ b/main.js\n")) throw new Error(diff.stderr || "Could not generate the GemiHub Desktop host patch.");
  await mkdir("patches", { recursive: true });
  await writeFile("patches/gemihub-desktop.patch", diff.stdout);
  await rm(".build", { recursive: true, force: true });
}
