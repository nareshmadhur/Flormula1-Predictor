# SPR-004 Brand And Trust Readiness

## Goal

Prepare the product for public use on `flormula1.nl` with trust pages, disclaimers, contact paths, and launch-readiness documentation.

## Status

In progress.

## Increment Links

- [C0 Brand and trust readiness](</Users/nareshmadhur/Tech Projects/Flormula1-Predictor/docs/roadmap/increments/C0-001-brand-and-trust-readiness.md>)

## User Journey

- Visitor lands on the product and can verify that it is independent and unofficial.
- Visitor can find privacy, terms, contact, and about links from every page.
- Organizer has enough trust context to consider starting a group.

## Commercial Intent

Trust.

This sprint does not directly monetize the product, but it is a paid-launch gate.

## Components To Build / Test

- public footer with disclaimer
- `/privacy`
- `/terms`
- `/contact`
- sitemap coverage
- domain/metadata checklist for `flormula1.nl`

## Test Plan

- Verify footer links render on public and signed-in pages.
- Verify `/privacy`, `/terms`, and `/contact` render on desktop and mobile.
- Verify sitemap includes trust pages.
- Verify disclaimer is visible without requiring login.
- Verify no official affiliation is implied in copy.
