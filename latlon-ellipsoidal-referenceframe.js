/* Geodesy tools for conversions between reference frames             (c) Chris Veness 2016-2019  */

import LatLonEllipsoidal, { Cartesian, Dms } from './latlon-ellipsoidal.js';

//ellipsoid parameters- exposed through static getter below
const ellipsoids = {
    WGS84: { a: 6378137, b: 6356752.314245, f: 1 / 298.257223563 },
    GRS80: { a: 6378137, b: 6356752.314140, f: 1 / 298.257222101 },
};

//refernce frames - exposed through static getter below
const referenceFrames = {
    ITRF2014: { name: 'ITRF2014', epoch: 2010.0, ellipsoid: ellipsoids.GRS80 },
    ITRF2008: { name: 'ITRF2008', epoch: 2005.0, ellipsoid: ellipsoids.GRS80 },
    ITRF2005: { name: 'ITRF2005', epoch: 2000.0, ellipsoid: ellipsoids.GRS80 },
    ITRF2000: { name: 'ITRF2000', epoch: 1997.0, ellipsoid: ellipsoids.GRS80 },
    ITRF93: { name: 'ITRF93', epoch: 1988.0, ellipsoid: ellipsoids.GRS80 },
    ITRF91: { name: 'ITRF91', epoch: 1988.0, ellipsoid: ellipsoids.GRS80 },
    WGS84g1762: { name: 'WGS84g1762', epoch: 2005.0, ellipsoid: ellipsoids.WGS84 },
    WGS84g1674: { name: 'WGS84g1674', epoch: 2005.0, ellipsoid: ellipsoids.WGS84 },
    WGS84g1150: { name: 'WGS84g1150', epoch: 2001.0, ellipsoid: ellipsoids.WGS84 },
    ETRF2000: { name: 'ETRF2000', epoch: 2005.0, ellipsoid: ellipsoids.GRS80 }, // ETRF2000(R08)
    NAD83: { name: 'NAD83', epoch: 1997.0, ellipsoid: ellipsoids.GRS80 }, // CORS96
    GDA94: { name: 'GDA94', epoch: 1994.0, ellipsoid: ellipsoids.GRS80 },
};

//transform parameters - exposed through static getter below
import txParams from './latlon-ellipsoidal-referenceframe-txparams.js';

//freeze static properties
Object.keys(ellipsoids).forEach(e => Object.freeze(ellipsoids[e]));
Object.keys(referenceFrames).forEach(trf => Object.freeze(referenceFrames[trf]));
Object.keys(txParams).forEach(tx => { Object.freeze(txParams[tx]); Object.freeze(txParams[tx].params); Object.freeze(txParams[tx].rates); });


/*LATLON  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*/

/**
 * Latitude/longitude points on an ellipsoidal model earth, with ellipsoid parameters and methods
 * for converting between reference frames and to geocentric (ECEF) cartesian coordinates.
 */

class LatLonEllipsoidal_ReferenceFrame extends LatLonEllipsoidal {
    //creates geodetic lat/lon point on an ellipsoidal model earth using a specified reference frame
    constructor(lat, lon, height = 0, referenceFrame = referenceFrames.ITRF2014, epoch = undefined) {
        if (!referenceFrame || referenceFrame.epoch == undefined) throw new TypeError('unrecognised reference frame');
        if (epoch != undefined && isNaN(Number(epoch))) throw new TypeError(`invalid epoch ’${epoch}’`);

        super(lat, lon, height);

        this._referenceFrame = referenceFrame;
        if (epoch) this._epoch = Number(epoch);
    }

    //refernce frame this point is defined within
    get referenceFrame() {
        return this._referenceFrame;
    }

    //points observed epoch
    get epoch() {
        return this._epoch || this.referenceFrame.epoch;
    }

    //ellipsoid parameters: semi-major axis (a), semi-minor axis(b), and flattening(f)
    static get ellipsoids() {
        return ellipsoids;
    }

    //reference frames, with their base ellipsoids and refernce epochs
    static get referenceFrames() {
        return referenceFrames;
    }

