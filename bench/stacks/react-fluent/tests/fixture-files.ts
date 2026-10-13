import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export async function fixtureFiles(): Promise<Record<string, string>> {
  const root = fileURLToPath(new URL("../dist/", import.meta.url));
  const files: Record<string, string> = {};
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files[relative(root, path).split(sep).join("/")] = (await readFile(path)).toString("base64");
    }
  }
  await visit(root);
  if (!files["index.html"]) throw new Error("Build the Fluent fixture before running browser tests");
  return files;
}
