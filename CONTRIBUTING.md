# Contributing to GRB Billing System

We welcome contributions to improve the GRB Billing System. To maintain code quality, security, and stability, please adhere to the following guidelines:

## Development Workflow

1. **Fork/Branch**: Create a descriptive feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Coding Standards**: Ensure your code is clean and adheres to the configured linter. Run ESLint before committing:
   ```bash
   cd backend
   npm run lint
   ```
3. **Write Tests**: Add tests in `backend/tests/` for any new logic. Run all tests to make sure no features break:
   ```bash
   npm test
   ```
4. **Dependency Audits**: Run dependency checks to confirm no vulnerable modules are introduced:
   ```bash
   npm audit
   ```

## Commit Guidelines

- Write clear, concise commit messages.
- Never commit configuration files containing credentials, passwords, database URLs, or API keys. Double-check your `git status` before committing.
