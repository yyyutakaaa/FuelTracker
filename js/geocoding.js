const firstValue = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim() || '';

const uniqueParts = parts => [...new Set(parts.map(part => String(part || '').trim()).filter(Boolean))];

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
        const postcode = firstValue(address.postcode);
        const country = firstValue(address.country);
        const name = firstValue(item.name, displayName.split(',')[0]);
        const primary = name || streetAddress || locality || displayName.split(',')[0].trim();

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

        const secondary = contextParts.slice(0, 4).join(', ');
        const formattedAddress = secondary ? `${primary}, ${secondary}` : primary;

        suggestions.push({
            id: identity,
            primary,
            secondary,
            formatted_address: formattedAddress,
            display_name: displayName,
            lat,
            lon
        });

        if (suggestions.length >= limit) break;
    }

    return suggestions;
}
