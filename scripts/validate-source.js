import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Parser, AstBuilder, GherkinClassicTokenMatcher, generateMessages } from '@cucumber/gherkin';
import { IdGenerator, SourceMediaType } from '@cucumber/messages';

function files(root, extension) {
  return readdirSync(root).flatMap(name => {
    const path = resolve(root, name);
    return statSync(path).isDirectory() ? files(path, extension) : path.endsWith(extension) ? [path] : [];
  });
}

const features = files('cypress/e2e/features', '.feature');
const steps = files('cypress/e2e/step_definitions', '.js');
if (features.length !== 4 || steps.length < 2) throw new Error('Expected four parity features and at least two step-definition modules.');

const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher());
let scenarios = 0;
const featureSteps = [];
for (const feature of features) {
  const document = parser.parse(readFileSync(feature, 'utf8'));
  const messages = generateMessages(readFileSync(feature, 'utf8'), feature, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN, { includeSource: false, includeGherkinDocument: false, includePickles: true, newId: IdGenerator.incrementing() });
  const pickles = messages.map(message => message.pickle).filter(Boolean);
  scenarios += pickles.length;
  featureSteps.push(...pickles.flatMap(pickle => pickle.steps.map(step => step.text)));
}
if (scenarios !== 93) throw new Error(`Expected Playwright parity at 93 scenarios, found ${scenarios}.`);

const definitions = steps.flatMap(path => {
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(/(?:Given|When|Then)\((['"])(.*?)\1/g)].map(match => match[2]);
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
