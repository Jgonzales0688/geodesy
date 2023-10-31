/* UTM / WGS-84 Conversion Functions                                  (c) Chris Veness 2014-2022  */

import LatLonEllipsoidal, { Dms } from './latlon-ellipsoidal-datum.js';

//UTM coordinates, with functions to parse them and convert them to LatLon points.

class Utm {
    //creates a UTM coodinate object comprising zone, hemisphere, easting, northing on a given datum (normally WGS84)
    constructor(zone, hemisphere, easting, northing, datum = LatLonEllipsoidal.datums.WGS84, convergence = null, scale = null, verifyEN = true) {
        if (!(1 <= zone && zone <= 60)) throw new RangeError(`invalid UTM zone ‘${zone}’`);
        if (zone != parseInt(zone)) throw new RangeError(`invalid UTM zone ‘${zone}’`);
        if (typeof hemisphere != 'string' || !hemisphere.match(/[NS]/i)) throw new RangeError(`invalid UTM hemisphere ‘${hemisphere}’`);
        if (verifyEN) { // (rough) range-check of E/N values
            if (!(0 <= easting && easting <= 1000e3)) throw new RangeError(`invalid UTM easting ‘${easting}’`);
            if (hemisphere.toUpperCase() == 'N' && !(0 <= northing && northing < 9329006)) throw new RangeError(`invalid UTM northing ‘${northing}’`);
            if (hemisphere.toUpperCase() == 'S' && !(1116914 < northing && northing <= 10000e3)) throw new RangeError(`invalid UTM northing ‘${northing}’`);
        }
        if (!datum || datum.ellipsoid == undefined) throw new TypeError(`unrecognised datum ‘${datum}’`);

        this.zone = Number(zone);
        this.hemisphere = hemisphere.toUpperCase();
        this.easting = Number(easting);
        this.northing = Number(northing);
        this.datum = datum;
        this.convergence = convergence === null ? null : Number(convergence);
        this.scale = scale === null ? null : Number(scale);
    }

    //converts UTM zone/easting/northing coordinate to latitude/longitude
    toLatLon() {
        const { zone: z, hemisphere: h } = this;

        const falseEasting = 500e3, falseNorthing = 10000e3;

        const { a, f } = this.datum.ellipsoid; // WGS-84: a = 6378137, f = 1/298.257223563;

        const k0 = 0.9996; // UTM scale on the central meridian

        const x = this.easting - falseEasting;                            // make x ± relative to central meridian
        const y = h == 'S' ? this.northing - falseNorthing : this.northing; // make y ± relative to equator

        // ---- from Karney 2011 Eq 15-22, 36:

        const e = Math.sqrt(f * (2 - f)); // eccentricity
        const n = f / (2 - f);        // 3rd flattening
        const n2 = n * n, n3 = n * n2, n4 = n * n3, n5 = n * n4, n6 = n * n5;

        const A = a / (1 + n) * (1 + 1 / 4 * n2 + 1 / 64 * n4 + 1 / 256 * n6); // 2πA is the circumference of a meridian

        const η = x / (k0 * A);
        const ξ = y / (k0 * A);

        const β = [null, // note β is one-based array (6th order Krüger expressions)
            1 / 2 * n - 2 / 3 * n2 + 37 / 96 * n3 - 1 / 360 * n4 - 81 / 512 * n5 + 96199 / 604800 * n6,
            1 / 48 * n2 + 1 / 15 * n3 - 437 / 1440 * n4 + 46 / 105 * n5 - 1118711 / 3870720 * n6,
            17 / 480 * n3 - 37 / 840 * n4 - 209 / 4480 * n5 + 5569 / 90720 * n6,
            4397 / 161280 * n4 - 11 / 504 * n5 - 830251 / 7257600 * n6,
            4583 / 161280 * n5 - 108847 / 3991680 * n6,
            20648693 / 638668800 * n6];

        let ξʹ = ξ;
        for (let j = 1; j <= 6; j++) ξʹ -= β[j] * Math.sin(2 * j * ξ) * Math.cosh(2 * j * η);

        let ηʹ = η;
        for (let j = 1; j <= 6; j++) ηʹ -= β[j] * Math.cos(2 * j * ξ) * Math.sinh(2 * j * η);

        const sinhηʹ = Math.sinh(ηʹ);
        const sinξʹ = Math.sin(ξʹ), cosξʹ = Math.cos(ξʹ);

        const τʹ = sinξʹ / Math.sqrt(sinhηʹ * sinhηʹ + cosξʹ * cosξʹ);

        let δτi = null;
        let τi = τʹ;
        do {
            const σi = Math.sinh(e * Math.atanh(e * τi / Math.sqrt(1 + τi * τi)));
            const τiʹ = τi * Math.sqrt(1 + σi * σi) - σi * Math.sqrt(1 + τi * τi);
            δτi = (τʹ - τiʹ) / Math.sqrt(1 + τiʹ * τiʹ)
                * (1 + (1 - e * e) * τi * τi) / ((1 - e * e) * Math.sqrt(1 + τi * τi));
            τi += δτi;
        } while (Math.abs(δτi) > 1e-12); // using IEEE 754 δτi -> 0 after 2-3 iterations
        // note relatively large convergence test as δτi toggles on ±1.12e-16 for eg 31 N 400000 5000000
        const τ = τi;

        const φ = Math.atan(τ);

        let λ = Math.atan2(sinhηʹ, cosξʹ);

        // ---- convergence: Karney 2011 Eq 26, 27

        let p = 1;
        for (let j = 1; j <= 6; j++) p -= 2 * j * β[j] * Math.cos(2 * j * ξ) * Math.cosh(2 * j * η);
        let q = 0;
        for (let j = 1; j <= 6; j++) q += 2 * j * β[j] * Math.sin(2 * j * ξ) * Math.sinh(2 * j * η);

        const γʹ = Math.atan(Math.tan(ξʹ) * Math.tanh(ηʹ));
        const γʺ = Math.atan2(q, p);

        const γ = γʹ + γʺ;

        // ---- scale: Karney 2011 Eq 28

        const sinφ = Math.sin(φ);
        const kʹ = Math.sqrt(1 - e * e * sinφ * sinφ) * Math.sqrt(1 + τ * τ) * Math.sqrt(sinhηʹ * sinhηʹ + cosξʹ * cosξʹ);
        const kʺ = A / a / Math.sqrt(p * p + q * q);

        const k = k0 * kʹ * kʺ;

        // ------------

        const λ0 = ((z - 1) * 6 - 180 + 3).toRadians(); // longitude of central meridian
        λ += λ0; // move λ from zonal to global coordinates

        // round to reasonable precision
        const lat = Number(φ.toDegrees().toFixed(14)); // nm precision (1nm = 10^-14°)
        const lon = Number(λ.toDegrees().toFixed(14)); // (strictly lat rounding should be φ⋅cosφ!)
        const convergence = Number(γ.toDegrees().toFixed(9));
        const scale = Number(k.toFixed(12));

        const latLong = new LatLon_Utm(lat, lon, 0, this.datum);
        // ... and add the convergence and scale into the LatLon object ... wonderful JavaScript!
        latLong.convergence = convergence;
        latLong.scale = scale;

        return latLong;
    }

