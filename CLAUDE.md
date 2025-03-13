# EnclaveID Development Guide

## Build, Lint, Test Commands
- Lint: `bun nx run [project]:lint` (prefer this for checking code quality)
- Test: `bun nx run [project]:test`
- Run specific test: `bun nx run [project]:test --testFile=path/to/test.spec.ts`
- Affected commands: `bun nx affected -t [command]`

## Important Notes
- Do not run build or dev commands (they can lock ports and resources)
- Always use lint to check code quality instead of building or running the app

## Python Commands
- Install dependencies: `poetry install`
- Run Python lint: `poetry run ruff check`
- Run Python tests: `poetry run pytest`
- Python commands via nx: `bun nx run [python-project]:lint`

## Git Commit Guidelines
- Format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
- Scope: Optional component/module name in parentheses
- Do not add co-author information or external tool attribution
- Examples:
  - `feat(web): add user dashboard`
  - `fix(data): handle branching in OpenAI conversations`
  - `refactor: process zip files client-side`

## Code Style Guidelines
- TypeScript: Use strict types, avoid `any` and `!` assertions when possible
- Python: Follow PEP 8, 88-char line length, use type hints
- Imports: Group imports by external, internal, relative; alphabetize
- Error handling: Use typed errors, prefer early returns
- Components: Follow existing patterns in similar files
- Naming: camelCase for JS/TS variables, PascalCase for components/classes
- CI runs: `bun nx affected -t lint test build`
- When refactoring: Delete old files completely instead of keeping deprecated versions

## Documentation
- Architecture: `docs/architecture.md`
- Monorepo Structure: `docs/monorepo-structure.md`
- Verification: `docs/verification.md`
- Stream Chat Implementation: `docs/stream-chat.md`