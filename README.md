# Animation events · V3

[Öppna webbcanvasen](https://animation-events-v1.vercel.app/) · [Gemensam wiki](https://gitlab.com/scout-gg/croupier/-/wikis/home) · [Teamets inbox](https://gitlab.com/scout-gg/croupier/-/wikis/agent-inbox) · [V2-arkiv](https://animation-events-v1.vercel.app/archive/v2/)

Samma sjusidiga canvas som tidigare, uppdaterad efter beslutsrundan mellan
Kevin, Jakob och Emil. Kevin leder och äger Croupier-motorn. Jakob arbetar med
backend, logik och etappvisa underlag till Kevin. Emil arbetar nära Kevin med
video; kopplingen till Jakob är tunn och går via tydliga artefakter.

**Namnet `animation-events-v1` är en historisk repo-adress, inte aktuell
version. Innehållet på `main` och den vanliga Vercel-adressen är V3.**
GitHub visar källfiler; Vercel visar den körbara webbcanvasen. GitLab-wikins
HTML-filer är nedladdningsbara kopior och kan visas som kod i webbläsaren.

## En sakmodell, flera läsvyer

| Yta | Ansvar |
| --- | --- |
| [Croupier på GitLab](https://gitlab.com/scout-gg/croupier/-/tree/jakeminator123/work) | Motor, RNG, kort, shoe, wallet, events och media. V3:s sakunderlag redigeras i `docs/animation-events/v3-9-days-mvp/`. |
| [GitLab-wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home) | Gemensam läsyta, beslut, workflow, handoff och namngivna agenter. |
| Detta GitHub-repo | Synkade V3-texter och källkod till webbcanvasens presentation. |
| [Vercel](https://animation-events-v1.vercel.app/) | Den publicerade webbcanvasen, byggd från GitHub. |
| Jira CAC | Aktiv arbets- och QA-status; dokumentens statusord ersätter inte Jira. |

GitHub/Vercel är inte en andra spelmotor. Sakändringar görs i Croupier och
speglas hit med synkverktyget; presentationsändringar görs här. Ändra inte
kopior åt olika håll utan att föra tillbaka ändringen till sakunderlaget.

## Läs V3

| Sida | Fokus |
| --- | --- |
| [s00 · Helheten](s00-helheten.md) | Roller, beslut och ansvar. |
| [s01 · Kartan](s01-kartan.md) | Verifierade kodvägar och föreslagna kopplingar. |
| [s02 · Språket](s02-spraket.md) | Runtimeord och det gemensamma eventspråket. |
| [s03 · Eventträdet](s03-motorn.md) | Kevins språkbesked, föreslaget träd och adapter. |
| [s04 · Säker presentation](s04-openclaw.md) | Guardrails, statuskontroll och fallback. |
| [s05 · Ordlistan](s05-ordlista.md) | Ett ord, en betydelse och tydligt ägarskap. |
| [s06 · Etapper](s06-plan.md) | Avgränsade steg med Kevin-avstämningar. |

[Beslutslogg](docs/DECISIONS.md) · [Tekniskt kvitto](docs/RUNTIME-EVIDENCE.md) ·
[Publiceringsflöde](docs/CANVAS.md) · [Fullständigt V3-underlag](docs/README.md)

Katalognamnet `v3-9-days-mvp` och filnamnen `s03-motorn`/`s04-openclaw`
är historiska. De innebär inte ett nio-dagarslöfte, en ny motor eller att
OpenClaw är beslutad produktarkitektur.

## Synka och kontrollera

Kräver Node.js 22 eller senare, inga installerade paket.

```sh
node tools/sync-docs.mjs --croupier /path/to/croupier --wiki /path/to/croupier-wiki --write
node build-static.mjs
node tools/sync-docs.mjs --croupier /path/to/croupier --wiki /path/to/croupier-wiki --write
node tools/sync-docs.mjs --croupier /path/to/croupier --wiki /path/to/croupier-wiki
node --test test/*.test.mjs
node build-static.mjs --check
```

Första steget importerar Markdown. Det andra bygger HTML. Det tredje speglar
den färdiga HTML-filen och registrerar filhashar i `docs/sync-manifest.json`.
Utan `--write` kontrolleras bara innehållet. Utan källvägar kan
`node tools/sync-docs.mjs` verifiera GitHub-kopian offline.

Verktyget gör inga commits eller pushar. Publicera den granskade ändringen i
Croupier, GitHub och wiki i samma leverans. GitHub Actions och Vercel-bygget
stoppar en inaktuell HTML-fil eller en bruten lokal synkmanifestkontroll.
De kontrollerna påstår **inte** att GitLab har hämtats eller pushats automatiskt.
Kör kontrollen med `--croupier` och `--wiki` för att verifiera alla tre kloner.

## Publicering och historik

- GitHub `main` är V3:s publiceringsbranch. Vercel bygger produktion därifrån.
- `v3-9-days-mvp` ger en separat förhandsvisning, som kan kräva Vercel-inloggning.
- Endast `public/` distribueras: V3 samt den oförändrade V2-HTML-filen under
  `archive/v2/`. `node tools/build-site.mjs` skapar den katalogen.
- V2 är bevarad från commit `871bd7c` i [arkivet](archive/v2/README.md),
  Git-taggen `archive-v2` och GitLab-wikins tidigare V2-arkiv.
- Ladda ned `index.html` och öppna den lokalt för en offlinekopia.
- Inga dokument eller diagram ändrar Kevins branch eller spelregler.
