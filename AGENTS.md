<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- App-owned header branding and the favicon share `public/favicon.svg` so the same workflow/check mark stays consistent across pages and browser tabs.
- Product scope is a simulator using only BFS, UCS and A* (`src/lib/algorithms/search.ts`); every trace event shown in the UI comes from these runs — never canned/hardcoded results.
- Scenarios are graph data (nodes + weighted edges + start/goal) in `src/lib/scenarios.ts`; custom workflows, active scenario and run history persist in localStorage via `src/lib/store.ts`.
- Simulator playback replays the recorded trace; speed only affects pacing.
- `src/test/search.test.ts` checks optimality against brute force; run it after changing search or scenario data.
