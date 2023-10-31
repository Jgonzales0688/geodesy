import LatLonEllipsoidal, { Cartesian, Vector3d, Dms } from './latlon-ellipsoidal.js';

/* LatLon_NvectorEllipsoidal - - - - - - - - - - - - - - - - - - - */

//latitude/longitude points on an ellipsoidal model earth augmented with methods for calculating delta vectors between points and converting to n-vectors
class LatLon_NvectorEllipsoidal extends LatLonEllipsoidal {
    //Calcualted delta from 'this' point to supplied point
    deltaTo(point) {
        if (!(point instanceof LatLonEllipsoidal)) throw new TypeError(`invalid point ‘${point}’`);

        // get delta in cartesian frame
        const c1 = this.toCartesian();
        const c2 = point.toCartesian();
        const δc = c2.minus(c1);

        // get local (n-vector) coordinate frame
        const n1 = this.toNvector();
        const a = new Vector3d(0, 0, 1); // axis vector pointing to 90°N
        const d = n1.negate();           // down (pointing opposite to n-vector)
        const e = a.cross(n1).unit();    // east (pointing perpendicular to the plane)
        const n = e.cross(d);            // north (by right hand rule)

        // rotation matrix is built from n-vector coordinate frame axes (using row vectors)
        const r = [
            [n.x, n.y, n.z],
            [e.x, e.y, e.z],
            [d.x, d.y, d.z],
        ];

        // apply rotation to δc to get delta in n-vector reference frame
        const δn = new Cartesian(
            r[0][0] * δc.x + r[0][1] * δc.y + r[0][2] * δc.z,
            r[1][0] * δc.x + r[1][1] * δc.y + r[1][2] * δc.z,
            r[2][0] * δc.x + r[2][1] * δc.y + r[2][2] * δc.z,
        );

        return new Ned(δn.x, δn.y, δn.z);
    }

    //calculates destination point using supplied delta from 'this' point.
    destinationPoint(delta) {
        if (!(delta instanceof Ned)) throw new TypeError('delta is not Ned object');

        // convert North-East-Down delta to standard x/y/z vector in coordinate frame of n-vector
        const δn = new Vector3d(delta.north, delta.east, delta.down);

        // get local (n-vector) coordinate frame
        const n1 = this.toNvector();
        const a = new Vector3d(0, 0, 1); // axis vector pointing to 90°N
        const d = n1.negate();           // down (pointing opposite to n-vector)
        const e = a.cross(n1).unit();    // east (pointing perpendicular to the plane)
        const n = e.cross(d);            // north (by right hand rule)

        // rotation matrix is built from n-vector coordinate frame axes (using column vectors)
        const r = [
            [n.x, e.x, d.x],
            [n.y, e.y, d.y],
            [n.z, e.z, d.z],
        ];

        // apply rotation to δn to get delta in cartesian (ECEF) coordinate reference frame
        const δc = new Cartesian(
            r[0][0] * δn.x + r[0][1] * δn.y + r[0][2] * δn.z,
            r[1][0] * δn.x + r[1][1] * δn.y + r[1][2] * δn.z,
            r[2][0] * δn.x + r[2][1] * δn.y + r[2][2] * δn.z,
        );

        // apply (cartesian) delta to c1 to obtain destination point as cartesian coordinate
        const c1 = this.toCartesian();              // convert this LatLon to Cartesian
        const v2 = c1.plus(δc);                     // the plus() gives us a plain vector,..
        const c2 = new Cartesian(v2.x, v2.y, v2.z); // ... need to convert it to Cartesian to get LatLon

        // return destination cartesian coordinate as latitude/longitude
        return c2.toLatLon();
    }

    //converts 'this' lat/lon point to n-vector (normal to the earth's surface)
    toNvector() { // note: replicated in LatLonNvectorSpherical
        const φ = this.lat.toRadians();
        const λ = this.lon.toRadians();

        const sinφ = Math.sin(φ), cosφ = Math.cos(φ);
        const sinλ = Math.sin(λ), cosλ = Math.cos(λ);

        // right-handed vector: x -> 0°E,0°N; y -> 90°E,0°N, z -> 90°N
        const x = cosφ * cosλ;
        const y = cosφ * sinλ;
        const z = sinφ;

        return new NvectorEllipsoidal(x, y, z, this.h, this.datum);
    }

    //converts 'this' point from latitude/longitude coordinates to cartesian coordinates
    toCartesian() {
        const c = super.toCartesian();  // c is 'Cartesian'

        // return Cartesian_Nvector to have toNvector() available as method of exported LatLon
        return new Cartesian_Nvector(c.x, c.y, c.z);
    }

}

/* NVECTOR - - - - - - - - - - - - - - - - - - - - - - - - - - - - */

