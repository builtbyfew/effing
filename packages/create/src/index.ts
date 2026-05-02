import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  const slug = slugify(path.basename(root));

  // Update package.json with project name
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
  pkg.name = slug;
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  // Update effing-cloud.config.ts with project name
  const cloudConfigPath = path.join(root, "effing-cloud.config.ts");
  try {
    const cloudConfig = await fs.readFile(cloudConfigPath, "utf-8");
    const updated = cloudConfig.replace(
      /project:\s*"[^"]*"/,
      `project: "${slug}"`,
    );
    await fs.writeFile(cloudConfigPath, updated);
  } catch {
    // effing-cloud.config.ts is optional
  }

  // Update README.md title with project name
  const readmePath = path.join(root, "README.md");
  try {
    const readme = await fs.readFile(readmePath, "utf-8");
    const updated = readme.replace(
      /^# Effing project `starter`$/m,
      `# Effing project \`${slug}\``,
    );
    await fs.writeFile(readmePath, updated);
  } catch {
    // README.md is optional
  }

  console.log("Done! To get started:\n");
  console.log(`  cd ${projectName}`);
  console.log("  npm install    # or: pnpm install");
  console.log("  npm run dev    # or: pnpm run dev\n");
  console.log("Then open http://localhost:3839 to see your project.\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