    //14-parameter helmet transformation parameters between (dynamic)ITRS frames, and from ITRS frames to (static) regional TRFs, NAD83, ETRF2000, and GDA94
    static get transformParameters() {
        return txParams;
    }

    //parses a latitude/longitude point from a cariety of formats
    static parse(...args) {
        if (args.length == 0) throw new TypeError('invalid (empty) point');

        let referenceFrame = null, epoch = null;

        if (!isNaN(args[1]) && typeof args[2] == 'object') { // latlon, height, referenceFrame, [epoch]
            [referenceFrame] = args.splice(2, 1);
            [epoch] = args.splice(2, 1);
        }

        if (!isNaN(args[2]) && typeof args[3] == 'object') { // lat, lon, height, referenceFrame, [epoch]
            [referenceFrame] = args.splice(3, 1);
            [epoch] = args.splice(3, 1);
        }

        if (!referenceFrame || referenceFrame.epoch == undefined) throw new TypeError('unrecognised reference frame');

        // args is now lat, lon, height or latlon, height as taken by LatLonEllipsoidal .parse()

        const point = super.parse(...args); // note super.parse() also invokes this.constructor()

        point._referenceFrame = referenceFrame;
        if (epoch) point._epoch = Number(epoch);

        return point;
    }

    //converts 'this' lat/lon coordinate to new coordinate system
    convertReferenceFrame(toReferenceFrame) {
        if (!toReferenceFrame || toReferenceFrame.epoch == undefined) throw new TypeError('unrecognised reference frame');

        const oldCartesian = this.toCartesian();                                   // convert geodetic to cartesian
        const newCartesian = oldCartesian.convertReferenceFrame(toReferenceFrame); // convert TRF
        const newLatLon = newCartesian.toLatLon();                                 // convert cartesian back to to geodetic

        return newLatLon;
    }

    //converts 'this' point from latitude/longitude coordinates to cartesian coordinates
    toCartesian() {
        const cartesian = super.toCartesian();
        const cartesianReferenceFrame = new Cartesian_ReferenceFrame(cartesian.x, cartesian.y, cartesian.z, this.referenceFrame, this.epoch);
        return cartesianReferenceFrame;
    }

    //return a string representaion of 'this' point, formatted as degrees, degrees+minutes, or degrees+minutes+seconds
    toString(format = 'd', dp = undefined, dpHeight = null, referenceFrame = false) {
        const ll = super.toString(format, dp, dpHeight);

        const epochFmt = { useGrouping: false, minimumFractionDigits: 1, maximumFractionDigits: 20 };
        const epoch = this.referenceFrame && this.epoch != this.referenceFrame.epoch ? this.epoch.toLocaleString('en', epochFmt) : '';

        const trf = referenceFrame ? ` (${this.referenceFrame.name}${epoch ? '@' + epoch : ''})` : '';

        return ll + trf;
    }

}

/*CARTESIAN - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*/

/**
* Augments Cartesian with reference frame and observation epoch the cooordinate is based on, and
* methods to convert between reference frames (using Helmert 14-parameter transforms) and to
* convert cartesian to geodetic latitude/longitude point.
*/

class Cartesian_ReferenceFrame extends Cartesian {
/**
* Creates cartesian coordinate representing ECEF (earth-centric earth-fixed) point, on a given
* reference frame. The reference frame will identify the primary meridian (for the x-coordinate),
* and is also useful in transforming to/from geodetic (lat/lon) coordinates.
*/

