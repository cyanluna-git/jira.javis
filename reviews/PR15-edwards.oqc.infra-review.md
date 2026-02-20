## PR #15 Code Review: Removing unnecessary files from repo for now

**Repo**: ac-avi/edwards.oqc.infra
**Branch**: feature/TestSetImplementation → main
**Author**: Bipin Mishra
**Date**: 2026-02-17

---

### Change Summary

The PR title says "Removing unnecessary files" but actually contains **4 independent changes** across 5 commits:
1. Mass deletion of Copilot-generated placeholder/mock components and config files
2. Profile photo loading via Microsoft Graph API
3. Self-role-change prevention logic (backend + frontend)
4. UserManagement UI improvements (custom Select component, debounced search)

---

### Must-fix before merge

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Breaking] | `RoleDashboard.tsx:54` | TESTER role dashboard is commented out |
| 2 | [Breaking] | `dashboards/index.ts:4` | TesterDashboard export is commented out |
| 3 | [Bug] | `AuthContext.tsx:385-387` | Potential stale closure on profilePhotoUrl in logout |
| 4 | [Design] | Entire PR | PR scope does not match title — 4 independent features mixed |

**#1, #2 — TESTER role users lose dashboard access (Breaking Change)**

The `UserRole.TESTER` case in `RoleDashboard.tsx` is commented out, and the export in `dashboards/index.ts` is also commented out. TESTER users will see a fallback "No dashboard available" UI on login.

```tsx
// case UserRole.TESTER:
//   return <TesterDashboard />;
```

If intentional, remove the commented code entirely and provide a proper message for TESTER users. If temporary, add a comment explaining why and when it will be restored.

**#3 — Stale closure risk in logout**

```tsx
const logout = useCallback(() => {
  if (profilePhotoUrl) {
    URL.revokeObjectURL(profilePhotoUrl);
  }
  // ...
}, [instance, profilePhotoUrl]);
```

Including `profilePhotoUrl` in the dependency array causes `logout` to be recreated whenever the photo URL changes. This works correctly but causes unnecessary re-renders if `logout` is passed as a prop. Consider using a `useRef` to hold the URL instead:

```tsx
const photoUrlRef = useRef<string | null>(null);
// In fetchProfilePhoto: photoUrlRef.current = photoUrl;
// In logout: if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
```

**#4 — PR scope mismatch**

The PR title is "Removing unnecessary files" but it also includes:
- New profile photo feature (`AuthContext.tsx`, `msalConfig.ts`)
- Self-role-change prevention business logic (`auth.py`, `users.py`, `UserManagement.tsx`)
- New UI component (`ui/select.tsx` — 353 lines)
- Dashboard routing restructure (`App.tsx`, `RoleDashboard.tsx`)

This makes it hard for reviewers to assess risk and increases the blast radius if a revert is needed. Consider splitting into separate PRs per feature in the future.

---

### Suggestions for improvement

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Security] | `db/init.sql (deleted)` | Verify DB schema init is preserved elsewhere |
| 2 | [Perf] | `ui/select.tsx:2935` | `<style>` tag injected into DOM on every render |
| 3 | [Logic] | `UserManagement.tsx` | Debounce uses overly complex setState callback pattern |
| 4 | [Design] | `FilterSelect` | onChange creates synthetic event — inconsistent with Select API |

**#1 — DB schema files deleted**

`init.sql` and `migrate_roles.sql` are deleted. If these are the only source of truth for DB setup (not managed by Alembic or similar), new environment setup becomes harder. Confirm these are truly Copilot artifacts and not operational files.

**#2 — Duplicate `<style>` tags in Select components**

Both `Select` and `FilterSelect` inject `<style>{scrollbarStyles}</style>` on every render. With 10 Select instances on a page, the same CSS is injected 10 times. Move the styles to a global CSS file or inject once at the module level.

**#3 — Debounce pattern is unnecessarily complex**

```tsx
setDebouncedSearchTerm((prev) => {
  if (prev !== searchTerm) {
    setPage(1);
  }
  return searchTerm;
});
```

Calling `setPage` inside a `setState` updater function is hard to follow. Simpler approach:

```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearchTerm(searchTerm);
    setPage(1);
  }, 400);
  return () => clearTimeout(timer);
}, [searchTerm]);
```

**#4 — FilterSelect onChange API inconsistency**

`Select` uses `onChange: (value: string) => void` but `FilterSelect` creates a synthetic event:

```tsx
const syntheticEvent = {
  target: { value: optionValue },
} as React.ChangeEvent<HTMLSelectElement>;
```

Unifying both to pass the value directly would be cleaner and avoid the fake event object.

---

### What's done well

- **Self-role-change prevention**: Defended at both backend (`auth.py`, `users.py`) and frontend (`UserManagement.tsx`) with disabled UI and warning message — solid defense-in-depth.
- **Profile photo loading**: Non-blocking fetch with graceful failure handling. Blob URL memory leak prevented via `revokeObjectURL` on logout.
- **Custom Select component**: Keyboard navigation, auto dropdown direction detection, and description support show good attention to UX and accessibility.
- **Placeholder cleanup**: Removing hardcoded mock components (Monitoring, DataManagement, etc.) reduces codebase noise.

---

### Verdict

**CHANGES REQUESTED**

The TESTER role dashboard is silently disabled via commented-out code. Confirm whether this is intentional and either remove the dead code or provide a proper fallback UI. The PR title/description should also be updated to reflect the actual scope of changes.
