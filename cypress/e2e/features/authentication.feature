@api @authentication
Feature: Member identity and session protection
  Accounts belong to the person who registered them, and a session grants only its assigned role.

  Scenario Outline: A visitor cannot use protected operations
    When an anonymous visitor sends "<method>" to "<path>"
    Then the response status is 401
    And the response error is "Please sign in"

    Examples:
      | method | path                     |
      | GET    | /api/me                  |
      | GET    | /api/appointments        |
      | GET    | /api/admin/summary       |
      | GET    | /api/slots?provider=maya |
      | POST   | /api/appointments        |
      | DELETE | /api/appointments/1      |
      | POST   | /api/logout              |

  Scenario: Registration normalizes identity and starts a member session
    When a visitor registers with a padded name and mixed-case email
    Then the response status is 201
    And the registered identity is normalized and contains no password
    And that visitor can retrieve the same member identity

  Scenario Outline: Invalid registration cannot create an identity
    When a visitor submits registration with "<problem>"
    Then the response status is 400
    And the visitor remains signed out

    Examples:
      | problem             |
      | blank name          |
      | missing name        |
      | oversized name      |
      | invalid email       |
      | oversized email     |
      | short password      |
      | oversized password  |
      | client admin role   |
      | unexpected field    |

  Scenario Outline: Registration accepts supported field boundaries
    When a visitor registers with "<boundary>"
    Then the response status is 201
    And that visitor can retrieve the same member identity

    Examples:
      | boundary                 |
      | a one-character name     |
      | an eighty-character name |
      | a twelve-character password |
      | a 128-character password |

  Scenario: Email identity is unique regardless of letter case
    Given a member named "owner" exists
    When another visitor registers with the owner's email in uppercase
    Then the response status is 409
    And the response error is "An account with this email already exists"
    And the visitor remains signed out

  Scenario Outline: Invalid credentials do not start a session
    Given a member named "owner" exists
    When a visitor signs in with "<problem>"
    Then the response status is <status>
    And the visitor remains signed out

    Examples:
      | problem          | status |
      | wrong password   | 401    |
      | unknown email    | 401    |
      | invalid email    | 400    |
      | short password   | 400    |
      | missing password | 400    |

  Scenario: Sign-in sets protected cookies and sign-out invalidates a copied session
    Given a member named "owner" exists
    When a visitor signs in using the owner's email in uppercase
    Then the response status is 200
    And the session cookie is HTTP-only and same-site strict
    And the response identity contains no password
    When that visitor signs out and replays the old session cookie
    Then the response status is 401
    And the response error is "Please sign in"

  Scenario: A fabricated session does not impersonate a member
    When a visitor requests their identity with a fabricated session cookie
    Then the response status is 401

  Scenario: A member cannot read administrator totals
    Given a member named "owner" exists
    When "owner" requests the administrator summary
    Then the response status is 403
    And the response error is "Administrator access required"

  Scenario: The configured administrator can read aggregate totals
    Given the configured administrator is signed in
    When the administrator requests the summary
    Then the response status is 200
    And the summary contains numeric user and confirmed-appointment totals
