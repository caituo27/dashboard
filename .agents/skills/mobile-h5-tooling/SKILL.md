---
name: mobile-h5-tooling
description: 'Set up reusable mobile H5 project tooling for Vite React apps: dev-only eruda debugging, React Compiler integration, postcss-pxtorem px-to-rem conversion, root font-size adaptation, and related verification. Use when a user asks to apply local H5 conventions, add eruda, add compiler/complier, configure px2rem/rem adaptation, or port the qianxun-h5 setup to a new project.'
---

# Mobile H5 Tooling

Use this skill to transplant the local mobile H5 baseline into a Vite React project.

## Scope

Apply to H5/mobile web apps, especially Vite + React. Do not apply React Compiler or H5 px2rem choices to a Taro/weapp shell unless the user explicitly asks.

## First Read

Inspect the target project before editing:

```bash
rg -n "eruda|react-compiler|postcss-pxtorem|pxtorem|rootValue|fontSize|compiler" .
rg --files | rg "package.json|vite.config|postcss.config|index.html|main\\.(ts|tsx|js|jsx)$"
```

Check React major version, package manager, Vite config shape, PostCSS config format, and whether the app already has a debug bootstrap file.

## Dependencies

For pnpm projects:

```bash
pnpm add -D eruda postcss-pxtorem babel-plugin-react-compiler
```

For React 18 projects also add the runtime dependency:

```bash
pnpm add react-compiler-runtime
```

Use the repo's package manager if it is not pnpm. Keep existing pinned dependency style when possible.

## React Compiler

In Vite React apps using `@vitejs/plugin-react`, add the Babel plugin inside `react(...)`.

React 18:

```ts
react({
  babel: {
    plugins: [['babel-plugin-react-compiler', { target: '18' }]]
  }
})
```

React 19 or newer:

```ts
react({
  babel: {
    plugins: [['babel-plugin-react-compiler']]
  }
})
```

Guidance:

- Prefer React Compiler over adding `React.memo`, `useMemo`, and `useCallback` everywhere.
- Keep existing manual memoization unless removing it is clearly safe and verified.
- After changing compiler config, run type-check and build.

## px2rem

For a 375px design draft baseline, configure `postcss-pxtorem`:

```js
export default {
  plugins: {
    tailwindcss: {},
    'postcss-pxtorem': {
      rootValue: 37.5,
      unitPrecision: 5,
      propList: ['*'],
      minPixelValue: 2,
      exclude: /node_modules/i
    },
    autoprefixer: {}
  }
}
```

Add root font-size adaptation in `index.html` before the app script:

```html
<script>
  ;(function () {
    var maxWidth = 480
    var designParts = 10
    var docEl = document.documentElement

    function refreshRootFontSize() {
      var width = Math.min(docEl.clientWidth || window.innerWidth || 375, maxWidth)
      docEl.style.fontSize = width / designParts + 'px'
    }

    refreshRootFontSize()
    window.addEventListener('resize', refreshRootFontSize)
    window.addEventListener('pageshow', refreshRootFontSize)
  })()
</script>
```

This makes 375px viewport equal `1rem = 37.5px` and caps layout scaling at 480px.

## eruda

Load eruda only in development. Prefer an isolated bootstrap module, then import it from the app entry.

Example `src/utils/eruda.ts`:

```ts
export const initEruda = async (): Promise<void> => {
  if (import.meta.env.PROD || typeof window === 'undefined') {
    return
  }

  const { default: eruda } = await import('eruda')
  eruda.init()
}
```

Example entry usage:

```ts
void initEruda()
```

Do not bundle eruda into production intentionally.

## Verification

Run the repo's normal checks. Prefer:

```bash
pnpm type-check
pnpm build
```

For visual/mobile work, start the dev server and verify:

- eruda appears only in development.
- production build does not initialize eruda.
- px styles are emitted as rem where expected.
- 375px viewport has root font-size 37.5px; wider mobile widths scale up; widths above 480px stay capped.
