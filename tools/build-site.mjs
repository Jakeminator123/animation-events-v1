import { mkdirSync, copyFileSync, lstatSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// Publish only the two reviewed HTML artifacts, not repository tools or metadata.
for (const file of ["index.html", "archive/v2/index.html"]) {
  const target = join(root, "public", file);
  for (const relative of ["public", "public/archive", "public/archive/v2"]) {
    const path = join(root, relative);
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symlink: ${relative}`);
  }
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error(`Refusing symlink: ${file}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, file), target);
}
console.log("Built public/index.html and preserved public/archive/v2/index.html");
