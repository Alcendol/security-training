Feature: Brute force protection on login
  As a security tester
  I want the login endpoint to throttle repeated failures
  So that attackers cannot guess passwords at will

  Scenario: Repeated failed logins are throttled
    Given a throwaway target account for brute force testing
    When I send 10 failed login attempts for that account
    Then at least one login attempt should be throttled with status 429
    And the throttled response should include a Retry-After header

  Scenario: A valid login still succeeds for an un-throttled account
    Given I am logged in to the API as a fresh user
    Then the response status should be 200

  Scenario: Weak passwords are rejected at registration
    When I register with a weak password "123"
    Then the response status should be 400
