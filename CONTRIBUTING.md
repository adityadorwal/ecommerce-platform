# Contributing to E-commerce Platform

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Test locally
6. Submit a pull request

## Code Style

### JavaScript/Node.js
- Use ES6+ features
- Follow Airbnb style guide
- Use meaningful variable names
- Add JSDoc comments for functions

### React
- Use functional components with hooks
- Keep components small and focused
- Use Material-UI components consistently
- Follow React best practices

### YAML (Helm/Kubernetes)
- Use 2-space indentation
- Add comments for complex configurations
- Follow Kubernetes naming conventions

## Testing

Before submitting a PR:

```bash
# Test local deployment
make setup-local

# Verify platform works
make status

# Test store creation
# Use the UI to create a test store

# Check logs
make logs-dashboard
make logs-orchestrator

# Cleanup
make clean
```

## Pull Request Process

1. Update documentation if needed
2. Add/update tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Request review from maintainers

## Commit Messages

Use conventional commits:

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

Examples:
- `feat: add MedusaJS store support`
- `fix: correct store deletion bug`
- `docs: update setup guide`

## Feature Requests

Open an issue with:
- Clear description
- Use case
- Expected behavior
- Optional: Implementation suggestions

## Bug Reports

Include:
- Description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, K8s version, etc.)
- Logs if applicable

## Questions?

Open a discussion or issue for questions.

Thank you for contributing! 🎉
