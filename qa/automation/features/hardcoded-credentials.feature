Feature: No hardcoded credentials in source code
  As a security tester
  I want secrets kept out of tracked source and supplied via the environment
  So that leaking the repository does not leak credentials

  Scenario: Frontend source contains no hardcoded secrets
    When I scan the frontend source for hardcoded secret patterns
    Then no hardcoded secrets should be found

  Scenario: Backend and config files contain no hardcoded secrets
    When I scan the backend and config files for hardcoded secret patterns
    Then no hardcoded secrets should be found

  Scenario: Sensitive config is provided through environment variables
    Then the backend should read the JWT secret from the environment
    And the .env.example template should not contain real secret values
    And the .env file should be excluded from version control
