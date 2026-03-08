# Development

## Bundles

| Bundle   | Global       | Size    | Contents                             |
| -------- | ------------ | ------- | ------------------------------------ |
| `editor` | `XkinEditor` | ~23 MB  | Monaco Editor + workers              |
| `tools`  | `XkinTools`  | ~5.4 MB | Babel + Terser + Prettier + Showdown |
| `styles` | `XkinStyles` | ~4.4 MB | SASS + CSSO + CSS Modules            |
| `engine` | `XkinEngine` | ~50 KB  | Preact + preact-render-to-string     |
| `main`   | `Xkin`       | ~23 KB  | Unified API + Nanostores             |

## Build from Source

```bash
pnpm install
pnpm run build            # all bundles (sequential)
pnpm run build:editor     # monaco only
pnpm run build:tools      # babel + terser + prettier + showdown only
pnpm run build:styles     # sass + csso + css modules only
pnpm run build:engine     # preact only
pnpm run build:main       # unified Xkin API only
```

## Tests

```bash
pnpm run test
```