    constructor(x, y, z, referenceFrame = undefined, epoch = undefined) {
        if (referenceFrame != undefined && referenceFrame.epoch == undefined) throw new TypeError('unrecognised reference frame');
        if (epoch != undefined && isNaN(Number(epoch))) throw new TypeError(`invalid epoch ’${epoch}’`);

        super(x, y, z);

        if (referenceFrame) this._referenceFrame = referenceFrame;
        if (epoch) this._epoch = epoch;
    }

//refernce fram this point is defined within
    get referenceFrame() {
        return this._referenceFrame;
    }
    set referenceFrame(referenceFrame) {
        if (!referenceFrame || referenceFrame.epoch == undefined) throw new TypeError('unrecognised reference frame');
        this._referenceFrame = referenceFrame;
    }

//point's observed epoch
    get epoch() {
        return this._epoch ? this._epoch : (this._referenceFrame ? this._referenceFrame.epoch : undefined);
    }
    set epoch(epoch) {
        if (isNaN(Number(epoch))) throw new TypeError(`invalid epoch ’${epoch}’`);
        if (this._epoch != this._referenceFrame.epoch) this._epoch = Number(epoch);
    }

//converts 'this' cartesian coordinate to latitude/longitude point
    toLatLon() {
        if (!this.referenceFrame) throw new Error('cartesian reference frame not defined');

        const latLon = super.toLatLon(this.referenceFrame.ellipsoid);
        const point = new LatLonEllipsoidal_ReferenceFrame(latLon.lat, latLon.lon, latLon.height, this.referenceFrame, this.epoch);
        return point;
    }

//converts 'this' cartesian coordinate to new reference frame using Helmert 14-parameter transformation
    convertReferenceFrame(toReferenceFrame) {
        if (!toReferenceFrame || toReferenceFrame.epoch == undefined) throw new TypeError('unrecognised reference frame');
        if (!this.referenceFrame) throw new TypeError('cartesian coordinate has no reference frame');

        if (this.referenceFrame.name == toReferenceFrame.name) return this; // no-op!

        const oldTrf = this.referenceFrame;
        const newTrf = toReferenceFrame;

        // WGS84(G730/G873/G1150) are coincident with ITRF at 10-centimetre level; WGS84(G1674) and
        // ITRF20014 / ITRF2008 ‘are likely to agree at the centimeter level’ (QPS)
        if (oldTrf.name.startsWith('ITRF') && newTrf.name.startsWith('WGS84')) return this;
        if (oldTrf.name.startsWith('WGS84') && newTrf.name.startsWith('ITRF')) return this;

        const oldC = this;
        let newC = null;

        // is requested transformation available in single step?
        const txFwd = txParams[oldTrf.name + '→' + newTrf.name];
        const txRev = txParams[newTrf.name + '→' + oldTrf.name];

        if (txFwd || txRev) {
            // yes, single step available (either forward or reverse)
            const tx = txFwd ? txFwd : reverseTransform(txRev);
            const t = this.epoch || this.referenceFrame.epoch;
            const t0 = tx.epoch;//epoch || newTrf.epoch;
            newC = oldC.applyTransform(tx.params, tx.rates, t - t0); // ...apply transform...
        } else {
            // find intermediate transform common to old & new to chain though
            const txAvailFromOld = Object.keys(txParams).filter(tx => tx.split('→')[0] == oldTrf.name).map(tx => tx.split('→')[1]);
            const txAvailToNew = Object.keys(txParams).filter(tx => tx.split('→')[1] == newTrf.name).map(tx => tx.split('→')[0]);
            const txIntermediateFwd = txAvailFromOld.filter(tx => txAvailToNew.includes(tx))[0];
            const txAvailFromNew = Object.keys(txParams).filter(tx => tx.split('→')[0] == newTrf.name).map(tx => tx.split('→')[1]);
            const txAvailToOld = Object.keys(txParams).filter(tx => tx.split('→')[1] == oldTrf.name).map(tx => tx.split('→')[0]);
            const txIntermediateRev = txAvailFromNew.filter(tx => txAvailToOld.includes(tx))[0];
            const txFwd1 = txParams[oldTrf.name + '→' + txIntermediateFwd];
            const txFwd2 = txParams[txIntermediateFwd + '→' + newTrf.name];
            const txRev1 = txParams[newTrf.name + '→' + txIntermediateRev];
            const txRev2 = txParams[txIntermediateRev + '→' + oldTrf.name];
            const tx1 = txIntermediateFwd ? txFwd1 : reverseTransform(txRev2);
            const tx2 = txIntermediateFwd ? txFwd2 : reverseTransform(txRev1);
            const t = this.epoch || this.referenceFrame.epoch;
            newC = oldC.applyTransform(tx1.params, tx1.rates, t - tx1.epoch); // ...apply transform 1...
            newC = newC.applyTransform(tx2.params, tx2.rates, t - tx2.epoch); // ...apply transform 2...
        }

        newC.referenceFrame = toReferenceFrame;
        newC.epoch = oldC.epoch;

        return newC;

        function reverseTransform(tx) {
            return { epoch: tx.epoch, params: tx.params.map(p => -p), rates: tx.rates.map(r => -r) };
        }
    }


