import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const starterDir = path.resolve(root, "../../demos/starter");
const templateDir = path.resolve(root, "template");

// Files/folders to completely exclude from template
const EXCLUDE = new Set(["node_modules", "build", ".react-router", ".env"]);

/**
 * Recursively copy a directory, renaming dotfiles to underscore-prefixed names.
 * npm strips dotfiles from published packages, so we rename them and restore on scaffold.
 */
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDE.has(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    // Rename dotfiles: .gitignore -> _gitignore, .env.example -> _env.example
    const destName = entry.name.startsWith(".")
      ? "_" + entry.name.slice(1)
      : entry.name;
    const destPath = path.join(dest, destName);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function transformPackageJson() {
  const pkgPath = path.join(templateDir, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));

  // Remove private flag - users should be able to publish their projects
  delete pkg.private;

  // Replace workspace:* with actual versions from workspace packages
  for (const depType of ["dependencies", "devDependencies"]) {
    for (const dep of Object.keys(pkg[depType] || {})) {
      if (pkg[depType][dep] === "workspace:*" && dep.startsWith("@effing/")) {
        const pkgName = dep.replace("@effing/", "");
        const depPkgPath = path.resolve(root, "..", pkgName, "package.json");
        try {
          const depPkg = JSON.parse(await fs.readFile(depPkgPath, "utf-8"));
          pkg[depType][dep] = `^${depPkg.version}`;
        } catch {
          console.warn(`Warning: Could not read version for ${dep}`);
          pkg[depType][dep] = "^0.1.0";
        }
      }
    }
  }

  // Replace catalog: references with actual versions
  for (const depType of ["dependencies", "devDependencies"]) {
    for (const dep of Object.keys(pkg[depType] || {})) {
      if (pkg[depType][dep] === "catalog:") {
        // For catalog references, we need to look up the version from pnpm-workspace.yaml
        // For now, just use a reasonable default for typescript
        if (dep === "typescript") {
          pkg[depType][dep] = "^5.7.0";
        }
      }
    }
  }

  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

async function main() {
  console.log("Copying template from demos/starter...");

  // Clean and recreate template dir
  await fs.rm(templateDir, { recursive: true, force: true });

  // Copy all files, renaming dotfiles
  await copyDir(starterDir, templateDir);

  // Transform package.json
  await transformPackageJson();

  console.log("✓ Template ready in packages/create/template");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
