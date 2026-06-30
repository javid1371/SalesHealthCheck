# ADR 0016 — Report Coherence v1 (Aligned Narrative + Bundle-First Copy)

## Status

Accepted

## Date

2026-06-30

## Context

After ADR 0015 adopted DomainBundle as an incremental content layer, the live report still mixed **legacy CSV copy** (`question-analysis-config`) with **new bundle fields** (`levelHeadline`, `rootCauses`, etc.). Manual QA surfaced four UX coherence problems:

1. **Quick Win unrelated to priorities** — `selectQuickWin` picked among all `Q=3` domains globally (e.g. closing) while `primary_issue` was lead-generation.
2. **Duplicate priority cards** — `binding_constraint` and `primary_issue` could share the same `engineId`, producing four cards with a “۳ اولویت” title.
3. **Internal language in user-facing blocks** — `diagnosticSymptoms` CSV paragraphs (“عارضهٔ … ضعف یعنی …”) appeared in Issues and Domain cards while Notion bundles already had public bullets and `public_summary_fa`.
4. **Duplicate evidence** — legacy “شواهد از پاسخ‌های شما” and bundle root-cause evidence both rendered for the same questions.

ADR 0010 still requires the Report Engine to narrate diagnosis, not invent it. ADR 0015 allowed two content sources with bundle preference when present. This ADR records the **coherence pass** that aligns diagnosis selection, composer output, and UI rendering.

## Decision

1. **Align `quickWin` with priority set in Diagnosis Engine v2.** `selectQuickWin` in `src/modules/diagnosis/v2/layers/outputs.ts` chooses the highest `gap × Q` among unique `{primaryIssue, structuralRoots[0..1], bindingConstraint}` on eligible domains. If that set is empty, **fallback** to the prior rule (`raw ≤ 9` and `Q = 3`). Documented in `docs/specs/diagnosis-engine-v2-spec.md`.
2. **Deduplicate issue cards in Composer.** `buildIssues` in `report.composer.ts` skips duplicate `engineId`s (first role wins: primary → structural roots → binding). UI title is **«مهم‌ترین اولویت‌ها»**, not a fixed count. CTA personalization still resolves `bindingConstraint` from `StructuredDiagnosis` when the binding card is deduped.
3. **Bundle-first public copy in Composer.**
   - Domain cards: optional `symptomsList?: string[]` from `bundle.symptoms` (bullets in UI).
   - Issue cards: `mechanism` from `public_summary_fa` when present; fallback to `resolveDiagnosticSymptoms` (CSV).
   - Legacy CSV strings (`symptoms`, `interpretation`, `qualitativeCost`) remain on `ReportSpec` for backward compatibility until a later migration.
4. **UI dedupe for evidence.** `DomainAnatomy` hides the legacy evidence section when `rootCauses.length > 0`; root-cause cards carry evidence. Legacy evidence remains when no root causes trigger.
5. **Scope boundary.** Report Engine still does not re-score, re-prioritize, or invent root causes. The only Diagnosis Engine change is `quickWin` selection logic (ADR 0015 item “Diagnosis unchanged” is **narrowed** — see Related Documents).

## Options Considered

1. **Report-layer only** — override `quickWin` or add narrative bridge in Composer without touching Diagnosis — rejected (user chose diagnosis-level alignment; Report would still contradict stored `StructuredDiagnosis` for expert view and replays).
2. **Replace all CSV copy immediately with bundles** — rejected (incremental; some bundle fields still incomplete for D05–D16; CSV fallback required).
3. **Priority-aligned quickWin + bundle-first copy + issue/evidence dedupe** — **accepted**.

## Consequences

### Positive

- Quick Win, priority cards, and CTA tell one story.
- User-facing text uses Notion public copy where available.
- Less repetition in domain cards.
- Deterministic behavior covered by contract and snapshot tests.

### Negative / Tradeoffs

- Stored reports generated before this change do not auto-update; users need a new assessment/finish to see the new narrative.
- Two content sources remain for `interpretation` / `qualitativeCost` (CSV) until a follow-up migration.
- `full_action_fa` is often empty for D05–D16 in Notion; Quick Win may show summary only (content gap, not engine bug).

## Implementation Notes

- Diagnosis: `src/modules/diagnosis/v2/layers/outputs.ts` — `selectQuickWin`.
- Composer: `src/modules/report/report.composer.ts` — `buildIssues`, `resolveIssueMechanism`, `enrichDomainBreakdownFromBundle` (`symptomsList`).
- Resolvers: `getDomainSymptoms`, `getDomainPublicSummary` in `src/modules/report/content-library.ts`.
- UI: `IssuesSection.tsx`, `DomainAnatomy.tsx`.
- Types: `symptomsList?` on `DomainBreakdownEntry` in `src/types/report-spec.ts`.
- Tests: `src/tests/report/report.composer.contract.test.ts`, snapshot in `report.composer.snapshot.test.ts`; diagnosis example still expects `quickWin=7`.

## Related Documents

- docs/specs/diagnosis-engine-v2-spec.md (quick-win rule)
- docs/specs/report-content-library-v1/overview.md (bundle field usage)
- docs/adr/0010-separate-diagnosis-from-report-engine.md
- docs/adr/0013-report-engine-v1.md
- docs/adr/0015-adopt-report-content-library-v1.md
