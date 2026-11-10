import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Parser, AstBuilder, GherkinClassicTokenMatcher } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';

function files(root, extension) {
  return readdirSync(root).flatMap(name => {
    const path = resolve(root, name);
    return statSync(path).isDirectory() ? files(path, extension) : path.endsWith(extension) ? [path] : [];
  });
}

const features = files('cypress/e2e/features', '.feature');
const steps = files('cypress/e2e/step_definitions', '.js');
if (features.length < 3 || steps.length < 4) throw new Error('Expected at least three features and four step-definition modules.');

const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher());
let scenarios = 0;
const featureSteps = [];
for (const feature of features) {
  const document = parser.parse(readFileSync(feature, 'utf8'));
  scenarios += document.feature.children.filter(child => child.scenario).length;
  for (const child of document.feature.children) {
    const node = child.scenario || child.background;
    if (node) featureSteps.push(...node.steps.map(step => step.text));
  }
}
if (scenarios < 9) throw new Error(`Expected at least nine scenarios, found ${scenarios}.`);

const definitions = steps.flatMap(path => {
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(/(?:Given|When|Then)\('([^']+)'/g)].map(match => match[1]);
});
const expression = definition => new RegExp(`^${definition
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  .replace(/\\\{int\\\}/g, '\\d+')
  .replace(/\\\{string\\\}/g, '["\\\'].+?["\\\']')}$`);
const undefinedSteps = [...new Set(featureSteps.filter(step => !definitions.some(definition => expression(definition).test(step))))];
if (undefinedSteps.length) throw new Error(`Undefined Gherkin steps: ${undefinedSteps.join(' | ')}`);

const required = [
  'cypress/support/commands.js',
  'cypress/support/e2e.js',
  'cypress/common/selectors.js',
  'cypress/fixtures/users.json',
  'cypress.config.js',
  '.cypress-cucumber-preprocessorrc.json',
];
for (const path of required) readFileSync(path);

console.log(`Validated ${features.length} feature files, ${scenarios} scenarios, ${featureSteps.length} Gherkin steps and ${steps.length} step modules.`);
