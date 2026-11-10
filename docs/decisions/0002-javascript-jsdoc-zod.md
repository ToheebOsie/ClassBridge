# 0002 JavaScript with JSDoc and Zod (not TypeScript)

**Date:** 2026-11-03 · **Status:** accepted

**Decision.** Write plain JavaScript. Add safety with (1) Zod schemas that validate data at runtime and are shared by API and apps, (2) JSDoc comments on shared code, checked by the editor (`checkJs` in `jsconfig.json`), (3) ESLint, and (4) tests for rules that must not break.

**Why.** The team knows JavaScript, and code people cannot read confidently is harder to maintain than code without types. Zod and JSDoc give most of the protection.

**Gave up.** Compile-time checking of every file. Some wrong-shape mistakes show up in tests or at runtime.

**Way out.** Files can be renamed to `.ts` one at a time later. JSDoc and Zod already describe the data.
