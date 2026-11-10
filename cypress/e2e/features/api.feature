@api
Feature: Slotwise API contract
  The service should protect member data and enforce booking rules

  Scenario: Health endpoint reports a working service
    When I request the health endpoint
    Then the API response status should be 200
    And the API response should contain status "ok"

  Scenario: An anonymous visitor cannot read appointments
    When I request appointments without authentication
    Then the API response status should be 401
    And the API error should be "Please sign in"

  Scenario: A member can retrieve the available coaches
    Given I register a member through the API
    When I request the providers endpoint
    Then the API response status should be 200
    And three providers should be returned

