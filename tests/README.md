# Agent Package Tests

This directory contains tests for the **Agent Core Runtime** (`packages/agent`).

## Structure

- **`integration/`**: Tests that verify the internal logic of the Agent loop, including:
  - Registry loading
  - Authentication headers
  - Error handling (network failures, invalid jobs)
  - _Note: These tests use a Mock API, not a real Orchestrator._

- **`e2e/`**: "Black Box" tests that spawn the actual `dist/main.js` process.
  - Verifies the process starts, connects to a local port, and shuts down cleanly.
  - Validates CLI arguments and environment variable parsing.

## Running Tests

```bash
# Run all agent tests
npm test

# Run only agent integration tests
npm test -- tests/integration

# Run only agent e2e tests
npm test -- tests/e2e
```
