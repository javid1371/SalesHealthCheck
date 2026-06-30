# ADR 0015 — Adopt Report Content Library v1 (DomainBundle)

## Status

Accepted

## Date

2026-06-30

## Context

ADR 0010 separated diagnosis from report narration; ADR 0013 introduced Report Engine v1 (Composer → `ReportSpec` → Renderer). The current content path (`CSV → question-analysis-config → content-library.ts → report.composer.ts`) covers domain headlines, score-band text, and CTA templates, but not the richer per-domain bundle from product: level interpretations, triggered root causes, answer reflections, quick-win actions, and locked teasers.

That content was authored in Notion (**Report Content Library — Domain Bundles**, 16 rows). Agents and CI must not depend on live Notion access. A workspace snapshot in `docs/specs/report-content-library-v1/` (overview, implementation guide, `domain-bundles.v1.json`) is the canonical in-repo source.

This ADR records adoption of **DomainBundle** as an incremental layer **on top of** the existing pipeline — not a replacement. New `ReportSpec` fields remain optional so legacy report output keeps working during migration.

**Documentation gap:** ADR 0013 references `docs/specs/report-engine-v1-spec.md`, which is not yet present in the repository. That spec should be restored or rewritten separately; this ADR does not block Report Content Library v1 work.

## Decision

1. **Adopt DomainBundle v1** as the structured content contract between Diagnosis Engine output and Report Engine composition. Types live in `src/config/model-v1/report-content/domain-bundle.types.ts`; the deterministic seed is `src/config/model-v1/report-content/report-content-library.v1.ts` (`REPORT_CONTENT_LIBRARY_V1`, 16 bundles), normalized from `docs/specs/report-content-library-v1/domain-bundles.v1.json` and merged with `questionsV1` / existing option interpretations for question text, option labels, and `public_reflection` where Notion data is incomplete (D05–D16).
2. **Crosswalk by `domain_number`**, not free-form strings: Notion `domain_number` maps to project domain slug via `displayOrder` in `src/config/model-v1/domains.ts`. Explicit slug overrides apply where Notion `engine_id` differs (e.g. `offer_pricing` → `offer-design`, `lead_response_capture` → `speed-to-lead`).
3. **Resolvers in `src/modules/report/content-library.ts`** expose `getDomainBundle`, `getDomainLevel`, `getSelectedAnswerOption`, and `getTriggeredRootCauses` (simple rule evaluation such as `score <= 1` from `question_root_rules`). Missing fields use `field-fallbacks.ts` and existing `logMissingContent`.
4. **Composer changes are incremental.** Optional fields on `DomainBreakdownEntry` in `src/types/report-spec.ts`: `rootCauses?`, `levelHeadline?`, `lockedActionTeaser?`, `quickWinAction?`. `buildDomainBreakdown` in `report.composer.ts` fills them from bundles when present; UI blocks render them only when defined.
5. **Report Engine must not compute diagnostic decisions** (bottlenecks, re-score, invent root causes — ADR 0010). Bundles narrate what diagnosis and answers imply. **Exception (ADR 0016):** Diagnosis Engine v2 `selectQuickWin` was aligned to the priority set so `quickWin` matches report narrative; see `docs/adr/0016-report-coherence-v1.md`.
6. **Freemium disclosure rule:** only the domain identified as `quickWin` in `StructuredDiagnosis` may expose `full_action` / quick-win content. All other domains show `locked_teaser` only — never the full corrective action in the free report.
7. **Public vs internal fields:**
   - `public_*` — allowed in user-facing report output.
   - `locked_*` — teaser only, not full treatment.
   - `internal_*` (e.g. `internal_diagnosis_summary_fa`, `rendering_rules_fa`) — engine, QA, and expert use only; must never leak into `ReportSpec` or UI.

## Options Considered

1. Replace `question-analysis-config` and CSV-derived content entirely with DomainBundle — rejected (breaks existing reports and duplicates stable question/score data).
2. Keep Notion as runtime source of truth — rejected (no Notion in production; agents need offline context).
3. Incremental DomainBundle layer + workspace snapshot + optional `ReportSpec` fields — **accepted**.
4. Let Composer infer root causes from scores without bundle rules — rejected (conflicts with ADR 0010 and product-authored copy).

## Consequences

### Positive

- Rich, product-authored copy is versioned in-repo and deterministic.
- Existing report path continues to work; new fields appear only when seed and composer populate them.
- Clear freemium boundary: diagnosis free, full actions gated to quick-win domain.
- Internal editorial fields stay out of user-visible output by contract.

### Negative / Tradeoffs

- Two content sources briefly coexist (legacy analysis config + DomainBundle); resolvers must prefer bundle fields when present and fall back gracefully.
- Regenerate the TypeScript seed after snapshot changes with `npm run sync:report-content` (`scripts/sync-report-content.ts`; supports `--check` for CI).
- `report-engine-v1-spec.md` remains missing until a follow-up docs task (see TODO below).

## Implementation Notes

- Canonical docs: `docs/specs/report-content-library-v1/overview.md`, `cursor-implementation-guide.md`, `domain-bundles.v1.json`.
- D01–D04 bundle bodies are stored in the JSON snapshot (Notion properties empty); D05–D16 use properties plus merge from `questionsV1`.
- Tests under `src/tests/report/` must assert: no internal field leakage, correct root-cause triggering on weak answers, freemium action disclosure, determinism, and no re-scoring in composer.
- Optional follow-up: script to regenerate seed from `domain-bundles.v1.json` — implemented as `scripts/sync-report-content.ts` (`npm run sync:report-content`).

## TODO

- **Restore or author `docs/specs/report-engine-v1-spec.md`**, referenced by ADR 0013 but absent from the repository. Until then, treat ADR 0013 + implemented modules in `src/modules/report/` as the living contract for Report Engine v1 behavior.

## Related Documents

- docs/specs/report-content-library-v1/overview.md
- docs/specs/report-content-library-v1/cursor-implementation-guide.md
- docs/specs/report-content-library-v1/domain-bundles.v1.json
- docs/adr/0010-separate-diagnosis-from-report-engine.md
- docs/adr/0013-report-engine-v1.md
- docs/adr/0016-report-coherence-v1.md
- docs/specs/diagnosis-engine-v2-spec.md
