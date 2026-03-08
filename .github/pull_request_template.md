## What does this PR do?

<!-- Brief description -->

## Type of change

- [ ] Bug fix
- [ ] New feature / module
- [ ] Breaking change
- [ ] Docs / config only

## Checklist

- [ ] `bun test` passes (120+ tests, 0 failures)
- [ ] `bunx biome check .` passes with 0 errors
- [ ] New routes have Zod validation
- [ ] New modules have tests in `tests/apps/<name>.test.ts`
- [ ] Docker build succeeds locally (`docker build -f .devcontainer/Dockerfile .`)
- [ ] Web UI builds if UI was changed (`cd src/web && bun run build`)
