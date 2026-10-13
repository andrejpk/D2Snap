import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { filesSchema } from "./models.ts";

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
};

export function safePath(path: string): boolean {
  return /^[a-zA-Z0-9_./-]+$/.test(path)
    && !path.startsWith("/") && !path.split("/").some(part => part === ".." || part === ".");
}

export async function startServer(files: Record<string, string>, reportRoot?: string, port = 0) {
  const server = createServer((request, response) => {
    void (async () => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405).end("Method not allowed");
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      let name: string;
      let bytes: Buffer;
      if (pathname.startsWith("/fixture/")) {
        const currentFiles = reportRoot
          ? filesSchema.parse(JSON.parse(await readFile(join(reportRoot, "fixture.json"), "utf8")))
          : files;
        name = pathname.slice("/fixture/".length) || "index.html";
        if (!safePath(name) || !Object.hasOwn(currentFiles, name)) {
          response.writeHead(404).end("Fixture asset not found");
          return;
        }
        bytes = Buffer.from(currentFiles[name]!, "base64");
      } else {
        name = pathname.slice(1) || "index.html";
        if (!reportRoot || !safePath(name)) {
          response.writeHead(404).end("Report not found");
          return;
        }
        try { bytes = await readFile(join(reportRoot, name)); }
        catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            response.writeHead(404).end("Report artifact not found");
            return;
          }
          throw error;
        }
      }
      response.writeHead(200, {
        "Content-Type": mime[extname(name)] ?? "application/octet-stream",
        "Content-Length": bytes.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : bytes);
    })().catch(error => {
      console.error("Preview request failed:", error);
      if (!response.headersSent) response.writeHead(500);
      response.end("Preview request failed; see server log.");
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No preview server address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeIdleConnections();
    }),
  };
}
