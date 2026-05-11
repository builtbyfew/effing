# create-effing

**This is a placeholder package.** It exists so the unscoped `create-effing`
name on npm cannot be hijacked by a third party to attack users who typo
the official command.

## You probably want this instead

```bash
npm create @effing my-app
pnpm create @effing my-app
yarn create @effing my-app
```

These resolve to [`@effing/create`](https://www.npmjs.com/package/@effing/create),
the real Effing project scaffolder.

If you accidentally ran `npm create effing` (without the `@`), this package
will print the correct command and exit with a non-zero status. It never
downloads, executes, or generates anything on your machine.

## Why this exists

`npm create <name>` resolves to the unscoped package `create-<name>`, while
`npm create @scope` resolves to `@scope/create`. Those are different packages
on the registry. Publishing a benign placeholder on the unscoped name closes
a typosquatting hole that could otherwise be used to run arbitrary code
during scaffolding.

See [`@effing/create`](../create) for the actual scaffolder source.
