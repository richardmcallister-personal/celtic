# Celtic: where things stand (6 Nov 2026)

Read CLAUDE.md first.

## Done
11 Nov: tapping a shirt on /kits/ shows its season: league finish, manager(s), top scorer, trophies, record, and one defining result.
7 Nov: moved to the manutd.wiki design (via irelandfootball's port): new hub (next match, form and table tiles, coming up, team news, last five, on this day, honours, Explore Celtic, hideable alerts), Add to calendar menu, dark footer with sister sites, squad tabs (Squad / Availability / Pick your XI), timeline page.
Live on celtic.richardmcallister.app, noindex.
Pages: hub, season, squad, match centre, results, seasons, players, player, opponents, opponent (Rangers is the Old Firm page), records, managers, manager, honours, kits with shirt collection, search. Dark mode, phone tab bar, iPhone launch images, match alerts, calendar.
Archive: competitive games 1888-2026 from 139 Wikipedia season articles. Checks in tools/data/reconcile.txt.

## Needs Richard
- `API_FOOTBALL_KEY` as a Worker secret. Until then live sections say the feed is not connected. Tested only with mocked standings and squad.
- A club domain (recommended: celticfc.wiki) if wanted: add it to `routes` in wrangler.jsonc and update the origin in calendar() and calFeed(). For now it lives at celtic.richardmcallister.app (8 Nov).
- Crests for older opponents: the pack has the 20 current ones.
- Rights: kit images, crests and logos are not cleared. Recheck before removing noindex.
- Trips: does he have a Celtic ticket account?

## Known gaps
- Scorers before 2000 are sparse on Wikipedia. Appearances exist only for players on Wikipedia's list (100 apps or more, or notable).
- Season articles and list articles disagree in places: see reconcile.txt (13 league seasons; manager totals by a few games).
- Not ported from manutd.wiki: Ask (needs ANTHROPIC_API_KEY), languages, milestone watch (no per-season appearance data), trips, where to watch (no official Scottish rights list sourced yet), timeline, compare, comebacks, shelf, links, analytics.
- A weekly refresh task does not exist yet, so results reach the archive only when run. The hub and season page are live from the feed.
