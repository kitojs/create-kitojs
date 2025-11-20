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
const argv = mri(process.argv.slice(2), {
    boolean: ['help', 'overwrite'],
    alias: { h: 'help' },
    string: ['template'],
});
const templates = [{
        name: 'Node.js',
        value: 'nodejs',
        steps: [
            'cd <PROJECT_NAME>',
            'npm install',
            'npm run dev'
        ]
    }];
async function createProject(projectName) {
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
    let template;
    if (argv.template) {
        if (templates.some(t => t.value === argv.template)) {
            template = argv.template;
        }
        else {
            console.error(`Template "${argv.template}" is not recognized.`);
            return;
        }
    }
    else {
        let { selectedTemplate } = await prompts({
            type: 'select',
            name: 'selectedTemplate',
            message: 'Select a runtime template:',
            choices: templates.map(t => ({ title: t.name, value: t.value })),
            initial: 0,
        });
        template = selectedTemplate;
    }
    let spinner = ora(`Creating a new KitoJS project: ${projectName}`).start();
    // Remove existing directory if overwrite is specified
    fs.rmSync(projectName, { recursive: true, force: true });
    fs.mkdirSync(projectName);
    // Copy template files based on runtime
    const templateDir = path.resolve(fileURLToPath(import.meta.url), '../../template', template);
    fs.cpSync(templateDir, projectName, { recursive: true });
    // Modify package.json with the project name
    const packageJsonPath = path.join(projectName, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    packageJson.name = projectName;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    spinner.succeed(`Project "${projectName}" created successfully!`);
    console.log(`\nNext steps:\n`);
    const selectedTemplate = templates.find(t => t.value === template);
    if (selectedTemplate) {
        selectedTemplate.steps.forEach(step => {
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
            validate: (name) => name.trim() === '' ? 'Project name cannot be empty.' : true,
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
//# sourceMappingURL=index.js.map