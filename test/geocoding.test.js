import assert from 'node:assert/strict';
import test from 'node:test';

import {
    EUROPE_COUNTRY_CODES,
    filterAllowedGeocodingResults,
    findFirstAllowedGeocodingResult,
    formatGeocodingSuggestions,
    isAllowedGeocodingResult
} from '../js/geocoding.js';

test('adds location context to equally named address suggestions', () => {
    const results = formatGeocodingSuggestions([
        {
            osm_type: 'node',
            osm_id: 1,
            name: 'Istanbul',
            display_name: 'Istanbul, Stationsstraat, Gent, Oost-Vlaanderen, België',
            lat: '51.05',
            lon: '3.72',
            address: { road: 'Stationsstraat', city: 'Gent', postcode: '9000', country: 'België' }
        },
        {
            osm_type: 'node',
            osm_id: 2,
            name: 'Istanbul',
            display_name: 'Istanbul, Kerkstraat, Antwerpen, België',
            lat: '51.22',
            lon: '4.40',
            address: { road: 'Kerkstraat', city: 'Antwerpen', postcode: '2000', country: 'België' }
        }
    ]);

    assert.equal(results.length, 2);
    assert.equal(results[0].primary, 'Istanbul');
    assert.match(results[0].secondary, /Stationsstraat/);
    assert.match(results[0].secondary, /Gent/);
    assert.match(results[1].secondary, /Antwerpen/);
    assert.notEqual(results[0].formatted_address, results[1].formatted_address);
});

test('deduplicates identical OSM results and ignores invalid coordinates', () => {
    const duplicate = {
        osm_type: 'way',
        osm_id: 42,
        display_name: 'Korenmarkt, Gent, België',
        lat: '51.054',
        lon: '3.721',
        address: { road: 'Korenmarkt', city: 'Gent', country: 'België' }
    };

    const results = formatGeocodingSuggestions([
        duplicate,
        { ...duplicate },
        { display_name: 'Ongeldig', lat: 'geen-getal', lon: '3.7' }
    ]);

    assert.equal(results.length, 1);
    assert.equal(results[0].primary, 'Korenmarkt');
});

test('allows European cities, including Istanbul', () => {
    const cities = [
        { name: 'Parijs', addresstype: 'city', lat: '48.85', lon: '2.35', address: { country: 'Frankrijk', country_code: 'fr' } },
        { name: 'Berlijn', type: 'city', lat: '52.52', lon: '13.40', address: { country: 'Duitsland', country_code: 'de' } },
        { name: 'İstanbul', addresstype: 'city', lat: '41.01', lon: '28.97', address: { country: 'Türkiye', country_code: 'tr' } }
    ];

    assert.ok(EUROPE_COUNTRY_CODES.includes('tr'));
    assert.deepEqual(filterAllowedGeocodingResults(cities), cities);

    const [istanbul] = formatGeocodingSuggestions([{
        ...cities[2],
        osm_type: 'relation',
        osm_id: 123,
        display_name: 'İstanbul, Marmara Bölgesi, Türkiye',
        address: { city: 'İstanbul', province: 'İstanbul', country: 'Türkiye', country_code: 'tr' }
    }]);
    assert.equal(istanbul.primary, 'İstanbul');
    assert.equal(istanbul.secondary, 'Türkiye');
    assert.equal(istanbul.kind, 'city');
});

test('only allows streets and POIs in Belgium and the Netherlands', () => {
    const wetstraat = {
        name: 'Wetstraat 16', addresstype: 'building', lat: '50.84', lon: '4.37',
        address: { road: 'Wetstraat', house_number: '16', country_code: 'be' }
    };
    const damrak = {
        name: 'Damrak 1', addresstype: 'building', lat: '52.37', lon: '4.89',
        address: { road: 'Damrak', house_number: '1', country_code: 'nl' }
    };
    const rueDeRivoli = {
        name: 'Rue de Rivoli', addresstype: 'road', lat: '48.86', lon: '2.33',
        address: { road: 'Rue de Rivoli', country_code: 'fr' }
    };
    const eiffelTower = {
        name: 'Tour Eiffel', addresstype: 'attraction', lat: '48.85', lon: '2.29',
        address: { road: 'Avenue Gustave Eiffel', country_code: 'fr' }
    };

    assert.equal(isAllowedGeocodingResult(wetstraat), true);
    assert.equal(isAllowedGeocodingResult(damrak), true);
    assert.equal(isAllowedGeocodingResult(rueDeRivoli), false);
    assert.equal(isAllowedGeocodingResult(eiffelTower), false);
    assert.equal(isAllowedGeocodingResult({ ...rueDeRivoli, address: { road: 'Onbekend' } }), false);
    assert.deepEqual(filterAllowedGeocodingResults([wetstraat, rueDeRivoli, damrak]), [wetstraat, damrak]);
});

test('uses a POI name as the label and its address as the small context line', () => {
    const [suggestion] = formatGeocodingSuggestions([{
        osm_type: 'way',
        osm_id: 99,
        name: 'Plopsaland De Panne',
        display_name: 'Plopsaland De Panne, 68, De Pannelaan, Adinkerke, De Panne, Veurne, West-Vlaanderen, Vlaanderen, 8660, België',
        lat: '51.08',
        lon: '2.59',
        addresstype: 'theme_park',
        address: {
            road: 'De Pannelaan',
            house_number: '68',
            town: 'De Panne',
            postcode: '8660',
            country: 'België',
            country_code: 'be'
        }
    }]);

    assert.equal(suggestion.primary, 'Plopsaland De Panne');
    assert.equal(suggestion.poiName, 'Plopsaland De Panne');
    assert.match(suggestion.secondary, /De Pannelaan 68/);
    assert.match(suggestion.secondary, /8660 De Panne/);
    assert.match(suggestion.secondary, /België/);
    assert.match(suggestion.formatted_address, /^Plopsaland De Panne,/);
    assert.equal(suggestion.kind, 'poi');
});

test('direct geocoding uses the same location policy', () => {
    const parisStreet = {
        display_name: 'Rue de Rivoli, Parijs, Frankrijk', addresstype: 'road', lat: '48.86', lon: '2.33',
        address: { road: 'Rue de Rivoli', country_code: 'fr' }
    };
    const parisCity = {
        display_name: 'Parijs, Île-de-France, Frankrijk', addresstype: 'city', lat: '48.85', lon: '2.35',
        address: { city: 'Parijs', country_code: 'fr' }
    };

    assert.equal(findFirstAllowedGeocodingResult([parisStreet, parisCity]), parisCity);
});
