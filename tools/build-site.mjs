import { mkdirSync, copyFileSync, lstatSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// Publish only reviewed HTML artifacts, not repository tools or metadata.
for (const file of ["index.html", "archive/v2/index.html", "archive/v3/index.html", "archive/v4/index.html"]) {
  const target = join(root, "public", file);
  for (const relative of ["public", "public/archive", "public/archive/v2", "public/archive/v3", "public/archive/v4"]) {
    const path = join(root, relative);
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symlink: ${relative}`);
  }
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error(`Refusing symlink: ${file}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, file), target);
}
console.log("Built V5 public/index.html and preserved V2/V3/V4 HTML history");
