# commit-workflow.md - Git & Commit Conventions

## Branch Strategy

### Branch Types
- **main** — Production-ready, stable releases
- **develop** — Integration branch, next release
  - **feature/** — New features
  - **bugfix/** — Bug fixes
  - **refactor/** — Code refactoring
  - **sync/** — Bidirectional sync improvements

### Branch Naming
```
feature/vision-editing           # New feature
bugfix/sync-conflict-handling    # Bug fix
refactor/api-client              # Refactoring
```

## Commit Messages

### Format (Conventional Commits)
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types
- **feat**: New feature
- **fix**: Bug fix
- **refactor**: Code restructuring
- **perf**: Performance improvement
- **test**: Add/update tests
- **docs**: Documentation
- **style**: Formatting (no logic change)
- **chore**: Dependencies, tooling
- **ci**: CI/CD configuration

### Scope
- **frontend**: React components, pages, hooks
- **api**: API endpoints, responses
- **sync**: Bidirectional sync logic
- **db**: Database migrations, schema
- **cli**: Python CLI commands
- **slack**: Slack integration
- **config**: Configuration files

### Examples
```
feat(frontend): add risk severity filter
  
  - Implement RiskFilter component
  - Add filter state to RiskContext
  - Update /roadmap page to use filter
  
fixes #234

fix(sync): handle concurrent jira modifications

refactor(api): consolidate error responses

docs: update bidirectional sync guide
```

### Subject Line Rules
- **Imperative mood**: "add", "fix", "remove" (not "added", "fixes")
- **Lowercase** first letter
- **No period** at end
- **Max 50 characters**
- **Reference issue**: In body with `Closes #123` or `Fixes #123`

## Pull Request Workflow

1. **Create**: Branch from `develop` → PR to `develop`
2. **Describe**: Add description, link issue, note testing
3. **Review**: Request code review
4. **Address**: Fix feedback and push new commits
5. **Merge**: Squash or rebase to keep history clean

### PR Template
```markdown
## Description
Brief description of changes

## Closes
#123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change

## Testing
How to test locally

## Checklist
- [ ] Tests added/updated
- [ ] Docs updated
- [ ] No console errors/warnings
```

## Release Process

1. **Version**: Increment MAJOR.MINOR.PATCH (semver)
2. **Changelog**: Update CHANGELOG.md
3. **Tag**: `git tag -a vX.Y.Z -m "Release X.Y.Z"`
4. **Release notes**: Create GitHub Release

## Important Rules

- **Never force push** to shared branches (develop, main)
- **Always pull** before pushing
- **Rebase** on develop if conflicts
- **Sign commits**: `git config user.signingkey <key>` (optional but recommended)

