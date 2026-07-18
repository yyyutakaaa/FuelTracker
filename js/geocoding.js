const firstValue = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim() || '';

const uniqueParts = parts => [...new Set(parts.map(part => String(part || '').trim()).filter(Boolean))];

export const EUROPE_COUNTRY_CODES = [
    'al', 'ad', 'am', 'at', 'az', 'by', 'be', 'ba', 'bg', 'hr', 'cy', 'cz', 'dk', 'ee',
    'fi', 'fr', 'ge', 'de', 'gr', 'hu', 'is', 'ie', 'it', 'xk', 'lv', 'li', 'lt', 'lu',
    'mt', 'md', 'mc', 'me', 'nl', 'mk', 'no', 'pl', 'pt', 'ro', 'ru', 'sm', 'rs', 'sk',
    'si', 'es', 'se', 'ch', 'tr', 'ua', 'gb', 'va'
];

export const EUROPE_COUNTRY_CODES_QUERY = EUROPE_COUNTRY_CODES.join(',');

const EUROPE_COUNTRIES = new Set(EUROPE_COUNTRY_CODES);
const LOCAL_ADDRESS_COUNTRIES = new Set(['be', 'nl']);
const CITY_LEVEL_TYPES = new Set(['city', 'town', 'municipality']);

const getCountryCode = item => firstValue(item?.address?.country_code, item?.country_code).toLocaleLowerCase('en');

const isCityLevelResult = item => {
    const addressType = firstValue(item?.addresstype, item?.address_type).toLocaleLowerCase('en');
    const type = firstValue(item?.type).toLocaleLowerCase('en');
    return CITY_LEVEL_TYPES.has(addressType) || CITY_LEVEL_TYPES.has(type);
};

/**
 * FuelTracker accepts full addresses and POIs in Belgium/the Netherlands.
 * Everywhere else in Europe, only city-level results are valid estimates.
 */
export function isAllowedGeocodingResult(item) {
    const countryCode = getCountryCode(item);
    if (!EUROPE_COUNTRIES.has(countryCode)) return false;
    if (LOCAL_ADDRESS_COUNTRIES.has(countryCode)) return true;
    return isCityLevelResult(item);
}

export function filterAllowedGeocodingResults(results) {
    return Array.isArray(results) ? results.filter(isAllowedGeocodingResult) : [];
}

export function findFirstAllowedGeocodingResult(results) {
    return filterAllowedGeocodingResults(results).find(item => {
        const lat = Number(item?.lat);
        const lon = Number(item?.lon);
        return Number.isFinite(lat) && Number.isFinite(lon);
    }) || null;
}

export function formatGeocodingSuggestions(results, limit = 6) {
    if (!Array.isArray(results)) return [];

    const seen = new Set();
    const suggestions = [];

    for (const item of results) {
        const lat = Number(item?.lat);
        const lon = Number(item?.lon);
        const displayName = String(item?.display_name || '').trim();
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !displayName) continue;

        const identity = item.osm_type && item.osm_id
            ? `${item.osm_type}:${item.osm_id}`
            : displayName.toLocaleLowerCase('nl-BE');
        if (seen.has(identity)) continue;
        seen.add(identity);

        const address = item.address || {};
        const street = firstValue(address.road, address.street, address.pedestrian, address.footway);
        const houseNumber = firstValue(address.house_number);
        const streetAddress = uniqueParts([street, houseNumber]).join(' ');
        const locality = firstValue(address.city, address.town, address.village, address.municipality, address.county);
        const region = firstValue(address.state, address.region, address.province, address.county);
        const postcode = firstValue(address.postcode);
        const country = firstValue(address.country);
        const isCity = isCityLevelResult(item);
        const locationName = firstValue(
            item.name,
            item.namedetails?.name,
            item.namedetails?.['name:nl'],
            item.namedetails?.brand
        );
        const poiName = isCity ? '' : locationName;
        const displayLabel = displayName.split(',')[0].trim();
        const primary = locationName || streetAddress || locality || displayLabel;

        const localityLine = uniqueParts([postcode, locality]).join(' ');
        const addressLine = uniqueParts([
            streetAddress && streetAddress.toLocaleLowerCase('nl-BE') !== primary.toLocaleLowerCase('nl-BE') ? streetAddress : '',
            localityLine && localityLine.toLocaleLowerCase('nl-BE') !== primary.toLocaleLowerCase('nl-BE') ? localityLine : '',
            country
        ]).join(', ');

        let contextParts = uniqueParts([
            streetAddress && streetAddress.toLocaleLowerCase('nl-BE') !== primary.toLocaleLowerCase('nl-BE') ? streetAddress : '',
            locality && locality.toLocaleLowerCase('nl-BE') !== primary.toLocaleLowerCase('nl-BE') ? locality : '',
            postcode,
            country
        ]);

        if (contextParts.length < 2) {
            const displayParts = displayName.split(',').map(part => part.trim()).filter(Boolean);
            contextParts = uniqueParts([
                ...contextParts,
                ...displayParts.filter(part => part.toLocaleLowerCase('nl-BE') !== primary.toLocaleLowerCase('nl-BE')).slice(0, 3)
            ]);
        }

        const cityContext = uniqueParts([
            region && region.toLocaleLowerCase('nl-BE') !== primary.toLocaleLowerCase('nl-BE') ? region : '',
            country
        ]).join(', ');
        const secondary = isCity
            ? cityContext
            : poiName && addressLine
                ? addressLine
                : contextParts.slice(0, 4).join(', ');
        const formattedAddress = secondary ? `${primary}, ${secondary}` : primary;

        suggestions.push({
            id: identity,
            primary,
            secondary,
            poiName,
            addressLine,
            formatted_address: formattedAddress,
            display_name: displayName,
            countryCode: getCountryCode(item),
            kind: isCity ? 'city' : poiName ? 'poi' : 'address',
            lat,
            lon
        });

        if (suggestions.length >= limit) break;
    }

    return suggestions;
}
