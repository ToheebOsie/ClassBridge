# Working agreements

1. **JavaScript with JSDoc.** Write plain JavaScript. Put a short JSDoc comment (what goes in, what comes out) above any shared function, especially money, ID and permission logic. Editors use it to warn about wrong data.
2. **Validate at the edge.** Every API request is checked with a Zod schema from `packages/shared`. Never trust data from a browser or phone.
3. **Permissions on the server.** The API enforces who may do what. The UI hides things only for convenience.
4. **Test the rules that must not break:** student IDs, promotion rules, invoice totals and balances, and who can see what.
5. **Never edit an applied migration.** Add a new numbered file.
6. **Money is whole naira integers.**
7. **Explain the why in comments**, not the what. Anything non-obvious about school rules gets a comment and a line in the docs.
8. **Same change, same docs.** Update the data dictionary, architecture note, design system page or changelog in the same change as the code.
9. **Run `npm run check` before sharing changes.**
