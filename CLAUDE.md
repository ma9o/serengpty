# EnclaveID Development Guide

## Build, Lint, Test Commands
- Build: `bun nx run [project]:build`
- Lint: `bun nx run [project]:lint`
- Test: `bun nx run [project]:test`
- Run specific test: `bun nx run [project]:test --testFile=path/to/test.spec.ts`
- Affected commands: `bun nx affected -t [command]`

## Python Commands
- Install dependencies: `poetry install`
- Run Python lint: `poetry run ruff check`
- Run Python tests: `poetry run pytest`

## Code Style Guidelines
- TypeScript: Use strict types, avoid `any` and `!` assertions when possible
- Python: Follow PEP 8, 88-char line length, use type hints
- Imports: Group imports by external, internal, relative; alphabetize
- Error handling: Use typed errors, prefer early returns
- Components: Follow existing patterns in similar files
- Naming: camelCase for JS/TS variables, PascalCase for components/classes
- CI runs: `bun nx affected -t lint test build`