    //Parses string representation of UTM coordinate
    static parse(utmCoord, datum = LatLonEllipsoidal.datums.WGS84) {
        // match separate elements (separated by whitespace)
        utmCoord = utmCoord.trim().match(/\S+/g);

        if (utmCoord == null || utmCoord.length != 4) throw new Error(`invalid UTM coordinate ‘${utmCoord}’`);

        const zone = utmCoord[0], hemisphere = utmCoord[1], easting = utmCoord[2], northing = utmCoord[3];

        return new this(zone, hemisphere, easting, northing, datum); // 'new this' as may return subclassed types
    }

    //Returns a string representation of a UTM coordinate
    toString(digits = 0) {

        const z = this.zone.toString().padStart(2, '0');
        const h = this.hemisphere;
        const e = this.easting.toFixed(digits);
        const n = this.northing.toFixed(digits);

        return `${z} ${h} ${e} ${n}`;
    }

}

/* LATLON_UTM - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */

//Extends LatLon with method to convert LatLon points to UTM coordinates
class LatLon_Utm extends LatLonEllipsoidal {

    //Converts latitude/longitude to UTM coordinate
    toUtm(zoneOverride = undefined) {
        if (!(-80 <= this.lat && this.lat <= 84)) throw new RangeError(`latitude ‘${this.lat}’ outside UTM limits`);

        const falseEasting = 500e3, falseNorthing = 10000e3;

        let zone = zoneOverride || Math.floor((this.lon + 180) / 6) + 1; // longitudinal zone
        let λ0 = ((zone - 1) * 6 - 180 + 3).toRadians(); // longitude of central meridian

        // ---- handle Norway/Svalbard exceptions
        // grid zones are 8° tall; 0°N is offset 10 into latitude bands array
        const mgrsLatBands = 'CDEFGHJKLMNPQRSTUVWXX'; // X is repeated for 80-84°N
        const latBand = mgrsLatBands.charAt(Math.floor(this.lat / 8 + 10));
        // adjust zone & central meridian for Norway
        if (zone == 31 && latBand == 'V' && this.lon >= 3) { zone++; λ0 += (6).toRadians(); }
        // adjust zone & central meridian for Svalbard
        if (zone == 32 && latBand == 'X' && this.lon < 9) { zone--; λ0 -= (6).toRadians(); }
        if (zone == 32 && latBand == 'X' && this.lon >= 9) { zone++; λ0 += (6).toRadians(); }
        if (zone == 34 && latBand == 'X' && this.lon < 21) { zone--; λ0 -= (6).toRadians(); }
        if (zone == 34 && latBand == 'X' && this.lon >= 21) { zone++; λ0 += (6).toRadians(); }
        if (zone == 36 && latBand == 'X' && this.lon < 33) { zone--; λ0 -= (6).toRadians(); }
        if (zone == 36 && latBand == 'X' && this.lon >= 33) { zone++; λ0 += (6).toRadians(); }

        const φ = this.lat.toRadians();      // latitude ± from equator
        const λ = this.lon.toRadians() - λ0; // longitude ± from central meridian

        // allow alternative ellipsoid to be specified
        const ellipsoid = this.datum ? this.datum.ellipsoid : LatLonEllipsoidal.ellipsoids.WGS84;
        const { a, f } = ellipsoid; // WGS-84: a = 6378137, f = 1/298.257223563;

        const k0 = 0.9996; // UTM scale on the central meridian

        // ---- easting, northing: Karney 2011 Eq 7-14, 29, 35:

        const e = Math.sqrt(f * (2 - f)); // eccentricity
        const n = f / (2 - f);        // 3rd flattening
        const n2 = n * n, n3 = n * n2, n4 = n * n3, n5 = n * n4, n6 = n * n5;

        const cosλ = Math.cos(λ), sinλ = Math.sin(λ), tanλ = Math.tan(λ);

        const τ = Math.tan(φ); // τ ≡ tanφ, τʹ ≡ tanφʹ; prime (ʹ) indicates angles on the conformal sphere
        const σ = Math.sinh(e * Math.atanh(e * τ / Math.sqrt(1 + τ * τ)));

        const τʹ = τ * Math.sqrt(1 + σ * σ) - σ * Math.sqrt(1 + τ * τ);

        const ξʹ = Math.atan2(τʹ, cosλ);
        const ηʹ = Math.asinh(sinλ / Math.sqrt(τʹ * τʹ + cosλ * cosλ));

        const A = a / (1 + n) * (1 + 1 / 4 * n2 + 1 / 64 * n4 + 1 / 256 * n6); // 2πA is the circumference of a meridian

        const α = [null, // note α is one-based array (6th order Krüger expressions)
            1 / 2 * n - 2 / 3 * n2 + 5 / 16 * n3 + 41 / 180 * n4 - 127 / 288 * n5 + 7891 / 37800 * n6,
            13 / 48 * n2 - 3 / 5 * n3 + 557 / 1440 * n4 + 281 / 630 * n5 - 1983433 / 1935360 * n6,
            61 / 240 * n3 - 103 / 140 * n4 + 15061 / 26880 * n5 + 167603 / 181440 * n6,
            49561 / 161280 * n4 - 179 / 168 * n5 + 6601661 / 7257600 * n6,
            34729 / 80640 * n5 - 3418889 / 1995840 * n6,
            212378941 / 319334400 * n6];

        let ξ = ξʹ;
        for (let j = 1; j <= 6; j++) ξ += α[j] * Math.sin(2 * j * ξʹ) * Math.cosh(2 * j * ηʹ);

        let η = ηʹ;
        for (let j = 1; j <= 6; j++) η += α[j] * Math.cos(2 * j * ξʹ) * Math.sinh(2 * j * ηʹ);

        let x = k0 * A * η;
        let y = k0 * A * ξ;

        // ---- convergence: Karney 2011 Eq 23, 24

        let pʹ = 1;
        for (let j = 1; j <= 6; j++) pʹ += 2 * j * α[j] * Math.cos(2 * j * ξʹ) * Math.cosh(2 * j * ηʹ);
        let qʹ = 0;
        for (let j = 1; j <= 6; j++) qʹ += 2 * j * α[j] * Math.sin(2 * j * ξʹ) * Math.sinh(2 * j * ηʹ);

        const γʹ = Math.atan(τʹ / Math.sqrt(1 + τʹ * τʹ) * tanλ);
        const γʺ = Math.atan2(qʹ, pʹ);

        const γ = γʹ + γʺ;

        // ---- scale: Karney 2011 Eq 25

        const sinφ = Math.sin(φ);
        const kʹ = Math.sqrt(1 - e * e * sinφ * sinφ) * Math.sqrt(1 + τ * τ) / Math.sqrt(τʹ * τʹ + cosλ * cosλ);
        const kʺ = A / a * Math.sqrt(pʹ * pʹ + qʹ * qʹ);

        const k = k0 * kʹ * kʺ;

        // ------------

        // shift x/y to false origins
        x = x + falseEasting;             // make x relative to false easting
        if (y < 0) y = y + falseNorthing; // make y in southern hemisphere relative to false northing

        // round to reasonable precision
        x = Number(x.toFixed(9)); // nm precision
        y = Number(y.toFixed(9)); // nm precision
        const convergence = Number(γ.toDegrees().toFixed(9));
        const scale = Number(k.toFixed(12));

        const h = this.lat >= 0 ? 'N' : 'S'; // hemisphere

        return new Utm(zone, h, x, y, this.datum, convergence, scale, !!zoneOverride);
    }
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

export { Utm as default, LatLon_Utm as LatLon, Dms };
