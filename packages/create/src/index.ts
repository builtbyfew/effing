import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Recursively copy a directory, restoring underscore-prefixed files to dotfiles.
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    // Restore dotfiles: _DOT_gitignore -> .gitignore, _DOT_env.example -> .env.example
    // Only restore _DOT_ prefixed files, preserve legitimate underscore-prefixed files (e.g., _index.tsx)
    const destName = entry.name.startsWith("_DOT_")
      ? "." + entry.name.slice(5)
      : entry.name;
    const destPath = path.join(dest, destName);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

function printUsage(): void {
  console.log(`
Usage: npm create @effing <project-name>

Creates a new Effing project with the starter template.

Examples:
  npm create @effing my-app
  pnpm create @effing my-app
  yarn create @effing my-app
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const projectName = args[0];

  if (!projectName) {
    console.error("Error: Please specify a project name.\n");
    printUsage();
    process.exit(1);
  }

  const root = path.resolve(projectName);
  const templateDir = path.resolve(__dirname, "../template");

  // Check if directory already exists
  try {
    await fs.access(root);
    console.error(`Error: Directory "${projectName}" already exists.`);
    process.exit(1);
  } catch {
    // Directory doesn't exist, good to proceed
  }

  console.log(`\nCreating a new Effing project in ${root}...\n`);

  // Copy template files, restoring dotfiles
  await copyDir(templateDir, root);

  // Update package.json with project name
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
  pkg.name = path.basename(root);
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  console.log("Done! To get started:\n");
  console.log(`  cd ${projectName}`);
  console.log("  npm install");
  console.log("  npm run dev\n");
  console.log("Then open http://localhost:3839 to see your project.\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
