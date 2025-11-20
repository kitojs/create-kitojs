#!/usr/bin/env node
import mri from "mri";
import prompts from "prompts";
import ora from "ora";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Entry point for the KitoJS project creation CLI tool.
 * This script initializes a new KitoJS project based on user input.
 */

const helpMessage = `
Usage: create-kitojs <PROJECT_NAME> [OPTIONS]

Options:
    -h, --help       Show this help message
    -v, --version    Show the version number
`;

const argv = mri<{
    help?: boolean,
    overwrite?: boolean,
    template?: string,
}>(process.argv.slice(2), {
    boolean: ['help', 'overwrite'],
    alias: { h: 'help' },
    string: ['template'],
});

interface Template {
    name: string;
    value: string;
    steps: string[];
}

const templates: Template[] = [{
    name: 'Node.js',
    value: 'nodejs',
    steps: [
        'cd <PROJECT_NAME>',
        'npm install',
        'npm run dev'
    ]
}];

async function selectTemplate(templateValue?: string): Promise<Template | undefined> {
    if (templates.length === 1) {
        return templates[0];
    }

    if (templateValue) {
        let selected = templates.find(t => t.value === templateValue);
        if (selected) {
            return selected;
        }

        console.error(`Template "${templateValue}" is not recognized.`);
        return undefined;
    }

    let { selectedTemplate } = await prompts({
        type: 'select',
        name: 'selectedTemplate',
        message: 'Select a runtime template:',
        choices: templates.map(t => ({ title: t.name, value: t.value })),
        initial: 0,
    });

    return templates.find(t => t.value === selectedTemplate);
}

async function createProject(projectName: string) {
    // Create project directory and initialize files

    // Check if the directory already exists
    if (fs.existsSync(projectName)) {
        if (!argv.overwrite) {
            let { overwrite } = await prompts({
                type: 'confirm',
                name: 'overwrite',
                message: `Directory "${projectName}" already exists. Do you want to overwrite it?`,
                initial: false,
            });

            if (!overwrite) {
                return;
            }
        }
    }

    // Select template
    let template = await selectTemplate(argv.template);

    let spinner = ora(`Creating a new KitoJS project: ${projectName}`).start();

    // Remove existing directory
    fs.rmSync(projectName, { recursive: true, force: true });

    fs.mkdirSync(projectName);

    // Copy template files based on template
    const templateDir = path.resolve(fileURLToPath(import.meta.url), '../../template', template.value);

    fs.cpSync(templateDir, projectName, { recursive: true });

    // Modify package.json with the project name
    const packageJsonPath = path.join(projectName, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    packageJson.name = projectName;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    spinner.succeed(`Project "${projectName}" created successfully!`);

    console.log(`\nNext steps:\n`);

    if (template) {
        template.steps.forEach(step => {
            console.log(`  ${step.replace('<PROJECT_NAME>', projectName)}`);
        });
    }

    console.log('');
}

async function init() {
    if (argv.help) {
        console.log(helpMessage);
        return;
    }

    const projectName = argv._[0];

    if (!projectName || typeof projectName !== 'string') {
        let { projectName } = await prompts({
            type: 'text',
            name: 'projectName',
            message: 'Please enter a valid project name:',
            validate: (name: string) => name.trim() === '' ? 'Project name cannot be empty.' : true,
        });

        if (projectName && typeof projectName === 'string') {
            await createProject(projectName);
        }
    }
    else {
        await createProject(projectName);
    }
}

init().catch((err) => {
    console.error(err);
});