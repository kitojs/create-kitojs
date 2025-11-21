#!/usr/bin/env node

// biome-ignore assist/source/organizeImports: ...
import mri from "mri";
import prompts from "prompts";
import ora from "ora";
import chalk from "chalk";
import gradient from "gradient-string";
import figlet from "figlet";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

/**
 * Entry point for the KitoJS project creation CLI tool.
 * This script initializes a new KitoJS project based on user input.
 */

const kitoGradient = gradient(["#FF6B6B", "#4ECDC4", "#45B7D1"]);

const successColor = chalk.green;
const errorColor = chalk.red;
const infoColor = chalk.cyan;
const warningColor = chalk.yellow;

function showBanner() {
  const banner = figlet.textSync("Kito", {
    font: "ANSI Shadow",
    horizontalLayout: "default",
  });
  console.log(kitoGradient(banner));
  console.log(
    kitoGradient.multiline(
      "\n  ✨ Welcome to Kito - The TypeScript framework written in Rust. ✨\n",
    ),
  );
}

const helpMessage = `
${chalk.bold("Usage:")} ${infoColor("create-kitojs")} ${chalk.dim("<PROJECT_NAME>")} ${chalk.dim("[OPTIONS]")}

${chalk.bold("Options:")}
    ${successColor("-h, --help")}       Show this help message
    ${successColor("--overwrite")}     Overwrite existing project directory if it exists
    ${successColor("--template")}      Specify a runtime template (e.g., "nodejs", "bun")

${chalk.bold("Examples:")}
    ${chalk.dim("$")} ${infoColor("npm create kitojs@latest")}
    ${chalk.dim("$")} ${infoColor("npm create kitojs@latest")} my-project
    ${chalk.dim("$")} ${infoColor("npm create kitojs@latest")} my-project ${chalk.dim("--template bun")}
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
  if (userAgent.includes("deno")) return "deno";
  if (userAgent.includes("npm")) return "npm";

  return "npm";
}

interface Template {
  name: string;
  value: string;
  description: string;
  emoji: string;
  steps: string[];
}

const templates: Template[] = [
  {
    name: "Node.js",
    value: "nodejs",
    description: "Standard Node.js runtime with TypeScript",
    emoji: "🟢",
    steps: ["cd <PROJECT_NAME>", "npm install", "npm run dev"],
  },
  {
    name: "Bun",
    value: "bun",
    description: "Blazing fast JavaScript runtime",
    emoji: "🥟",
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
      console.log(
        `\n${successColor("✓")} Using template: ${infoColor(selected.name)} ${selected.emoji}\n`,
      );
      return selected;
    }

    console.error(
      `\n${errorColor("✗")} Template "${templateValue}" is not recognized.\n`,
    );
    return undefined;
  }

  const { selectedTemplate } = await prompts(
    {
      type: "select",
      name: "selectedTemplate",
      message: "Select a runtime template:",
      choices: templates.map((t) => ({
        title: `${t.emoji}  ${chalk.bold(t.name)} ${chalk.dim(`- ${t.description}`)}`,
        value: t.value,
      })),
      initial: 0,
    },
    {
      onCancel: () => {
        console.log(`\n${warningColor("⚠")} Operation cancelled by user.\n`);
        process.exit(0);
      },
    },
  );

  return templates.find((t) => t.value === selectedTemplate);
}

async function createProject(projectName: string) {
  if (fs.existsSync(projectName)) {
    if (!argv.overwrite) {
      const { overwrite } = await prompts(
        {
          type: "confirm",
          name: "overwrite",
          message: `${warningColor("⚠")} Directory "${projectName}" already exists. Overwrite?`,
          initial: false,
        },
        {
          onCancel: () => {
            console.log(`\n${infoColor("ℹ")} Project creation cancelled.\n`);
            process.exit(0);
          },
        },
      );

      if (!overwrite) {
        console.log(`\n${infoColor("ℹ")} Project creation cancelled.\n`);
        return;
      }
    }
  }

  const template = await selectTemplate(argv.template);

  if (!template) {
    return;
  }

  const spinner = ora({
    text: `Creating your Kito project...`,
    color: "cyan",
  }).start();

  try {
    if (fs.existsSync(projectName)) {
      fs.rmSync(projectName, { recursive: true, force: true });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    spinner.text = "Setting up project structure...";
    fs.mkdirSync(projectName);

    const templateDir = path.resolve(
      fileURLToPath(import.meta.url),
      "../../template",
      template.value,
    );

    fs.cpSync(templateDir, projectName, { recursive: true });

    await new Promise((resolve) => setTimeout(resolve, 300));

    spinner.text = "Configuring package.json...";

    const packageJsonPath = path.join(projectName, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    packageJson.name = projectName;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    await new Promise((resolve) => setTimeout(resolve, 300));

    spinner.succeed(
      `${successColor("✓")} Project "${chalk.bold(projectName)}" created successfully!`,
    );
  } catch (error) {
    spinner.fail(`${errorColor("✗")} Failed to create project.`);
    console.error(error);
    process.exit(1);
  }

  const pkgManager = detectPackageManager();

  console.log(
    `\n${infoColor("ℹ")} Detected package manager: ${chalk.bold(pkgManager)}\n`,
  );

  const { installDeps } = await prompts(
    {
      type: "confirm",
      name: "installDeps",
      message: "Install dependencies now?",
      initial: true,
    },
    {
      onCancel: () => {
        printNextSteps(projectName, template, false);
        process.exit(0);
      },
    },
  );

  if (installDeps) {
    const spinnerDeps = ora({
      text: "Installing dependencies...\n",
      color: "cyan",
    }).start();

    try {
      execSync(`${pkgManager} install`, {
        stdio: "inherit",
        cwd: projectName,
      });

      spinnerDeps.succeed(
        `${successColor("✓")} Dependencies installed successfully!`,
      );
    } catch (_) {
      spinnerDeps.fail(
        `${errorColor("✗")} Failed to install dependencies automatically.`,
      );
      console.log(
        `${infoColor("ℹ")} You can install them manually by running: ${chalk.bold(`cd ${projectName} && ${pkgManager} install`)}\n`,
      );
    }
  }

  printNextSteps(projectName, template, installDeps);
}

function printNextSteps(
  projectName: string,
  template: Template,
  depsInstalled: boolean,
) {
  console.log(`\n${kitoGradient("═".repeat(50))}\n`);
  console.log(chalk.bold.white("🚀 Next steps:\n"));

  const steps = depsInstalled ? template.steps.slice(1) : template.steps;

  steps.forEach((step, index) => {
    const stepNumber = chalk.dim(`${index + 1}.`);
    const command = chalk.cyan(step.replace("<PROJECT_NAME>", projectName));
    console.log(`  ${stepNumber} ${command}`);
  });

  console.log(`\n${kitoGradient("═".repeat(50))}\n`);
  console.log(
    chalk.dim(
      `  📚 Documentation: ${chalk.underline("https://kito.pages.dev")}`,
    ),
  );
  console.log(
    chalk.dim(
      `  🐛 Issues: ${chalk.underline("https://github.com/kitojs/kitojs/issues")}`,
    ),
  );
  console.log(`\n${kitoGradient("  Happy coding! ✨")}\n`);
}

async function init() {
  if (argv.help) {
    showBanner();
    console.log(helpMessage);
    return;
  }

  showBanner();

  let projectName = argv._[0];

  if (!projectName || typeof projectName !== "string") {
    const response = await prompts(
      {
        type: "text",
        name: "projectName",
        message: "What's your project name?",
        initial: "my-kito-app",
        validate: (name: string) => {
          if (name.trim() === "") return "Project name cannot be empty.";
          if (!/^[a-z0-9-_]+$/.test(name))
            return "Project name can only contain lowercase letters, numbers, hyphens, and underscores.";
          return true;
        },
      },
      {
        onCancel: () => {
          console.log(`\n${warningColor("⚠")} Operation cancelled by user.\n`);
          process.exit(0);
        },
      },
    );

    projectName = response.projectName;
  }

  if (projectName && typeof projectName === "string") {
    await createProject(projectName);
  }
}

init().catch((err) => {
  console.error(`\n${errorColor("✗")} An unexpected error occurred:\n`);
  console.error(err);
  process.exit(1);
});
