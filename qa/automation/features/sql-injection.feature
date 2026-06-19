Feature: SQL Injection protection on task search
  As a security tester
  I want the task search endpoint to treat input as data, not executable SQL
  So that attackers cannot read or destroy the database

  Background:
    Given I am logged in to the API as a fresh user

  Scenario Outline: Search treats injection payloads as literal text
    Given I have created a task titled "SQLi Baseline" with description "private baseline content"
    When I search tasks via the API for "<payload>"
    Then the response status should be 200
    And the search results should not contain the baseline task
    And the response body should not expose database error details

    Examples:
      | payload                       |
      | ' OR '1'='1                   |
      | ' OR 1=1--                    |
      | '; DROP TABLE tasks; --       |
      | ' UNION SELECT * FROM users-- |
      | admin'--                      |

  Scenario: Legitimate search still returns matching results
    Given I have created a task titled "Quarterly Report" with description "finish the report"
    When I search tasks via the API for "Quarterly"
    Then the response status should be 200
    And the search results should contain a task titled "Quarterly Report"

  Scenario: Injection via the dashboard search box does not leak tasks
    Given I am logged in to the dashboard as the seed user
    And I have created a task titled "UI SQLi Baseline" through the dashboard
    When I search in the dashboard for "' OR '1'='1"
    Then the dashboard search results should not include "UI SQLi Baseline"
