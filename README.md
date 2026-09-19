# Animation events · V3

Interaktiv presentationscanvas för arbetssättet efter beslutsrundan mellan
Jakob, Emil och Kevin.

V3 utgår från Kevins befintliga Croupier-motor, RNG och events. Den beskriver
hur Jakob kan arbeta med backend och logik ovanpå den grunden, hur Emil arbetar
med video nära Kevin och hur Kevin fattar beslut vid tydliga etapper.

## Källor med olika ansvar

| Yta | Ansvar |
| --- | --- |
| GitLab `scout-gg/croupier` | Runtimekälla för kod, motor, kort, shoe, wallet, events och media. |
| GitLab-wikin | Gemensamma beslut, workflow och handoff. |
| GitHub `Jakeminator123/animation-events-v1` | Källrepo för den interaktiva canvasen och dess publika presentationsversion. |
| Vercel | Renderad publicering av den granskade GitHub-versionen. |

GitHub-canvasen förklarar systemet men skapar inga spelregler. Vid konflikt om
runtime vinner alltid verifierad Croupier-kod på angiven revision.

## Öppna och bygga

- Öppna `index.html` direkt i en webbläsare. Den innehåller alla sju sidor,
  navigation, avsnittsflikar, sökning och inga externa beroenden.
- Bygg om den genererade filen med `node build-static.mjs`.
- Verifiera att den är reproducerbar med `node build-static.mjs --check`.

`index.html` genereras från Markdown-filerna och ska inte handredigeras.

## Sidor

| Fil | Fokus |
| --- | --- |
| [s00-helheten.md](s00-helheten.md) | Beslutad helhet, roller och dokumentationsytor. |
| [s01-kartan.md](s01-kartan.md) | Kevins runtime som grund och arbetsytorna runt den. |
| [s02-spraket.md](s02-spraket.md) | Verifierade runtimeord kontra gemensamma ord och förslag. |
| [s03-motorn.md](s03-motorn.md) | Föreslaget eventträd ovanpå Kevins motor. |
| [s04-openclaw.md](s04-openclaw.md) | Säker presentation; OpenClaw är ett möjligt senare förslag. |
| [s05-ordlista.md](s05-ordlista.md) | Gemensam ordlista med status och ägarskap. |
| [s06-plan.md](s06-plan.md) | Föreslagna etapper utan kalenderlöfte. |

Teknisk revisionsverifiering och beslutslogg finns nära runtimekoden i
[`docs/animation-events/v3-9-days-mvp`](https://gitlab.com/scout-gg/croupier/-/tree/jakeminator123/work/docs/animation-events/v3-9-days-mvp).
Katalognamnet är historiskt och innebär varken nio kalenderdagar eller ett
beslutat MVP-omfång.

## Statusgräns

- Roller, Kevins motor som grund, Kevin–Emil-videoflödet, den tunna
  Jakob–Emil-kopplingen och etappvisa Kevin-samtal är mötesbeslut.
- Den exakta formen på eventträdet, en niostegsindelning och OpenClaw är
  arbetsförslag tills rätt ägare uttryckligen har godkänt dem.
- V2 är tills vidare bevarad i den nu publicerade versionen på GitHub `main`
  och i GitLab-wikins V2-arkiv. V3-arbetet förutsätter ingen remote-tagg och
  ska inte skriva om arkivet.

Inga dokument eller diagram ändrar Kevins branch, agentregler eller runtime
automatiskt.
