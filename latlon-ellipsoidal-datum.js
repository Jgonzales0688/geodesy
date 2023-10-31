import LatLonEllipsoidal, { Cartesian, Dms } from './latlon-ellipsoidal.js';

//Ellipsoid parameters; exposed through static getter below.

const ellipsoids = {
    WGS84: { a: 6378137, b: 6356752.314245, f: 1 / 298.257223563 },
    Airy1830: { a: 6377563.396, b: 6356256.909, f: 1 / 299.3249646 },
    AiryModified: { a: 6377340.189, b: 6356034.448, f: 1 / 299.3249646 },
    Bessel1841: { a: 6377397.155, b: 6356078.962822, f: 1 / 299.15281285 },
    Clarke1866: { a: 6378206.4, b: 6356583.8, f: 1 / 294.978698214 },
    Clarke1880IGN: { a: 6378249.2, b: 6356515.0, f: 1 / 293.466021294 },
    GRS80: { a: 6378137, b: 6356752.314140, f: 1 / 298.257222101 },
    Intl1924: { a: 6378388, b: 6356911.946128, f: 1 / 297 }, // aka Hayford
    WGS72: { a: 6378135, b: 6356750.52, f: 1 / 298.26 },
};

//Datums; exposted through static getter below.

const datums = {
    WGS84: { a: 6378137, b: 6356752.314245, f: 1 / 298.257223563 },
    Airy1830: { a: 6377563.396, b: 6356256.909, f: 1 / 299.3249646 },
    AiryModified: { a: 6377340.189, b: 6356034.448, f: 1 / 299.3249646 },
    Bessel1841: { a: 6377397.155, b: 6356078.962822, f: 1 / 299.15281285 },
    Clarke1866: { a: 6378206.4, b: 6356583.8, f: 1 / 294.978698214 },
    Clarke1880IGN: { a: 6378249.2, b: 6356515.0, f: 1 / 293.466021294 },
    GRS80: { a: 6378137, b: 6356752.314140, f: 1 / 298.257222101 },
    Intl1924: { a: 6378388, b: 6356911.946128, f: 1 / 297 }, // aka Hayford
    WGS72: { a: 6378135, b: 6356750.52, f: 1 / 298.26 },
};

// freeze static properties
Object.keys(ellipsoids).forEach(e => Object.freeze(ellipsoids[e]));
Object.keys(datums).forEach(d => { Object.freeze(datums[d]); Object.freeze(datums[d].transform); });

/**
* Latitude/longitude points on an ellipsoidal model earth, with ellipsoid parameters and methods
* for converting between datums and to geocentric (ECEF) cartesian coordinates.
*
* @extends LatLonEllipsoidal
*/
class LatLonEllipsoidal_Datum extends LatLonEllipsoidal {

    /**
    * Creates a geodetic latitude/longitude point on an ellipsoidal model earth using given datum.
    *
    * @param {number} lat - Latitude (in degrees).
    * @param {number} lon - Longitude (in degrees).
    * @param {number} [height=0] - Height above ellipsoid in metres.
    * @param {LatLon.datums} datum - Datum this point is defined within.
    *
    * @example
    *   import LatLon from '/js/geodesy/latlon-ellipsoidal-datum.js';
    *   const p = new LatLon(53.3444, -6.2577, 17, LatLon.datums.Irl1975);
    */
    constructor(lat, lon, height = 0, datum = datums.WGS84) {
        if (!datum || datum.ellipsoid == undefined) throw new TypeError(`unrecognised datum ‘${datum}’`);

        super(lat, lon, height);

        this._datum = datum;
    }
    /**
       * Datum this point is defined within.
       */
    get datum() {
        return this._datum;
    }

    //Ellipsoided with their parametes; semi-major axis(a), semi-minor axis(b), and flattening(f)
    static get ellipsoids() {
        return ellipsoids;
    }

    //datums; w/associated ellipsoid, and helmert transform parameters to convert from WGS-84 into given datum
    static get datums() {
        return datums;
    }

    /** @param   {number|string|Object} lat|latlon - Geodetic Latitude (in degrees) or comma-separated lat/lon or lat/lon object.
     * @param   {number}               [lon] - Longitude in degrees.
     * @param   {number}               [height=0] - Height above ellipsoid in metres.
     * @param   {LatLon.datums}        [datum=WGS84] - Datum this point is defined within.
     * @returns {LatLon} Latitude/longitude point on ellipsoidal model earth using given datum.
     * @throws  {TypeError} Unrecognised datum.
      */

    static parse(...args) {
        let datum = datums.WGS84;

        // if the last argument is a datum, use that, otherwise use default WGS-84
        if (args.length == 4 || (args.length == 3 && typeof args[2] == 'object')) datum = args.pop();

        if (!datum || datum.ellipsoid == undefined) throw new TypeError(`unrecognised datum ‘${datum}’`);

        const point = super.parse(...args);

        point._datum = datum;

        return point;
    }

