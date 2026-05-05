# Changelog

All notable changes to adcraft will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-05

### Added

- Initial public release as a Claude Code plugin (`adcraft`).
- Two skills:
  - `adcraft:extract-product-ui` — extract presentational UI components
    from a real product repo (Next.js / React / Vite).
  - `adcraft:create-advertisement` — generate, visually verify, and
    self-correct short-form ad videos with Remotion.
- Slash commands: `/adcraft:extract-product-ui`,
  `/adcraft:create-advertisement` (thin wrappers over the skills).
- Immutable rules at `rules/create-advertisement-rules.md` (v1.0.0)
  with 12 rules covering: 20-30s reels, mandatory product UI scene,
  >=2 active effects, iPhone frame for 9:16, 5 explainable variations,
  pre-flight WebSearch, 3-iteration visual fix loop, atomic manifest
  write, "no distribution" boundary.
- Shared Remotion building blocks: `IPhoneFrame`, `TextOverlay`,
  `ZoomIn` / `Fade` / `ClickRipple` / `ScrollSim`.
- Sample product `examples/product-sample` (TaskFlow): two screens
  (SampleDashboard, SampleTaskList) plus written core.md and config.yaml.
- Visual verification flow validated end-to-end with `remotion still`
  PNG output read by Claude. Both main session and subagents can read
  the output.
- README, four guides under `docs/`, plus headless invocation examples
  with `--permission-mode bypassPermissions` and `--model sonnet` for
  cost-efficient cron use.
- License: MIT for this project, Remotion Free/Company dual license
  notice in `THIRD_PARTY_LICENSES.md`.

### Notes

- This release does **not** include any distribution logic (Git push,
  SNS API posting, admin panel integration). The boundary is explicit:
  generated artifacts land in `./output/<product>/<YYYY-MM-DD>/` and
  are picked up by user-supplied scripts if desired.
- Remotion source code is **not** redistributed. It is declared as an
  npm dependency. Users install it themselves via `pnpm install`.
- Real-world validation: TaskFlow (1 reel) and a second product
  (EvoArena, 2 reels) both completed end-to-end with the visual
  verification loop self-correcting once and converging.
