# Third-Party Licenses

This project (`adcraft`) is licensed under MIT (see [LICENSE](./LICENSE)).

It depends on third-party packages, each governed by their own licenses.
Below are the notable ones.

---

## Remotion (https://www.remotion.dev)

License: **Custom dual-license (Free / Company)** — NOT a standard OSI-approved license.

Remotion uses its own license model:

- **Free License**: available for individuals, for-profit organizations
  with up to 3 employees, non-profits, and evaluators.
- **Company License**: required for for-profit organizations not eligible
  for the Free License (typically 4+ employees).

> ⚠️ **Important**: Users of this project must independently verify their
> compliance with Remotion's license terms based on their organization size.
> See https://www.remotion.dev/docs/license for the official terms.

This project does **NOT** redistribute Remotion source code. Remotion is
declared as an npm dependency in `package.json` and installed by users
during `pnpm install` (or `npm install`). The `remotion/` directory in
this repository contains only configuration files and custom video
components written for this project — no Remotion source.

---

## React (https://react.dev)

License: MIT
Copyright (c) Meta Platforms, Inc. and affiliates.

---

## TypeScript (https://www.typescriptlang.org)

License: Apache-2.0
Copyright (c) Microsoft Corporation.

---

## yaml (https://eemeli.org/yaml/)

License: ISC
Copyright (c) Eemeli Aro.

---

## Other dependencies

For a complete list of dependencies and their licenses, run:

```bash
pnpm dlx license-checker --summary
```

Most dependencies use MIT or Apache-2.0 licenses, which require only that
copyright notices be preserved. **The notable exception is Remotion**
(see above) — this is the most important license to be aware of.
