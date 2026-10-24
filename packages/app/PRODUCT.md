# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Three overlapping groups, confirmed by the owner: everyday non-technical people (drop a file, get another format, leave), creative and office users (images, documents, media, sometimes batches), and power users (batches, per-file options, engine control, keyboard).

## Product Purpose

fileCon is an offline, cross-platform (Windows, macOS, Linux) desktop app that converts files by routing through mature engines (sharp, LibreOffice, FFmpeg, Blender and others). Success: a first conversion with zero configuration, no surprises about lossy routes or missing engines, originals never touched.

## Positioning

Fully offline and local, with no upload, no ads and no telemetry, while still covering many format families through one drop target and an automatic route between formats.

## Operating Context

Electron app (React and TypeScript renderer, conversion in a separate core host process). Opens as a desktop window on the OS theme and language. Work happens in short sessions, from one file to large batches. Engines may be missing, and the app says so before the user hits Convert.

## Capabilities and Constraints

Screens today: Convert (drop zone, file rows, merge groups, format popover, row options, action bar with output folder), Engines, Settings. Source of truth for behavior: docs/FLOWS.md and docs/UI-DESIGN.md. Text only through `translate()` and `locales/en.json`; colors only through theme tokens; CSS logical properties only; light, dark and follow-OS themes.

## Brand Commitments

Owner-confirmed personality: calm and quiet like a well-made utility, warm and friendly, and distinctive enough to be recognizable. It must not look like a generic SaaS dashboard, an ad-ridden online converter, a dark neon developer tool, or a stock Electron app. Accent color is open and chosen during the redesign.

## Evidence on Hand

No customer proof, testimonials or usage numbers exist, and none may be invented. Real content is the user's own files and the engine results.

## Product Principles

- The first conversion needs no setup.
- Never surprise: flag lossy routes and missing engines before Convert.
- Show every format, and mark the ones that are not possible.
- Originals are never overwritten.
- Keyboard-first, following the OS theme and language.

## Accessibility & Inclusion

Contrast targets 7:1 for primary text and 4.5:1 for other text (docs/UI-DESIGN.md section 8), keyboard operable, reduced-motion and forced-colors honored, screen-reader tested with Orca.
