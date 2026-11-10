import { Before } from '@badeball/cypress-cucumber-preprocessor';

Before(function ({ pickle }) {
  this.scenarioName = pickle.name;
  this.startedAt = new Date().toISOString();
});

