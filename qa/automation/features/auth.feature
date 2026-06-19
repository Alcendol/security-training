Feature: Authentication and authorization controls
  As a security tester
  I want the server to enforce authentication and authorization
  So that protected data and actions are never exposed to the wrong user

  Scenario Outline: Protected endpoints reject unauthenticated requests
    When I send an unauthenticated "<method>" request to "<endpoint>"
    Then the response status should be 401

    Examples:
      | method | endpoint             |
      | GET    | /tasks               |
      | GET    | /users/me            |
      | GET    | /tasks/search?q=test |
      | DELETE | /tasks/999999        |
      | GET    | /admin/users         |

  Scenario: A regular user cannot reach the admin users endpoint
    Given I am logged in to the API as a fresh user
    When I request the admin users endpoint
    Then the response status should be 403

  Scenario: A user cannot update another user's profile (horizontal escalation)
    Given a fresh user "victim" is logged in to the API
    And a fresh user "attacker" is logged in to the API
    When "attacker" tries to update the profile of "victim" with name "Hacked"
    Then the response status should be 403

  Scenario: Profile update cannot escalate role via mass assignment
    Given I am logged in to the API as a fresh user
    When I update my own profile with name "QA Updated" and role "admin"
    Then the response status should be 200
    And my role should still be "user"

  Scenario: Client-side role tampering does not grant access to admin data
    Given I am logged in to the dashboard as the seed user
    When I tamper with the stored user role to "admin"
    And I reach the admin panel through the tampered link
    Then I should not see any admin user data
