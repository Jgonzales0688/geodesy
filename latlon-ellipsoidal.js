import Dms from './dms.js';
import Vector3d from './vector3d.js';

//ellipsoid parametes; exposted through static getter below - only ellipsoid defined in WGS84, for use in utm/mgrs, vincenty, nvector
const ellipsoids = {
    WGS84: { a: 6378137, b: 6356752.314245, f: 1 / 298.257223563 },
};

//datums; exposed through static getter below - only datum defined is WGS84, for use in utm/mgrs,vincenty, nvector.
const datums = {
    WGS84: { ellipsoid: ellipsoids.WGS84 },
};

// freeze static properties
Object.freeze(ellipsoids.WGS84);
Object.freeze(datums.WGS84);



/* LatLon Ellipsoidal - - - - - - - - - - - - - - - - - - - - - - - - */

/*
 * Ellisoid parameters and methods used for converting points to/from cartesian coordinates
 *
 * 
 * 
 * This is the core class which will (usually) be used via LatLonEllipsoidal_Datum or LatLonEllipsoidal_ReferenceFrame.
 */

class LatLonEllipsoidal {

    //creates a geodetic lat/lon point on a WGS84 ellipsoidal model earth
    constructor(lat, lon, height = 0) {
        if (isNaN(lat) || lat == null) throw new TypeError(`invalid lat ‘${lat}’`);
        if (isNaN(lon) || lon == null) throw new TypeError(`invalid lon ‘${lon}’`);
        if (isNaN(height) || height == null) throw new TypeError(`invalid height ‘${height}’`);

        this._lat = Dms.wrap90(Number(lat));
        this._lon = Dms.wrap180(Number(lon));
        this._height = Number(height);
    }

    //latitude in degree north from equator
    get lat() { return this._lat; }
    get latitude() { return this._lat; }
    set lat(lat) {
        this._lat = isNaN(lat) ? Dms.wrap90(Dms.parse(lat)) : Dms.wrap90(Number(lat));
        if (isNaN(this._lat)) throw new TypeError(`invalid lat ‘${lat}’`);
    }
    set latitude(lat) {
        this._lat = isNaN(lat) ? Dms.wrap90(Dms.parse(lat)) : Dms.wrap90(Number(lat));
        if (isNaN(this._lat)) throw new TypeError(`invalid latitude ‘${lat}’`);
    }

    //longitude in degrees east from international reference meridian
    get lon() { return this._lon; }
    get lng() { return this._lon; }
    get longitude() { return this._lon; }
    set lon(lon) {
        this._lon = isNaN(lon) ? Dms.wrap180(Dms.parse(lon)) : Dms.wrap180(Number(lon));
        if (isNaN(this._lon)) throw new TypeError(`invalid lon ‘${lon}’`);
    }
    set lng(lon) {
        this._lon = isNaN(lon) ? Dms.wrap180(Dms.parse(lon)) : Dms.wrap180(Number(lon));
        if (isNaN(this._lon)) throw new TypeError(`invalid lng ‘${lon}’`);
    }
    set longitude(lon) {
        this._lon = isNaN(lon) ? Dms.wrap180(Dms.parse(lon)) : Dms.wrap180(Number(lon));
        if (isNaN(this._lon)) throw new TypeError(`invalid longitude ‘${lon}’`);
    }

    //Height in meters above ellipsoid
    get height() { return this._height; }
    set height(height) { this._height = Number(height); if (isNaN(this._height)) throw new TypeError(`invalid height ‘${height}’`); }


    //Datum. NOTE: replicated w/in LatLonEllipsoidal for LatLonEllipsoidal object to be monkey-patched to look like a LatLonEllipsoidal_Datum - for Vincenty calculations on different ellipsoids.
    get datum() { return this._datum; }
    set datum(datum) { this._datum = datum; }


    //Ellipsoid w/their paremeters, this module only defines WGS84 parameters
    static get ellipsoids() {
        return ellipsoids;
    }

    //Datums. -module only defines WGS84 datum
    static get datums() {
        return datums;
    }

    //parses a latitude/longitude point form a variety of formats
    static parse(...args) {
        if (args.length == 0) throw new TypeError('invalid (empty) point');

        let lat = undefined, lon = undefined, height = undefined;

        // single { lat, lon } object
        if (typeof args[0] == 'object' && (args.length == 1 || !isNaN(parseFloat(args[1])))) {
            const ll = args[0];
            if (ll.type == 'Point' && Array.isArray(ll.coordinates)) { // GeoJSON
                [lon, lat, height] = ll.coordinates;
                height = height || 0;
            } else { // regular { lat, lon } object
                if (ll.latitude != undefined) lat = ll.latitude;
                if (ll.lat != undefined) lat = ll.lat;
                if (ll.longitude != undefined) lon = ll.longitude;
                if (ll.lng != undefined) lon = ll.lng;
                if (ll.lon != undefined) lon = ll.lon;
                if (ll.height != undefined) height = ll.height;
                lat = Dms.wrap90(Dms.parse(lat));
                lon = Dms.wrap180(Dms.parse(lon));
            }
            if (args[1] != undefined) height = args[1];
            if (isNaN(lat) || isNaN(lon)) throw new TypeError(`invalid point ‘${JSON.stringify(args[0])}’`);
        }

        // single comma-separated lat/lon
        if (typeof args[0] == 'string' && args[0].split(',').length == 2) {
            [lat, lon] = args[0].split(',');
            lat = Dms.wrap90(Dms.parse(lat));
            lon = Dms.wrap180(Dms.parse(lon));
            height = args[1] || 0;
            if (isNaN(lat) || isNaN(lon)) throw new TypeError(`invalid point ‘${args[0]}’`);
        }

        // regular (lat, lon) arguments
        if (lat == undefined && lon == undefined) {
            [lat, lon] = args;
            lat = Dms.wrap90(Dms.parse(lat));
            lon = Dms.wrap180(Dms.parse(lon));
            height = args[2] || 0;
            if (isNaN(lat) || isNaN(lon)) throw new TypeError(`invalid point ‘${args.toString()}’`);
        }

        return new this(lat, lon, height); // 'new this' as may return subclassed types
    }

