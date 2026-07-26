# Production launch checklist

- [ ] All required test gates green
- [ ] RLS + storage isolation re-verified on production project
- [ ] Mock/live labels reviewed in Flights/Hotels/Services/AI
- [ ] No supplier secrets in `VITE_*`
- [ ] Admin allowlist / `app_role` configured for operators only
- [ ] Privacy/terms pages replaced (placeholders today)
- [ ] Support escalation path defined
- [ ] Live provider activation runbook acknowledged
- [ ] Account deletion hard-delete server function ready (or documented support process)
- [ ] Monitoring / error reporting destination chosen
