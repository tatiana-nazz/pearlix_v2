# Pearlix demo and QA data workflows

## Canonical demo workflow

The only authoritative product-demo workflow is:

```powershell
python manage.py seed_demo --settings=config.settings.local
python manage.py populate_demo_analytics_realistic --settings=config.settings.local
python manage.py finalize_demo_seed --settings=config.settings.local
```

Run the three commands in that order. `finalize_demo_seed` is the release
gate for chronology, clinic operating days, visit/billing consistency,
schedule overlap, and the prohibition on fabricated AI results. All demo
commands retain the production/live-database guards.

## Command classification

| Command | Classification | Supported use |
| --- | --- | --- |
| `seed_demo` | CANONICAL | Creates the coherent base demo clinic. |
| `populate_demo_analytics_realistic` | CANONICAL | Adds realistic, operating-week-aware analytics history. |
| `finalize_demo_seed` | CANONICAL | Normalizes and validates the complete demo. |
| `seed_dev_qa_users` | DEV/QA UTILITY | Creates local disposable role accounts only; it is not a demo-data workflow. |
| `seed_demo_clinic_story` | LEGACY/DEPRECATED | Historical Phase 14A regression fixture. Do not use it for release demos. |
| `populate_demo_analytics` | LEGACY/DEPRECATED | Historical deterministic analytics fixture. Use the realistic command instead. |

Legacy commands remain only because their focused tests preserve migration and
historical regression evidence. They are not chained into, and must not be
presented as, the canonical demo workflow.
