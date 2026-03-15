# Frontend Review Rubric Guide & Output Format

## Review Perspectives (10)

Analyze the diff from each perspective and classify findings with the tags below.

### 1. Component Design `[Component]`

- **Single responsibility**: Whether a single component handles too many roles
- **Component size**: Components over 200 lines should be considered for splitting
- **Props design**: Excessive prop drilling, unnecessary props, too many props
- **Composition patterns**: Appropriate use of children, render props, compound components
- **Reusability**: Separation of domain logic and UI, generic vs specialized components
- **File structure**: Co-location of related files (component, styles, tests)

### 2. State Management `[State]`

- **State location**: Appropriate choice of local state vs global state
- **State structure**: Normalization, duplicate state, derived state
- **State synchronization**: Separation of server state and client state (TanStack Query, etc.)
- **Unnecessary state**: State that can be replaced with props or computed values
- **State updates**: Stale closure issues with async state updates
- **Context scope**: Provider wrapping too broad a scope

### 3. Hooks `[Hooks]`

- **Rules of Hooks**: Conditional calls, calls inside loops
- **Dependency arrays**: Missing/excessive dependencies in useEffect/useCallback/useMemo
- **useEffect overuse**: Effects that can be replaced with event handlers
- **Custom Hooks**: Opportunities to extract custom hooks for logic reuse
- **Cleanup**: Missing useEffect cleanup functions (subscriptions, timers, AbortController)
- **useRef misuse**: Using ref for values that affect rendering

### 4. Rendering Performance `[Perf]`

- **Unnecessary re-renders**: Need for React.memo, useMemo, useCallback
- **Expensive computations**: O(n^2) or worse operations during render
- **Virtualization**: Missing windowing/virtualization for long lists
- **Image optimization**: next/image, lazy loading, appropriate formats
- **Code splitting**: Dynamic import, React.lazy usage
- **Bundle size**: Unnecessary library imports, tree shaking

### 5. Type Safety `[TypeSafety]`

- **any usage**: Excessive use of any/unknown instead of explicit types
- **Null handling**: Missing optional chaining, non-null assertion overuse
- **Type guards**: Missing runtime type checks
- **Generics**: Reusable type definitions
- **API response types**: Type definition alignment with server responses
- **Enum vs union**: Appropriate type expression method

### 6. UX & Accessibility `[UX]`

- **Loading states**: Loading indicators for async operations
- **Error display**: User-friendly error messages, form validation feedback
- **Empty states**: UI handling when no data is available
- **Accessibility (a11y)**: ARIA attributes, keyboard navigation, color contrast
- **Responsive**: Support for various screen sizes
- **Optimistic updates**: Improving perceived user speed

### 7. Security `[Security]`

- **XSS**: dangerouslySetInnerHTML, direct rendering of user input
- **Auth tokens**: Token storage location (localStorage vs httpOnly cookie)
- **CSRF**: CSRF tokens for POST requests
- **Sensitive data**: Data that shouldn't be exposed to the client
- **Dependency security**: Vulnerable npm packages

### 8. Styling `[Style]`

- **Consistency**: Design system/token usage, hardcoded colors/sizes
- **TailwindCSS**: Utility class consistency, custom class appropriateness
- **Dark mode**: Theme switching support
- **Layout**: Appropriate use of flexbox/grid
- **Animation**: Excessive animations, prefers-reduced-motion support

### 9. Data Fetching `[DataFetching]`

- **Caching strategy**: Appropriate staleTime, cacheTime settings
- **Error/loading handling**: isLoading, isError, error state handling
- **Request optimization**: Unnecessary refetch, duplicate requests
- **Optimistic updates**: Cache invalidation strategy after mutations
- **Infinite scroll/pagination**: Correct implementation patterns
- **AbortController**: Request cancellation on component unmount

### 10. Testing `[Testing]`

- **Test coverage**: Tests for key user interactions
- **Testing Library patterns**: Avoiding implementation detail testing, testing user behavior
- **Async tests**: Appropriate use of waitFor, findBy
- **Mocking**: API mocking, timer mocking appropriateness
- **Snapshot tests**: Excessive snapshot test overuse
- **E2E tests**: Coverage of critical user flows

---

## Classification Criteria

### "Must-fix before merge" (Must-fix)

Meets one of the following:
- React Hooks rule violations (causes runtime errors)
- XSS or other security vulnerabilities
- Critical rendering bugs (infinite loops, crashes)
- Potential runtime errors from type errors
- Breaking changes (existing component API changes)

### "Suggested improvements" (Nice-to-have)

Meets one of the following:
- Rendering performance improvement opportunities
- Accessibility improvements
- Code structure/readability improvements
- Test coverage enhancements
- UX improvement opportunities

## Verdict Criteria

| Verdict | Condition |
|---------|-----------|
| **APPROVED** | No "must-fix" items |
| **APPROVED with suggestions** | No "must-fix" items, but "suggested improvements" exist |
| **CHANGES REQUESTED** | 1 or more "must-fix" items |

---

## Output Format

```markdown
## PR #{id} Frontend Code Review: {title}

**Repo**: {workspace}/{repo}
**Branch**: {source} → {target}
**Author**: {author}
**Date**: {date}
**Domain**: Frontend

---

### Change Summary

{2-3 sentence summary of what this PR does}

---

### Must-fix Before Merge

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Hooks] | `EditModal.tsx:30` | Description |
| 2 | [Security] | `UserProfile.tsx:45` | Description |

{Detailed explanation and fix suggestion for each item}

---

### Suggested Improvements

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Perf] | `Dashboard.tsx:88` | Description |
| 2 | [Component] | `DataTable/` | Description |

{Detailed explanation and fix suggestion for each item}

---

### Well Done

- {Commendable implementation decisions or code quality}
- {Good component design or UX considerations}

---

### Final Verdict

**APPROVED / APPROVED with suggestions / CHANGES REQUESTED**

{1-2 sentence rationale}
```

---

## Review Writing Principles

1. **User experience first**: Runtime errors, UI breakage, and accessibility issues are top-priority checks.
2. **React pattern compliance**: Focus on Hooks rules, state management patterns, and rendering optimization.
3. **Be specific**: Always include file names and line numbers.
4. **Provide evidence**: Explain why it's a problem and under what conditions it occurs.
5. **Suggest alternatives**: Don't just point out problems — suggest fixes with code examples.
6. **Stay balanced**: Mention what was done well, not just issues.
