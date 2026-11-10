import { defineConfig } from 'cypress';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild';

export default defineConfig({
  video: true,
  screenshotOnRunFailure: true,
  viewportWidth: 1440,
  viewportHeight: 900,
  defaultCommandTimeout: 8000,
  requestTimeout: 10000,
  retries: { runMode: 1, openMode: 0 },
  reporter: 'spec',
  e2e: {
    baseUrl: 'http://127.0.0.1:3000',
    specPattern: 'cypress/e2e/features/**/*.feature',
    supportFile: 'cypress/support/e2e.js',
    async setupNodeEvents(on, config) {
      let scenarioSequence = 0;
      await addCucumberPreprocessorPlugin(on, config);
      on('file:preprocessor', createBundler({
        plugins: [createEsbuildPlugin(config)],
      }));
      const httpRequest = async item => {
        const headers = { ...(item.headers || {}) };
        if (item.token) headers.Cookie = `session=${item.token}`;
        if (item.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
        const response = await fetch(`${config.baseUrl}${item.url}`, {
          method: item.method,
          headers,
          body: item.body === undefined ? undefined : typeof item.body === 'string' ? item.body : JSON.stringify(item.body),
        });
        const text = await response.text();
        let body = {};
        if (text) { try { body = JSON.parse(text); } catch { body = text; } }
        return { status: response.status, body, headers: Object.fromEntries(response.headers) };
      };
      on('task', {
        nextScenarioSequence() {
          scenarioSequence += 1;
          return scenarioSequence;
        },
        httpRequest,
        async parallelRequests(requests) {
          return Promise.all(requests.map(httpRequest));
        },
      });
      return config;
    },
  },
});

