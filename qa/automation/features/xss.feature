Feature: Stored XSS protection
  As a security tester
  I want script payloads in user content to render as inert text
  So that an attacker cannot run JavaScript in another user's browser

  Background:
    Given I am logged in to the dashboard as the seed user

  Scenario: A script tag in a task description is rendered as text, not executed
    When I create a task with description "<script>alert('XSS')</script>"
    Then no JavaScript dialog should be triggered
    And the task description "<script>alert('XSS')</script>" should be displayed as text

  Scenario: An onerror image payload in a task description does not execute
    When I create a task with description "<img src=x onerror=alert('XSS')>"
    Then no JavaScript dialog should be triggered
    And the task description "<img src=x onerror=alert('XSS')>" should be displayed as text

  Scenario: A script payload in the profile bio is rendered as text, not executed
    Given I open the profile page
    When I update my bio to "<img src=x onerror=alert('XSS')>"
    Then no JavaScript dialog should be triggered
    And the bio "<img src=x onerror=alert('XSS')>" should be displayed as text on the profile page
