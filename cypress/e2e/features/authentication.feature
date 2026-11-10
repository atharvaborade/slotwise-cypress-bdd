@ui @auth
Feature: Slotwise member authentication
  As a member
  I want secure access to Slotwise
  So that my appointments remain private

  Background:
    Given I open the Slotwise registration page

  @smoke
  Scenario: A new member creates an account
    When I register with valid unique details
    Then the booking workspace should be displayed
    And my member name should be shown

  Scenario: Registration rejects invalid details
    When I submit invalid registration details
    Then the registration should remain on screen
    And an invalid-field message should be displayed

  Scenario: A returning member signs in and signs out
    Given an existing member account
    When I switch to sign in
    And I sign in with the existing credentials
    Then the booking workspace should be displayed
    When I sign out
    Then the registration form should be displayed

