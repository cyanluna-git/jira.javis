Create a new Next.js API route for $ARGUMENTS following the Javis pattern:

1. **Route handler** in `src/javis-viewer/src/app/api/{name}/route.ts`
   - Export named functions: `GET`, `POST`, `PUT`, `DELETE`
   - Include `checkReadOnly()` guard on mutation methods
   - Return `{ success: true, data: ... }` format
   - Handle errors with proper status codes and error codes

2. **Query functions** in `src/javis-viewer/src/lib/queries/{name}.ts`
   - Extract all SQL to query functions
   - Use `getPool()` from `lib/db.ts`
   - Parameterized queries only (`$1`, `$2` — never string interpolation)
   - Return typed results

3. **Types** in `src/javis-viewer/src/types/{name}.ts`
   - Request body interface
   - Response data interface
   - Export from types/index.ts

4. **Frontend hook** in `src/javis-viewer/src/components/` or `src/javis-viewer/src/lib/`
   - Fetch function calling the new route
   - Loading and error state handling

Reference: `src/javis-viewer/src/app/api/roadmap/visions/route.ts`
