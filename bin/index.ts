#!/usr/bin/env node

// biome-ignore assist/source/organizeImports: ...
import mri from "mri";
import prompts from "prompts";
import ora from "ora";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

/**
 * Entry point for the KitoJS project creation CLI tool.
 * This script initializes a new KitoJS project based on user input.
 */

const helpMessage = `
Usage: create-kitojs <PROJECT_NAME> [OPTIONS]

Options:
    -h, --help       Show this help message
    --overwrite     Overwrite existing project directory if it exists
    --template      Specify a runtime template (e.g., "nodejs", "bun")
`;

const argv = mri<{
  help?: boolean;
  overwrite?: boolean;
  template?: string;
}>(process.argv.slice(2), {
  boolean: ["help", "overwrite"],
  alias: { h: "help" },
  string: ["template"],
});

function detectPackageManager(): string {
  const userAgent = process.env.npm_config_user_agent ?? "";

  if (userAgent.includes("pnpm")) return "pnpm";
  if (userAgent.includes("yarn")) return "yarn";
  if (userAgent.includes("bun")) return "bun";
  if (userAgent.includes("npm")) return "npm";
  if (userAgent.includes("deno")) return "deno";

  return "npm";
}

interface Template {
  name: string;
  value: string;
  steps: string[];
}

const templates: Template[] = [
  {
    name: "Node.js",
    value: "nodejs",
    steps: ["cd <PROJECT_NAME>", "npm install", "npm run dev"],
  },
  {
    name: "Bun",
    value: "bun",
    steps: ["cd <PROJECT_NAME>", "bun install", "bun dev"],
  },
];

async function selectTemplate(
  templateValue?: string,
): Promise<Template | undefined> {
  if (templates.length === 1) {
    return templates[0];
  }

  if (templateValue) {
    const selected = templates.find((t) => t.value === templateValue);
    if (selected) {
      return selected;
    }

    console.error(`Template "${templateValue}" is not recognized.`);
    return undefined;
  }

  const { selectedTemplate } = await prompts({
    type: "select",
    name: "selectedTemplate",
    message: "Select a runtime template:",
    choices: templates.map((t) => ({ title: t.name, value: t.value })),
    initial: 0,
  });

  return templates.find((t) => t.value === selectedTemplate);
}

async function createProject(projectName: string) {
  // Create project directory and initialize files

  // Check if the directory already exists
  if (fs.existsSync(projectName)) {
    if (!argv.overwrite) {
      const { overwrite } = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `Directory "${projectName}" already exists. Do you want to overwrite it?`,
        initial: false,
      });

      if (!overwrite) {
        return;
      }
    }
  }

  // Select template
  const template = await selectTemplate(argv.template);

  if (!template) {
    return;
  }

  const spinner = ora(`Creating a new KitoJS project: ${projectName}`).start();

  // Remove existing directory
  fs.rmSync(projectName, { recursive: true, force: true });

  fs.mkdirSync(projectName);

  // Copy template files based on template
  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    "../../template",
    template.value,
  );

  fs.cpSync(templateDir, projectName, { recursive: true });

  // Modify package.json with the project name
  const packageJsonPath = path.join(projectName, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  packageJson.name = projectName;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  spinner.succeed(`Project "${projectName}" created successfully!`);

  const pkgManager = detectPackageManager();

  const { installDeps } = await prompts({
    type: "confirm",
    name: "installDeps",
    message: `Do you want to install dependencies using "${pkgManager}"?`,
    initial: false,
  });

  if (installDeps) {
    const spinnerDeps = ora(
      `Creating a new Kito project: ${projectName}`,
    ).start();

    try {
      spinnerDeps.info(`Installing dependencies using ${pkgManager}...\n`);

      execSync(`${pkgManager} install`, { stdio: "inherit", cwd: projectName });

      spinner.succeed(`Dependencies installed successfully!`);
      spinner.stop();
    } catch (_) {
      spinner.fail(`Failed to install dependencies automatically.`);
    }
  }

  console.log(`\nNext steps:\n`);

  if (template) {
    template.steps.forEach((step) => {
      console.log(`  ${step.replace("<PROJECT_NAME>", projectName)}`);
    });
  }

  console.log("");
}

async function init() {
  if (argv.help) {
    console.log(helpMessage);
    return;
  }

  const projectName = argv._[0];

  if (!projectName || typeof projectName !== "string") {
    const { projectName } = await prompts({
      type: "text",
      name: "projectName",
      message: "Please enter a valid project name:",
      validate: (name: string) =>
        name.trim() === "" ? "Project name cannot be empty." : true,
    });

    if (projectName && typeof projectName === "string") {
      await createProject(projectName);
    }
  } else {
    await createProject(projectName);
  }
}

init().catch((err) => {
  console.error(err);
});
