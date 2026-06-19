Feature: Secure client-side data storage
  As a security tester
  I want sensitive data kept out of the browser's web storage
  So that XSS or local access cannot steal tokens or credentials

  Scenario: No JWT token is stored in web storage after login
    Given I am logged in to the dashboard as the seed user
    Then localStorage should not contain a JWT token
    And sessionStorage should not contain a JWT token

  Scenario: No password is stored in web storage after login
    Given I am logged in to the dashboard as the seed user
    Then web storage should not contain any password

  Scenario: Only safe, non-sensitive user fields are stored
    Given I am logged in to the dashboard as the seed user
    Then the stored user object should only contain id, name and role

  Scenario: The auth token is delivered in an HttpOnly cookie, not the body
    Given I am logged in to the API as a fresh user
    Then the login response body should not contain a token
    And the auth cookie should be HttpOnly
