# Home dashboard timeout hotfix

On 2026-09-29 the signed-in Home screen could remain on “Building your day…” because `get_today_dashboard` was repeatedly hitting the PostgREST statement timeout.

Production logs showed HTTP 500/504 responses with PostgreSQL error `57014` (`canceling statement due to statement timeout`). The expensive path was the Home RPC joining the full `training_session_fuel_plan_multisport` view.

The production hotfix replaces that dependency with a lightweight next-session fuel calculation, keeps recent metrics on `training_rolling_summary`, and leaves the full Training/Fuel engines unchanged.

The hotfixed RPC was benchmarked against the affected signed-in account at about 170 ms execution time instead of timing out.