    /* converts 'this' lat/lon coordinates to new coordinate system
     * @param   {LatLon.datums} toDatum - Datum this coordinate is to be converted to.
     * @returns {LatLon} This point converted to new datum.
     * @throws  {TypeError} Unrecognised datum.
     */
    convertDatum(toDatum) {
        if (!toDatum || toDatum.ellipsoid == undefined) throw new TypeError(`unrecognised datum ‘${toDatum}’`);

        const oldCartesian = this.toCartesian();                 // convert geodetic to cartesian
        const newCartesian = oldCartesian.convertDatum(toDatum); // convert datum
        const newLatLon = newCartesian.toLatLon();               // convert cartesian back to geodetic

        return newLatLon;
    }
    //converts 'this' point from (geodetic) latituse/longiture coordinates to (geocentric) cartesian coodinates (x/y/z) - based on same datum
    toCartesian() {
        const cartesian = super.toCartesian();
        const cartesianDatum = new Cartesian_Datum(cartesian.x, cartesian.y, cartesian.z, this.datum);
        return cartesianDatum;
    }

}
/* CARTESIAN --------------------------------------------------------------------*/

/**
 * Augments Cartesian with datum the cooordinate is based on, and methods to convert between datums
 * (using Helmert 7-parameter transforms) and to convert cartesian to geodetic latitude/longitude
 * point.
 */

class Cartesian_Datum extends Cartesian {

/**
    * Creates cartesian coordinate representing ECEF (earth-centric earth-fixed) point, on a given
    * datum. The datum will identify the primary meridian (for the x-coordinate), and is also
    * useful in transforming to/from geodetic (lat/lon) coordinates.
    *
    * @param  {number} x - X coordinate in metres (=> 0°N,0°E).
    * @param  {number} y - Y coordinate in metres (=> 0°N,90°E).
    * @param  {number} z - Z coordinate in metres (=> 90°N).
    * @param  {LatLon.datums} [datum] - Datum this coordinate is defined within.
    * @throws {TypeError} Unrecognised datum.
    */
    constructor(x, y, z, datum = undefined) {
        if (datum && datum.ellipsoid == undefined) throw new TypeError(`unrecognised datum ‘${datum}’`);

        super(x, y, z);

        if (datum) this._datum = datum;
    }

    /*
    * Datum this point is defined within.
    */
    get datum() {
        return this._datum;
    }
    set datum(datum) {
        if (!datum || datum.ellipsoid == undefined) throw new TypeError(`unrecognised datum ‘${datum}’`);
        this._datum = datum;
    }

    //Converts 'this' cartesian coodrinate to latitude/longitude point (based on same datum, or WGS84 if unset).
    toLatLon(deprecatedDatum = undefined) {
        if (deprecatedDatum) {
            console.info('datum parameter to Cartesian_Datum.toLatLon is deprecated: set datum before calling toLatLon()');
            this.datum = deprecatedDatum;
        }
        const datum = this.datum || datums.WGS84;
        if (!datum || datum.ellipsoid == undefined) throw new TypeError(`unrecognised datum ‘${datum}’`);

        const latLon = super.toLatLon(datum.ellipsoid); // TODO: what if datum is not geocentric?
        const point = new LatLonEllipsoidal_Datum(latLon.lat, latLon.lon, latLon.height, this.datum);
        return point;
    }

    //Converts 'this' cartesian coordinate to new datum using Helmet 7-parameter transformation. 
    convertDatum(toDatum) {
        // TODO: what if datum is not geocentric?
        if (!toDatum || toDatum.ellipsoid == undefined) throw new TypeError(`unrecognised datum ‘${toDatum}’`);
        if (!this.datum) throw new TypeError('cartesian coordinate has no datum');

        let oldCartesian = null;
        let transform = null;

        if (this.datum == undefined || this.datum == datums.WGS84) {
            // converting from WGS 84
            oldCartesian = this;
            transform = toDatum.transform;
        }
        if (toDatum == datums.WGS84) {
            // converting to WGS 84; use inverse transform
            oldCartesian = this;
            transform = this.datum.transform.map(p => -p);
        }
        if (transform == null) {
            // neither this.datum nor toDatum are WGS84: convert this to WGS84 first
            oldCartesian = this.convertDatum(datums.WGS84);
            transform = toDatum.transform;
        }

        const newCartesian = oldCartesian.applyTransform(transform);
        newCartesian.datum = toDatum;

        return newCartesian;
    }

    //applies helmet 7-param transformation to 'this' coordinate using transform parameters 't'.
    applyTransform(t) {
        // this point
        const { x: x1, y: y1, z: z1 } = this;

        // transform parameters
        const tx = t[0];                    // x-shift in metres
        const ty = t[1];                    // y-shift in metres
        const tz = t[2];                    // z-shift in metres
        const s = t[3] / 1e6 + 1;            // scale: normalise parts-per-million to (s+1)
        const rx = (t[4] / 3600).toRadians(); // x-rotation: normalise arcseconds to radians
        const ry = (t[5] / 3600).toRadians(); // y-rotation: normalise arcseconds to radians
        const rz = (t[6] / 3600).toRadians(); // z-rotation: normalise arcseconds to radians

        // apply transform
        const x2 = tx + x1 * s - y1 * rz + z1 * ry;
        const y2 = ty + x1 * rz + y1 * s - z1 * rx;
        const z2 = tz - x1 * ry + y1 * rx + z1 * s;

        return new Cartesian_Datum(x2, y2, z2);
    }
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

export { LatLonEllipsoidal_Datum as default, Cartesian_Datum as Cartesian, datums, Dms };