class NvectorEllipsoidal extends Vector3d {
    //creates a 3d n-vector normal to the earth's surface
    constructor(x, y, z, h = 0, datum = LatLonEllipsoidal.datums.WGS84) {
        const u = new Vector3d(x, y, z).unit(); // n-vectors are always normalised

        super(u.x, u.y, u.z);

        this.h = Number(h);
        this.datum = datum;
    }

    //converts 'this' n-vector to latitude/longitude point
    toLatLon() {
        // tanφ = z / √(x²+y²), tanλ = y / x (same as spherical calculation)

        const { x, y, z } = this;

        const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
        const λ = Math.atan2(y, x);

        return new LatLon_NvectorEllipsoidal(φ.toDegrees(), λ.toDegrees(), this.h, this.datum);
    }

    //converts 'this' n-vector to cartesian coordinate
    toCartesian() {
        const { b, f } = this.datum.ellipsoid;
        const { x, y, z, h } = this;

        const m = (1 - f) * (1 - f); // (1−f)² = b²/a²
        const n = b / Math.sqrt(x * x / m + y * y / m + z * z);

        const xʹ = n * x / m + x * h;
        const yʹ = n * y / m + y * h;
        const zʹ = n * z + z * h;

        return new Cartesian_Nvector(xʹ, yʹ, zʹ);
    }

    //returns a string representation of 'this' (unit) n-vector, height component is only shown if dpHeight is specified
    toString(dp = 3, dpHeight = null) {
        const { x, y, z } = this;
        const h = `${this.h >= 0 ? '+' : ''}${this.h.toFixed(dpHeight)}m`;

        return `[${x.toFixed(dp)},${y.toFixed(dp)},${z.toFixed(dp)}${dpHeight == null ? '' : h}]`;
    }

}

/* CARTESIAN - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*/

//cartesian_Nvector extends Cartesian with method to convert cartesian coordinates to n-vectors

class Cartesian_Nvector extends Cartesian {
    //converts 'this' cartesian coordinate to an n-vector
    toNvector(datum = LatLonEllipsoidal.datums.WGS84) {
        const { a, f } = datum.ellipsoid;
        const { x, y, z } = this;

        const e2 = 2 * f - f * f; // e² = 1st eccentricity squared ≡ (a²-b²)/a²
        const e4 = e2 * e2;     // e⁴

        const p = (x * x + y * y) / (a * a);
        const q = z * z * (1 - e2) / (a * a);
        const r = (p + q - e4) / 6;
        const s = (e4 * p * q) / (4 * r * r * r);
        const t = Math.cbrt(1 + s + Math.sqrt(2 * s + s * s));
        const u = r * (1 + t + 1 / t);
        const v = Math.sqrt(u * u + e4 * q);
        const w = e2 * (u + v - q) / (2 * v);
        const k = Math.sqrt(u + v + w * w) - w;
        const d = k * Math.sqrt(x * x + y * y) / (k + e2);

        const tmp = 1 / Math.sqrt(d * d + z * z);
        const xʹ = tmp * k / (k + e2) * x;
        const yʹ = tmp * k / (k + e2) * y;
        const zʹ = tmp * z;
        const h = (k + e2 - 1) / k * Math.sqrt(d * d + z * z);

        const n = new NvectorEllipsoidal(xʹ, yʹ, zʹ, h, datum);

        return n;
    }

}

/* NORTH-EAST-DOWN (NED) - - - - - - - - - - - - - - - - - - - - - - - - - */

//NED - also known as local tangent plane (LTP), is a vector in the local coordinate frame of a body. 
class Ned {
    //creates a NED vector
    constructor(north, east, down) {
        this.north = north;
        this.east = east;
        this.down = down;
    }

    //Length of NED vector
    get length() {
        const { north, east, down } = this;

        return Math.sqrt(north * north + east * east + down * down);
    }

    //Bearing of NED vector
    get bearing() {
        const θ = Math.atan2(this.east, this.north);

        return Dms.wrap360(θ.toDegrees()); // normalise to range 0..360°
    }

    //Elevation of NED vector
    get elevation() {
        const α = Math.asin(this.down / this.length);

        return -α.toDegrees();
    }

    //creates NED vector from distance, bearing, & elevation (in local corrdinate system)
    static fromDistanceBearingElevation(dist, brng, elev) {
        const θ = Number(brng).toRadians();
        const α = Number(elev).toRadians();
        dist = Number(dist);

        const sinθ = Math.sin(θ), cosθ = Math.cos(θ);
        const sinα = Math.sin(α), cosα = Math.cos(α);

        const n = cosθ * dist * cosα;
        const e = sinθ * dist * cosα;
        const d = -sinα * dist;

        return new Ned(n, e, d);
    }

    //returns a string representation of 'this' NED vector
    toString(dp = 0) {
        return `[N:${this.north.toFixed(dp)},E:${this.east.toFixed(dp)},D:${this.down.toFixed(dp)}]`;
    }

}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */

export { LatLon_NvectorEllipsoidal as default, NvectorEllipsoidal as Nvector, Cartesian_Nvector as Cartesian, Ned, Dms };
