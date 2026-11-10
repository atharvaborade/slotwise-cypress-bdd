@ui @browser
Feature: Usable booking journeys in a real browser
  Members can use every visible control and recover from expected errors.

  @headed-smoke
  Scenario: A new member registers, reloads, signs out and signs back in
    Given an anonymous visitor opens Slotwise
    When the visitor registers through the form
    Then their booking workspace and name are displayed
    When the member reloads the page
    Then their booking workspace and name are displayed
    When the member signs out through the navigation
    Then the registration form is displayed
    When the visitor signs back in through the form
    Then their booking workspace and name are displayed

  Scenario: A failed sign-in explains the error and permits recovery
    Given a registered member opens the sign-in form
    When the visitor signs in with an incorrect password through the form
    Then the form explains "Email or password is incorrect" and can be submitted again
    And the booking workspace stays hidden
    When the visitor signs back in through the form
    Then their booking workspace and name are displayed

  Scenario: Duplicate registration explains how to recover using sign-in
    Given a registered member opens the registration form
    When the visitor registers through the form
    Then the form explains "An account with this email already exists" and can be submitted again
    When the visitor switches to the sign-in form
    And the visitor signs back in through the form
    Then their booking workspace and name are displayed

  Scenario Outline: Invalid form fields stop account creation in the browser
    Given an anonymous visitor opens Slotwise
    When the visitor submits registration with an invalid "<field>" in the browser
    Then the "<field>" field reports native validation failure
    And the booking workspace stays hidden
    And the browser session is still anonymous

    Examples:
      | field    |
      | name     |
      | email    |
      | password |

  Scenario: Registration and sign-in controls expose the appropriate fields
    Given an anonymous visitor opens Slotwise
    When the visitor switches to the sign-in form
    Then the name field is hidden and password completion is for an existing account
    When the visitor switches back to registration
    Then the name field is required and password completion is for a new account

  @headed-smoke
  Scenario: Selecting each coach updates the selected state and available times
    Given a member opens their booking workspace
    When the member selects each coach in turn
    Then the last coach is selected and only its times are displayed

  Scenario: A member books, reloads, cancels and sees the released time again
    Given a member opens their booking workspace
    When the member chooses their reserved test time with "alex"
    And the member confirms the appointment
    Then the selected appointment is shown as confirmed
    When the member reloads the page
    Then the selected appointment is shown as confirmed
    When the member selects "alex" and cancels that appointment
    Then the selected appointment is shown as cancelled without a cancel button
    And the selected time is available again

  Scenario: A stale time produces useful conflict feedback without a duplicate booking
    Given a member opens their booking workspace
    And the member chooses their reserved test time with "maya"
    And another member reserves that selected time
    When the member confirms the appointment
    Then the page explains the time was just booked and allows another attempt
    And the member's appointment list is empty

  Scenario: An account sees none of another member's appointments in the browser
    Given another member already has an appointment
    And a member opens their booking workspace
    Then the member's appointment list is empty

  Scenario: A delayed availability response cannot replace the most recently selected coach
    Given a member opens their booking workspace
    When the member selects Sam while Alex availability is still loading
    Then Sam remains selected after the delayed Alex response arrives

  Scenario: Booking the final available time keeps confirmation disabled
    Given a member opens their booking workspace
    When the member books the coach's final available time
    Then no available times are explained and the confirmation button stays disabled
    And the selected appointment is shown as confirmed

  Scenario Outline: The layout fits a mobile screen
    Given a "<state>" visitor opens Slotwise on a mobile viewport
    Then the page fits without horizontal scrolling
    And the primary "<state>" action is visible

    Examples:
      | state      |
      | signed-out |
      | signed-in  |

  @accessibility
  Scenario Outline: The page has no detected WCAG A or AA violations
    Given a "<state>" visitor opens Slotwise
    Then the page has no detected WCAG A or AA violations

    Examples:
      | state      |
      | signed-out |
      | signed-in  |

  Scenario: Keyboard navigation exposes a skip link and reaches the account form
    Given an anonymous visitor opens Slotwise
    When the visitor begins keyboard navigation
    Then the skip link receives focus
    When the visitor continues to the registration form using the keyboard
    Then the name field receives focus

  @headed-smoke
  Scenario: A keyboard user can confirm and cancel an appointment
    Given a member opens their booking workspace
    When the member chooses their reserved test time with "sam"
    And the member confirms the appointment using the keyboard
    Then the selected appointment is shown as confirmed
    When the member cancels that appointment using the keyboard
    Then the selected appointment is shown as cancelled without a cancel button

  Scenario: A member name containing markup is displayed as text
    Given a member whose name contains markup opens their workspace
    Then the member name is visible as literal text without executable markup
