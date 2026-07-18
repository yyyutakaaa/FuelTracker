# FuelTracker

FuelTracker is een Nederlandstalige webapp die voor een autoroute de afstand, geschatte reistijd, benodigde brandstof, kosten en CO₂-uitstoot berekent. De app is gericht op België en Nederland en bewaart ritgeschiedenis lokaal in de browser.

## Functionaliteit

- adressuggesties via OpenStreetMap Nominatim;
- autoroutes via Project OSRM;
- routevisualisatie met Leaflet en OpenStreetMap-kaarttegels;
- kostenraming op basis van verbruik en brandstofprijs;
- brandstofspecifieke CO₂-raming;
- lokale ritgeschiedenis, statistiek en CSV-export;
- responsive lichte en donkere weergave;
- installeerbare PWA met een offline app-shell.

Een routeberekening is een **raming**. Werkelijke afstand, prijs, uitstoot en reistijd kunnen afwijken. Adreszoeken, nieuwe routes, kaarttegels en actuele prijsinformatie vereisen een internetverbinding; de app claimt daarom geen volledige offline routeplanning.

## Lokaal ontwikkelen

Vereist: Node.js 20.19 of nieuwer.

```bash
git clone https://github.com/yyyutakaaa/FuelTracker.git
cd FuelTracker
npm install
npm run dev
```

Vite toont het lokale adres in de terminal. Gebruik de Vite-server in plaats van het HTML-bestand rechtstreeks te openen, omdat modules en de serviceworker een HTTP-context nodig hebben.

## Testen en bouwen

```bash
npm test
npm run build
npm run preview
```

`npm run build` maakt lokale vendorassets, compileert Tailwind, bouwt alle HTML-pagina's en kopieert de vastgepinde browserlibraries naar `dist/vendor`. Alleen de inhoud van `dist/` hoeft gedeployed te worden. De ontwikkelserver maakt dezelfde tijdelijke `vendor/`-map, zodat development en productie dezelfde library-URL's gebruiken.

De Vite-configuratie gebruikt `base: './'`. Daardoor werkt dezelfde build op een domeinroot én onder een subpad, bijvoorbeeld GitHub Pages op `/FuelTracker/`. Registreer `service-worker.js` relatief aan de huidige pagina. De worker staat bewust op de root van de app, zodat zijn standaardscope de volledige app omvat.

## Productie-afhankelijkheden

Versies zijn exact vastgezet in `package.json` en `package-lock.json`:

- Vue 3;
- Leaflet;
- Chart.js;
- Font Awesome;
- Tailwind CSS;
- Vite.

De productiebuild gebruikt lokale bestanden uit `dist/vendor` en de gecompileerde `css/tailwind.generated.css`. Zo is de interface niet afhankelijk van een CDN of runtime Tailwind-compiler.

## PWA en offline gedrag

Het webmanifest, icoon en de serviceworker gebruiken scope-relatieve URL's. De serviceworker bewaart de app-shell en lokaal gehoste statische assets. Navigaties gebruiken netwerk-eerst met een offlinepagina als veilige fallback. Externe API-responses en kaarttegels worden niet als stilzwijgend actuele data opgeslagen.

Voor een installeerbare PWA is in productie HTTPS nodig. `localhost` is tijdens ontwikkeling een toegestane uitzondering.

## Privacy

Ritgeschiedenis en voorkeuren staan in de lokale browseropslag en worden niet naar een eigen FuelTracker-server gesynchroniseerd. Een routezoekopdracht maakt wel rechtstreeks verbinding met externe aanbieders. Zoektekst, coördinaten en technische verbindingsgegevens kunnen daardoor door Nominatim, OSRM, OpenStreetMap en de gebruikte prijsbron worden verwerkt. Zie [privacy.html](privacy.html) voor de uitleg aan gebruikers.

## Projectstructuur

```text
.
├── index.html                 hoofdapp
├── privacy.html               privacy-informatie
├── voorwaarden.html           gebruiksvoorwaarden
├── contact.html               contactroute
├── offline.html               offline fallback
├── css/                       Tailwind-input, gegenereerde CSS en appstijlen
├── js/                        applicatielogica en serviceworker
├── test/                      automatische contracttests
├── manifest.json              PWA-manifest
├── vite.config.js             multipage-build en vendorassets
└── package.json               scripts en vastgepinde dependencies
```

`vendor/`, `css/tailwind.generated.css` en `dist/` zijn buildoutput en hoeven niet handmatig te worden aangepast.

## Externe diensten

- [OpenStreetMap Nominatim](https://nominatim.org/) voor adressuggesties en geocoding;
- [Project OSRM](https://project-osrm.org/) voor routeberekeningen;
- [OpenStreetMap](https://www.openstreetmap.org/) voor kaarttegels;
- [Statbel](https://statbel.fgov.be/) als bron voor Belgische prijsdata, met een fallback wanneer die bron niet bereikbaar is.

Respecteer bij wijzigingen de gebruiksvoorwaarden en limieten van deze diensten. Een publieke app met veel verkeer hoort geocoding, routing en prijsdata via een beheerde backend/proxy met caching en rate limiting aan te bieden.

## Bijdragen

1. Maak een branch.
2. Voer `npm test` en `npm run build` uit.
3. Open een pull request met een korte beschrijving en screenshots bij visuele wijzigingen.

Problemen en ideeën kunnen worden gemeld via [GitHub Issues](https://github.com/yyyutakaaa/FuelTracker/issues).

## Licentie

FuelTracker is beschikbaar onder de [MIT-licentie](LICENSE).
