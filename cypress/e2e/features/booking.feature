@ui @booking
Feature: Slotwise appointment booking
  As an authenticated member
  I want to manage coaching appointments
  So that I can reserve and release suitable times

  Background:
    Given I am an authenticated Slotwise member

  @smoke
  Scenario: A member books the first available appointment
    When I book the first available appointment
    Then a confirmed appointment should be listed

  Scenario: A member chooses another coach before booking
    When I choose the coach "Alex Morgan"
    And I book the first available appointment
    Then the confirmed appointment should be with "Alex Morgan"

  Scenario: A member cancels a confirmed appointment
    Given I have a confirmed appointment
    When I cancel the confirmed appointment
    Then the appointment should be marked as cancelled
    And the released appointment time should become available

