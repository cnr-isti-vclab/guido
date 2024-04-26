// Costante K0
const K0 = 0.9996;

const E = 0.00669438;
const E2 = E * E;
const E3 = E2 * E;
const E_P2 = E / (1 - E);

const SQRT_E = Math.sqrt(1 - E);
const _E = (1 - SQRT_E) / (1 + SQRT_E);
const _E2 = _E * _E;
const _E3 = _E2 * _E;
const _E4 = _E3 * _E;
const _E5 = _E4 * _E;

const M1 = (1 - E / 4 - 3 * E2 / 64 - 5 * E3 / 256);
const M2 = (3 * E / 8 + 3 * E2 / 32 + 45 * E3 / 1024);
const M3 = (15 * E2 / 256 + 45 * E3 / 1024);
const M4 = (35 * E3 / 3072);

const R = 6378137;

class OutOfRangeError extends Error {}

function in_bounds(x, lower, upper, upper_strict = false) {
    if (upper_strict) {
        return lower <= Math.min(x) && Math.max(x) < upper;
    } else {
        return lower <= x && x <= upper;
    }
}

function mixed_signs(x) {
    return Math.min(x) < 0 && Math.max(x) >= 0;
}

function negative(x) {
    return x < 0;
}

function mod_angle(value) {
    return ((value + Math.PI) % (2 * Math.PI)) - Math.PI;
}

function coord_projection(latitude, longitude, central_meridian) {
    if (!in_bounds(latitude, -80, 84) || !in_bounds(longitude, -180, 180)) {
        throw new OutOfRangeError('Latitude must be between -80 deg S and 84 deg N, and longitude must be between -180 deg W and 180 deg E');
    }

    const lat_rad = latitude * (Math.PI / 180);
    const lat_sin = Math.sin(lat_rad);
    const lat_cos = Math.cos(lat_rad);

    const lat_tan = lat_sin / lat_cos;
    const lat_tan2 = lat_tan * lat_tan;
    const lat_tan4 = lat_tan2 * lat_tan2;

    const lon_rad = longitude * (Math.PI / 180);
    const central_lon = central_meridian;
    const central_lon_rad = central_lon * (Math.PI / 180);

    const n = R / Math.sqrt(1 - E * lat_sin**2);
    const c = E_P2 * lat_cos**2;

    const a = lat_cos * mod_angle(lon_rad - central_lon_rad);
    const a2 = a * a;
    const a3 = a2 * a;
    const a4 = a3 * a;
    const a5 = a4 * a;
    const a6 = a5 * a;

    const m = R * (M1 * lat_rad -
        M2 * Math.sin(2 * lat_rad) +
        M3 * Math.sin(4 * lat_rad) -
        M4 * Math.sin(6 * lat_rad));

    let easting = 500000 + K0 * n * (a +
        a3 / 6 * (1 - lat_tan2 + c) +
        a5 / 120 * (5 - 18 * lat_tan2 + lat_tan4 + 72 * c - 58 * E_P2));

    let northing = K0 * (m + n * lat_tan * (a2 / 2 +
        a4 / 24 * (5 - lat_tan2 + 9 * c + 4 * c**2) +
        a6 / 720 * (61 - 58 * lat_tan2 + lat_tan4 + 600 * c - 330 * E_P2)));

    if (mixed_signs(latitude)) {
        throw new Error("Latitudes must all have the same sign");
    } else if (negative(latitude)) {
        northing += 10000000;
    }

    return [easting, northing];
}

module.exports = coord_projection
// // Esempio di utilizzo:
// const latitude = 43.84659722222222;
// const longitude = 10.502530555555555;
// const central_meridian = 10;

// const [easting, northing] = coord_projection(latitude, longitude, central_meridian);
// console.log(`Easting: ${easting}, Northing: ${northing}`);
