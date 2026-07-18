import assert from 'node:assert/strict';
import test from 'node:test';

import { formatGeocodingSuggestions } from '../js/geocoding.js';

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
