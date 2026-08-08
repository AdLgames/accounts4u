# Reconciliation engine

Built in Phase 3 of `PLAN.md`. Pure functions only — no DB or network calls in
this directory. Every function gets fixture-based tests in `/tests`, and every
bug found in the wild becomes a new fixture.

Core function to be added here: `explainPayout(payoutId) → PayoutBreakdown`.
