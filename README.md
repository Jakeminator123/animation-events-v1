# Croupier · Presentationsplan

**Aktuell version: V5 · åtta arbetsdagar.**

[Öppna presentationen](https://animation-events-v1.vercel.app/) ·
[Läs V5 i wikin](https://gitlab.com/scout-gg/croupier/-/wikis/animation-events/v5-8-days-mvp/README) ·
[Tekniskt underlag](docs/RUNTIME-EVIDENCE.md)

Vad hände → vad ska presenteras → vilket material passar → vad spelades faktiskt?

Sju korta kapitel förklarar produkten, labbet, signalerna och åttadagarsplanen.
Kodkontrollerade uppgifter, labbprov, förslag och ännu overifierad livekoppling
hålls isär. Dokumentationen ändrar inga spelregler eller produktionskopplingar.

## En källa, två läsvyer

Sakunderlaget redigeras i Croupiers
[`docs/animation-events/v5-8-days-mvp/`](https://gitlab.com/scout-gg/croupier/-/tree/jakeminator123/work/docs/animation-events/v5-8-days-mvp).
Detta repo innehåller samma texter och generatorn till presentationen.
GitLab-wikin är den andra läsvyn. Jira CAC håller aktuell arbets- och QA-status.

- [s00 · Helheten](s00-helheten.md)
- [s01 · Kartan](s01-kartan.md)
- [s02 · Signalerna](s02-spraket.md)
- [s03 · Eventträdet](s03-motorn.md)
- [s04 · Säker presentation](s04-openclaw.md)
- [s05 · Ordlistan](s05-ordlista.md)
- [s06 · Åtta dagar](s06-plan.md)

Filnamnen `s03-motorn.md` och `s04-openclaw.md` behålls för befintliga länkar.
Innehållets rubriker förklarar deras aktuella uppgift.

## Synka, bygg och kontrollera

Node.js 22 eller senare. Inga paket behöver installeras.

```sh
node tools/sync-docs.mjs --croupier /path/to/croupier --write
node build-static.mjs
node tools/sync-docs.mjs --croupier /path/to/croupier --wiki /path/to/croupier-wiki --write
node tools/sync-docs.mjs --croupier /path/to/croupier --wiki /path/to/croupier-wiki
node --test test/*.test.mjs
node build-static.mjs --check
node tools/build-site.mjs
```

Synkverktyget hämtar aldrig från nätet och gör inga commits eller pushar.
Det jämför text och HTML med SHA-256 samt anger källrevision. Utan källvägar
kontrollerar `node tools/sync-docs.mjs` den lokala kopian mot manifestet.
`index.html` kan också öppnas direkt för läsning offline.

## Publicering och historik

`vercel.json` bygger enbart granskad HTML till `public/`. GitHub Actions
kontrollerar tester, reproducerbar HTML och manifest. Den faktiska publiceringen
verifieras på webbplatsen efter leverans; en lokal build bevisar inte drift.

[V4-historik](archive/v4/README.md), [V3-historik](archive/v3/README.md) och [V2-historik](archive/v2/README.md)
bevarar tidigare publicerade HTML-versioner. De är inte aktuellt sakunderlag.
Inga dokument från Jakobs personliga arkiv importeras till den här ytan.