    //converts 'this' point from latitude/longitude coordinates to cartesian coordinates
    toCartesian() {
        // x = (ν+h)⋅cosφ⋅cosλ, y = (ν+h)⋅cosφ⋅sinλ, z = (ν⋅(1-e²)+h)⋅sinφ
        // where ν = a/√(1−e²⋅sinφ⋅sinφ), e² = (a²-b²)/a² or (better conditioned) 2⋅f-f²
        const ellipsoid = this.datum
            ? this.datum.ellipsoid
            : this.referenceFrame ? this.referenceFrame.ellipsoid : ellipsoids.WGS84;

        const φ = this.lat.toRadians();
        const λ = this.lon.toRadians();
        const h = this.height;
        const { a, f } = ellipsoid;

        const sinφ = Math.sin(φ), cosφ = Math.cos(φ);
        const sinλ = Math.sin(λ), cosλ = Math.cos(λ);

        const eSq = 2 * f - f * f;                      // 1st eccentricity squared ≡ (a²-b²)/a²
        const ν = a / Math.sqrt(1 - eSq * sinφ * sinφ); // radius of curvature in prime vertical

        const x = (ν + h) * cosφ * cosλ;
        const y = (ν + h) * cosφ * sinλ;
        const z = (ν * (1 - eSq) + h) * sinφ;

        return new Cartesian(x, y, z);
    }

    //checks if another point is equal to 'this' point. 
    equals(point) {
        if (!(point instanceof LatLonEllipsoidal)) throw new TypeError(`invalid point ‘${point}’`);

        if (Math.abs(this.lat - point.lat) > Number.EPSILON) return false;
        if (Math.abs(this.lon - point.lon) > Number.EPSILON) return false;
        if (Math.abs(this.height - point.height) > Number.EPSILON) return false;
        if (this.datum != point.datum) return false;
        if (this.referenceFrame != point.referenceFrame) return false;
        if (this.epoch != point.epoch) return false;

        return true;
    }

        //return a string representation of 'this' point, formatted as degrees, degrees+minutes, or degrees+minutes+seconds
    toString(format = 'd', dp = undefined, dpHeight = null) {
        // note: explicitly set dp to undefined for passing through to toLat/toLon
        if (!['d', 'dm', 'dms', 'n'].includes(format)) throw new RangeError(`invalid format ‘${format}’`);

        const height = (this.height >= 0 ? ' +' : ' ') + this.height.toFixed(dpHeight) + 'm';
        if (format == 'n') { // signed numeric degrees
            if (dp == undefined) dp = 4;
            const lat = this.lat.toFixed(dp);
            const lon = this.lon.toFixed(dp);
            return `${lat}, ${lon}${dpHeight == null ? '' : height}`;
        }

        const lat = Dms.toLat(this.lat, format, dp);
        const lon = Dms.toLon(this.lon, format, dp);

        return `${lat}, ${lon}${dpHeight == null ? '' : height}`;
    }

}

/* CARTESIAN - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */

 //ECEF geocentric cartesian coordinates

class Cartesian extends Vector3d {
    constructor(x, y, z) {
        super(x, y, z); //specifies units & axes
    }

    toLatLon(ellipsoid = ellipsoids.WGS84) {
        //NOTE: ellipsoid is available as a parameter for when toLatLon gets subclassed to Ellipsoidal_Datum/Ellipsoidal_Referenceframe.
        if (!ellipsoid || !ellipsoid.a) throw new TypeError(`invalid ellipsoid ‘${ellipsoid}’`);

        const { x, y, z } = this;
        const { a, b, f } = ellipsoid;

        const e2 = 2 * f - f * f;           // 1st eccentricity squared ≡ (a²−b²)/a²
        const ε2 = e2 / (1 - e2);         // 2nd eccentricity squared ≡ (a²−b²)/b²
        const p = Math.sqrt(x * x + y * y); // distance from minor axis
        const R = Math.sqrt(p * p + z * z); // polar radius

        // parametric latitude (Bowring eqn.17, replacing tanβ = z·a / p·b)
        const tanβ = (b * z) / (a * p) * (1 + ε2 * b / R);
        const sinβ = tanβ / Math.sqrt(1 + tanβ * tanβ);
        const cosβ = sinβ / tanβ;

        // geodetic latitude (Bowring eqn.18: tanφ = z+ε²⋅b⋅sin³β / p−e²⋅cos³β)
        const φ = isNaN(cosβ) ? 0 : Math.atan2(z + ε2 * b * sinβ * sinβ * sinβ, p - e2 * a * cosβ * cosβ * cosβ);

        // longitude
        const λ = Math.atan2(y, x);

        // height above ellipsoid (Bowring eqn.7)
        const sinφ = Math.sin(φ), cosφ = Math.cos(φ);
        const ν = a / Math.sqrt(1 - e2 * sinφ * sinφ); // length of the normal terminated by the minor axis
        const h = p * cosφ + z * sinφ - (a * a / ν);

        const point = new LatLonEllipsoidal(φ.toDegrees(), λ.toDegrees(), h);

        return point;
    }

    toString(dp = 0) {
        const x = this.x.toFixed(dp), y = this.y.toFixed(dp), z = this.z.toFixed(dp);
        return `[${x},${y},${z}]`;
    }

}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */
export { LatLonEllipsoidal as default, Cartesian, Vector3d, Dms };