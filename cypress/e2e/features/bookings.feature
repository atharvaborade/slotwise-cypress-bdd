@api @booking
Feature: Appointment availability, ownership and lifecycle
  A coach can meet one member at a time, and members control only their own appointments.

  Scenario Outline: A member can discover each coach's upcoming times
    Given a member named "owner" exists
    When "owner" requests available times for "<provider>"
    Then the response status is 200
    And the available times are unique supported UTC hours in the next seven days

    Examples:
      | provider |
      | maya     |
      | alex     |
      | sam      |

  Scenario Outline: Availability requires a known coach
    Given a member named "owner" exists
    When "owner" requests availability with "<problem>"
    Then the response status is 400
    And the response error is "Choose a provider"

    Examples:
      | problem          |
      | no provider      |
      | unknown provider |

  Scenario: A confirmed appointment persists only in its owner's history
    Given members named "owner" and "other" exist
    When "owner" books a future "maya" appointment called "first"
    Then the response status is 201
    And "owner" sees "first" as "confirmed" in their appointment history
    And "other" has no appointments

  Scenario: Appointment history is chronological and retains cancelled records
    Given a member named "owner" exists
    And "owner" has two appointments created in reverse time order
    When "owner" cancels appointment "earlier"
    Then the response status is 204
    And "owner" sees their appointments ordered by time
    And "owner" sees "earlier" as "cancelled" in their appointment history
    And "owner" sees "later" as "confirmed" in their appointment history

  @fault-double-booking
  Scenario: Another member cannot reserve an occupied coach and time
    Given members named "owner" and "other" exist
    And "owner" has a future "maya" appointment called "occupied"
    When "other" attempts to book the same coach and time as "occupied"
    Then the response status is 409
    And the response error is "That time was just booked. Choose another slot."
    And "other" has no appointments
    And "owner" sees "occupied" as "confirmed" in their appointment history

  Scenario: Concurrent requests have exactly one winner for a coach and time
    Given members named "owner" and "other" exist
    When both members simultaneously request the same future "alex" appointment
    Then exactly one request succeeds with 201 and the other receives 409
    And exactly one confirmed appointment exists across those two accounts

  Scenario: A member cannot reserve their own occupied coach and time again
    Given a member named "owner" exists
    And "owner" has a future "sam" appointment called "own-reservation"
    When "owner" attempts to book the same coach and time as "own-reservation"
    Then the response status is 409
    And "owner" sees exactly one appointment

  Scenario: Different coaches can be booked at the same time
    Given members named "owner" and "other" exist
    When the members reserve different coaches at the same future time
    Then both requests succeed with 201
    And each member sees only their own confirmed appointment

  @fault-ownership
  Scenario: A member cannot cancel another member's appointment
    Given members named "owner" and "other" exist
    And "owner" has a future "maya" appointment called "private"
    When "other" cancels appointment "private"
    Then the response status is 404
    And the response error is "Appointment not found"
    And "owner" sees "private" as "confirmed" in their appointment history

  Scenario: Cancelling releases the reservation and a repeated cancellation changes nothing
    Given members named "owner" and "other" exist
    And "owner" has a future "sam" appointment called "released"
    When "owner" cancels appointment "released"
    Then the response status is 204
    And "owner" sees "released" as "cancelled" in their appointment history
    When "owner" cancels appointment "released"
    Then the response status is 409
    And the response error is "Appointment already cancelled"
    When "other" attempts to book the same coach and time as "released"
    Then the response status is 201
    And "owner" sees "released" as "cancelled" in their appointment history

  Scenario Outline: A cancellation needs a valid existing appointment
    Given a member named "owner" exists
    When "owner" cancels using "<identifier>"
    Then the response status is <status>
    And "owner" has no appointments

    Examples:
      | identifier | status |
      | invalid-id | 400    |
      | 0          | 404    |
      | 999999999  | 404    |

  Scenario Outline: Invalid booking data does not create an appointment
    Given a member named "owner" exists
    When "owner" requests an appointment with "<problem>"
    Then the response status is 400
    And "owner" has no appointments

    Examples:
      | problem                 |
      | a past date             |
      | a malformed date        |
      | a date beyond 90 days   |
      | an impossible date      |
      | a noncanonical timestamp |
      | an unsupported hour     |
      | nonzero minutes         |
      | an unknown provider     |
      | no provider             |
      | no slot                 |
      | client-supplied owner   |
      | client-supplied status  |

  Scenario: Booking and cancellation update only the selected coach's availability
    Given members named "owner" and "other" exist
    And "owner" chooses a visible future time for "sam"
    When "owner" reserves that visible time
    Then the time is absent from "sam" availability for "other"
    And the time remains available for "maya" to "other"
    When "owner" cancels appointment "visible"
    Then the response status is 204
    And the time is available again for "sam" to "other"
