export const CO2_FACTORS_KG_PER_LITRE = Object.freeze({
    euro95: 2.31,
    euro98: 2.31,
    diesel: 2.68,
    lpg: 1.51
});

export function calculateTripMetrics({
    oneWayDistanceMeters,
    oneWayDurationSeconds,
    consumption,
    fuelPrice,
    fuelType,
    roundTrip = false,
    passengers = 1
}) {
    const distanceMeters = Number(oneWayDistanceMeters);
    const durationSeconds = Number(oneWayDurationSeconds);
    const litresPer100Km = Number(consumption);
    const pricePerLitre = Number(fuelPrice);
    const passengerCount = Math.min(9, Math.max(1, Math.floor(Number(passengers) || 1)));

    if (![distanceMeters, durationSeconds, litresPer100Km, pricePerLitre].every(Number.isFinite)) {
        throw new TypeError('Ongeldige ritgegevens');
    }
    if (distanceMeters < 0 || durationSeconds < 0 || litresPer100Km <= 0 || pricePerLitre < 0) {
        throw new RangeError('Ritgegevens mogen niet negatief zijn');
    }

    const routeMultiplier = roundTrip ? 2 : 1;
    const distanceKm = (distanceMeters / 1000) * routeMultiplier;
    const durationMin = (durationSeconds / 60) * routeMultiplier;
    const fuelNeeded = (distanceKm * litresPer100Km) / 100;
    const cost = fuelNeeded * pricePerLitre;
    const co2Factor = CO2_FACTORS_KG_PER_LITRE[fuelType] || CO2_FACTORS_KG_PER_LITRE.euro95;
    const co2 = fuelNeeded * co2Factor;

    return {
        distanceKm,
        durationMin,
        fuelNeeded,
        cost,
        costPerPerson: cost / passengerCount,
        co2,
        co2Factor,
        passengers: passengerCount
    };
}
