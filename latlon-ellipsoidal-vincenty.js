import LatLonEllipsoidal, { Dms } from './latlon_ellipsoidal.js';

const π = Math.PI;
const ε = Number.EPSILON;

//use vincenty direct solution
class LatLonEllipsoidal_Vincenty extends LatLonEllipsoidal {

    //Returns the destination point having travelled the given distance alon a geodesic given by initial bearing from 'this' point.
    destinationPoint(distance, initialBearing) {
        return this.direct(Number(distance), Number(initialBearing)).point;
    }

    //Returns final bearing having tavelld along a geodesic given by initial bearing for given distance from 'this' point.
    finalBearingOn(distance, initialBearing) {
        const brng = this.direct(Number(distance), Number(initialBearing)).finalBearing;
        return Number(brng.toFixed(7)); // round to 0.001″ precision
    }

    //Returns the point at given fraction between ‘this’ point and given point.
    intermediatePointTo(point, fraction) {
        if (fraction == 0) return this;
        if (fraction == 1) return point;

        const inverse = this.inverse(point);
        const dist = inverse.distance;
        const brng = inverse.initialBearing;
        return isNaN(brng) ? this : this.destinationPoint(dist * fraction, brng);
    }

/* VINCENTY DIRECT SOLUTION- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*/

    /*
     * Ellipsoid parameters are taken from datum of 'this' point. Height is ignored.
     *
     * @private
     * @param   {number} distance - Distance along bearing in metres.
     * @param   {number} initialBearing - Initial bearing in degrees from north.
     * @returns (Object} Object including point (destination point), finalBearing.
     * @throws  {RangeError} Point must be on surface of ellipsoid.
     * @throws  {EvalError}  Formula failed to converge.
     */
direct(distance, initialBearing) {

    if (isNaN(distance)) throw new TypeError(`invalid distance ${distance}`);
    if (distance == 0) return { point: this, finalBearing: NaN, iterations: 0 };
    if (isNaN(initialBearing)) throw new TypeError(`invalid bearing ${initialBearing}`);
    if (this.height != 0) throw new RangeError('point must be on the surface of the ellipsoid');

    const φ1 = this.lat.toRadians(), λ1 = this.lon.toRadians();
    const α1 = Number(initialBearing).toRadians();
    const s = Number(distance);

    // allow alternative ellipsoid to be specified
    const ellipsoid = this.datum ? this.datum.ellipsoid : LatLonEllipsoidal.ellipsoids.WGS84;
    const { a, b, f } = ellipsoid;

    const sinα1 = Math.sin(α1);
    const cosα1 = Math.cos(α1);

    const tanU1 = (1 - f) * Math.tan(φ1), cosU1 = 1 / Math.sqrt((1 + tanU1 * tanU1)), sinU1 = tanU1 * cosU1;
    const σ1 = Math.atan2(tanU1, cosα1); // σ1 = angular distance on the sphere from the equator to P1
    const sinα = cosU1 * sinα1;          // α = azimuth of the geodesic at the equator
    const cosSqα = 1 - sinα * sinα;
    const uSq = cosSqα * (a * a - b * b) / (b * b);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

    let σ = s / (b * A), sinσ = null, cosσ = null; // σ = angular distance P₁ P₂ on the sphere
    let cos2σₘ = null; // σₘ = angular distance on the sphere from the equator to the midpoint of the line

    let σʹ = null, iterations = 0;
    do {
        cos2σₘ = Math.cos(2 * σ1 + σ);
        sinσ = Math.sin(σ);
        cosσ = Math.cos(σ);
        const Δσ = B * sinσ * (cos2σₘ + B / 4 * (cosσ * (-1 + 2 * cos2σₘ * cos2σₘ) - B / 6 * cos2σₘ * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σₘ * cos2σₘ)));
        σʹ = σ;
        σ = s / (b * A) + Δσ;
    } while (Math.abs(σ - σʹ) > 1e-12 && ++iterations < 100); // TV: 'iterate until negligible change in λ' (≈0.006mm)
    if (iterations >= 100) throw new EvalError('Vincenty formula failed to converge'); // not possible?

    const x = sinU1 * sinσ - cosU1 * cosσ * cosα1;
    const φ2 = Math.atan2(sinU1 * cosσ + cosU1 * sinσ * cosα1, (1 - f) * Math.sqrt(sinα * sinα + x * x));
    const λ = Math.atan2(sinσ * sinα1, cosU1 * cosσ - sinU1 * sinσ * cosα1);
    const C = f / 16 * cosSqα * (4 + f * (4 - 3 * cosSqα));
    const L = λ - (1 - C) * f * sinα * (σ + C * sinσ * (cos2σₘ + C * cosσ * (-1 + 2 * cos2σₘ * cos2σₘ)));
    const λ2 = λ1 + L;

    const α2 = Math.atan2(sinα, -x);

    const destinationPoint = new LatLonEllipsoidal_Vincenty(φ2.toDegrees(), λ2.toDegrees(), 0, this.datum);

    return {
        point: destinationPoint,
        finalBearing: Dms.wrap360(α2.toDegrees()),
        iterations: iterations,
    };
}
}


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

export { LatLonEllipsoidal_Vincenty as default, Dms };