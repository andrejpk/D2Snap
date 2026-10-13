import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

export async function fixtureFiles() {
  const root = fileURLToPath(new URL("./dist/", import.meta.url));
  const files = {};
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files[relative(root, path).split(sep).join("/")] = (await readFile(path)).toString("base64");
    }
  }
  await visit(root);
  if (!files["index.html"]) throw new Error("Build the fixture before browser validation: dist/index.html is missing");
  return files;
}
