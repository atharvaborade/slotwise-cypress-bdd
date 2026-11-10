@api @contract
Feature: Public discovery and defensive HTTP behaviour
  Clients receive predictable JSON responses and cannot write from a foreign origin.

  Scenario: Health and the coach catalogue are available without a session
    When a visitor checks application health and discovers coaches
    Then health is reported as "ok"
    And the catalogue contains all three distinct coaches and their specialties

  Scenario Outline: Unknown API routes return JSON rather than application markup
    When an anonymous visitor sends "<method>" to "/api/unknown-endpoint"
    Then the response status is 404
    And the response error is "Endpoint not found"
    And the response content type is JSON

    Examples:
      | method |
      | GET    |
      | POST   |
      | DELETE |

  Scenario Outline: Malformed JSON is reported as a client error
    Given a member named "owner" exists
    When "owner" sends malformed JSON to "<path>"
    Then the response status is 400
    And the response error is "Invalid JSON"

    Examples:
      | path              |
      | /api/register     |
      | /api/appointments |

  Scenario: Oversized JSON is rejected without a server error
    When a visitor sends a JSON registration body larger than the supported limit
    Then the response status is 413
    And the response content type is JSON

  Scenario Outline: Foreign-origin writes are rejected even for an authenticated member
    Given a member named "owner" exists
    And "owner" has a future "alex" appointment called "protected"
    When "owner" attempts a cross-origin "<operation>"
    Then the response status is 403
    And the response error is "Cross-origin writes are not allowed"
    And "owner" is still signed in
    And "owner" sees "protected" as "confirmed" in their appointment history

    Examples:
      | operation    |
      | registration |
      | sign-in      |
      | sign-out     |
      | booking      |
      | cancellation |

  Scenario: API responses disable caching and include browser security headers
    When an anonymous visitor sends "GET" to "/api/health"
    Then the response status is 200
    And private responses are not cached and browser security headers are present
