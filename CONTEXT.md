# CONTEXT

Project domain glossary — the single source of truth for project-specific terms used in this repository. Read **on demand** when project terms matter (e.g. before planning questions, PRD writing, or check reviews); **never always-inject** — this file stays out of the automatic session prompt budget.

Only project-specific concepts belong here; generic programming concepts and framework terms already documented under `.cstl/` do not need entries. Each entry: term + one-line definition + `_Avoid_` aliases when a common synonym causes confusion. Language follows `artifact_locale` (en → English only; zh → Chinese terms with English gloss).

## Framework domain seed (optional)

Optional starting set — delete entries that do not apply to this project:

**Task** (_task_):
CSTL task, directory under `.cstl/tasks/`, lifecycle planning / in_progress / completed.
_Avoid_: ticket, issue

**PRD** (_product requirements document_):
Task requirements artifact: Goal / User Stories / Requirements / Acceptance Criteria / Implementation Decisions.
_Avoid_: spec sheet

**Gate** (_gate_):
Mandatory checkpoint at planning / execution / archive boundaries.
_Avoid_: — 

**Evidence** (_evidence_):
Verification evidence in `verify.md` (command output, paths, acceptance).
_Avoid_: report

**Contract** (_contract_):
Execution contract in `implement.md` (execution_mode / verification_profile / quality_gates).
_Avoid_: plan

**Child** (_child_):
Independently verifiable deliverable under a Parent task tree.
_Avoid_: sub-ticket

**artifact_locale** (_artifact locale_):
Project artifact language setting (en / zh).
_Avoid_: locale

**Task Ladder** (_task ladder_):
Triage ladder: No Task / Micro-Grill / Lite / Full / Parent.
_Avoid_: — 

## Project glossary

Add project-specific terms below (term + one-line definition + `_Avoid_` aliases):

| Term | Definition | Avoid |
| --- | --- | --- |
| 桌面歌词 (desktop lyric) | 独立的透明置顶 Electron 窗口（`src/desktopLyric/`），浮在其他应用之上显示当前一句逐字歌词。自成一个 webpack page 入口，不加载 Vuex——`store/index.js` 顶层就 `new Player()`，复用主入口会多出一个 Howler 实例。所有状态由主窗口经 ipcMain 单向推送。 | OSD 歌词、悬浮歌词 |
| lyricProvider | `src/utils/lyricProvider.js`，歌词的唯一数据源：取词、解析、译文配对、行定位。歌词页与桌面歌词都只是它的消费者。 | 歌词 store |
| 游戏模式 (game mode) | 把播放器降级成「只会放歌的内核」：界面整树替换成最小播放面板，封面预取 / 元数据落盘 / 统计脚本全部关闭。与桌面歌词完全正交。 | 省电模式、性能模式 |

## ADR

Architecture decisions live in `docs/adr/` (lazy-created). Write an ADR only when **all three** conditions hold: hard to reverse · would surprise without context · real tradeoff. See `docs/adr/README.md` for the full boundary.
