import assert from 'node:assert/strict';
import test from 'node:test';

import { CO2_FACTORS_KG_PER_LITRE, calculateTripMetrics } from '../js/calculations.js';

test('calculates a one-way petrol trip', () => {
    const result = calculateTripMetrics({
        oneWayDistanceMeters: 100_000,
        oneWayDurationSeconds: 3_600,
        consumption: 6.5,
        fuelPrice: 2,
        fuelType: 'euro95',
        passengers: 1
    });

    assert.equal(result.distanceKm, 100);
    assert.equal(result.durationMin, 60);
    assert.equal(result.fuelNeeded, 6.5);
    assert.equal(result.cost, 13);
    assert.equal(result.costPerPerson, 13);
    assert.equal(result.co2, 6.5 * CO2_FACTORS_KG_PER_LITRE.euro95);
});

test('a return trip doubles totals and splits the cost across passengers', () => {
    const result = calculateTripMetrics({
        oneWayDistanceMeters: 50_000,
        oneWayDurationSeconds: 1_800,
        consumption: 8,
        fuelPrice: 1.75,
        fuelType: 'diesel',
        roundTrip: true,
        passengers: 4
    });

    assert.equal(result.distanceKm, 100);
    assert.equal(result.durationMin, 60);
    assert.equal(result.fuelNeeded, 8);
    assert.equal(result.cost, 14);
    assert.equal(result.costPerPerson, 3.5);
    assert.equal(result.co2Factor, CO2_FACTORS_KG_PER_LITRE.diesel);
});

test('normalizes passenger bounds and rejects invalid metrics', () => {
    assert.equal(calculateTripMetrics({
        oneWayDistanceMeters: 1_000,
        oneWayDurationSeconds: 60,
        consumption: 5,
        fuelPrice: 2,
        fuelType: 'lpg',
        passengers: 99
    }).passengers, 9);

    assert.throws(() => calculateTripMetrics({
        oneWayDistanceMeters: -1,
        oneWayDurationSeconds: 60,
        consumption: 5,
        fuelPrice: 2,
        fuelType: 'euro95'
    }), RangeError);
});