  /*
   * Applies Helmert 14-parameter transformation to ‘this’ coordinate using supplied transform
   * parameters and annual rates of change, with the secular variation given by the difference
   * between the reference epoch t0 and the observation epoch tc.
   */
    applyTransform(params, rates, δt) {
        // this point
        const x1 = this.x, y1 = this.y, z1 = this.z;

        // base parameters
        const tx = params[0] / 1000;                    // x-shift: normalise millimetres to metres
        const ty = params[1] / 1000;                    // y-shift: normalise millimetres to metres
        const tz = params[2] / 1000;                    // z-shift: normalise millimetres to metres
        const s = params[3] / 1e9;                     // scale: normalise parts-per-billion
        const rx = (params[4] / 3600 / 1000).toRadians(); // x-rotation: normalise milliarcseconds to radians
        const ry = (params[5] / 3600 / 1000).toRadians(); // y-rotation: normalise milliarcseconds to radians
        const rz = (params[6] / 3600 / 1000).toRadians(); // z-rotation: normalise milliarcseconds to radians

        // rate parameters
        const ṫx = rates[0] / 1000;                     // x-shift: normalise millimetres to metres
        const ṫy = rates[1] / 1000;                     // y-shift: normalise millimetres to metres
        const ṫz = rates[2] / 1000;                     // z-shift: normalise millimetres to metres
        const ṡ = rates[3] / 1e9;                      // scale: normalise parts-per-billion
        const ṙx = (rates[4] / 3600 / 1000).toRadians();  // x-rotation: normalise milliarcseconds to radians
        const ṙy = (rates[5] / 3600 / 1000).toRadians();  // y-rotation: normalise milliarcseconds to radians
        const ṙz = (rates[6] / 3600 / 1000).toRadians();  // z-rotation: normalise milliarcseconds to radians

        // combined (normalised) parameters
        const T = { x: tx + ṫx * δt, y: ty + ṫy * δt, z: tz + ṫz * δt };
        const R = { x: rx + ṙx * δt, y: ry + ṙy * δt, z: rz + ṙz * δt };
        const S = 1 + s + ṡ * δt;

        // apply transform (shift, scale, rotate)
        const x2 = T.x + x1 * S - y1 * R.z + z1 * R.y;
        const y2 = T.y + x1 * R.z + y1 * S - z1 * R.x;
        const z2 = T.z - x1 * R.y + y1 * R.x + z1 * S;

        return new Cartesian_ReferenceFrame(x2, y2, z2);
    }

  //returns a string representation of 'this' cartesian point. - TRF is shown if set and obsercation epoch if different from reference epoch. 
    toString(dp = 0) {
        const { x, y, z } = this;
        const epochFmt = { useGrouping: false, minimumFractionDigits: 1, maximumFractionDigits: 20 };
        const epoch = this.referenceFrame && this.epoch != this.referenceFrame.epoch ? this.epoch.toLocaleString('en', epochFmt) : '';
        const trf = this.referenceFrame ? `(${this.referenceFrame.name}${epoch ? '@' + epoch : ''})` : '';
        return `[${x.toFixed(dp)},${y.toFixed(dp)},${z.toFixed(dp)}]${trf}`;
    }
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

export { LatLonEllipsoidal_ReferenceFrame as default, Cartesian_ReferenceFrame as Cartesian, Dms };
