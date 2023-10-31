/* Vector handling functions                                          (c) Chris Veness 2011-2019  */


class Vector3d {

    //Creates a 3-d vector.

    constructor(x, y, z) {
        if (isNaN(x) || isNaN(y) || isNaN(z)) throw new TypeError(`invalid vector [${x},${y},${z}]`);

        this.x = Number(x);
        this.y = Number(y);
        this.z = Number(z);
    }

    //Length (magnitude or norm) of 'this' vector.
    get length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    //Adds supplied vector to 'this' vector
    plus(v) {
        if (!(v instanceof Vector3d)) throw new TypeError('v is not Vector3d object');

        return new Vector3d(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    //subtracts supplied vector from 'this' vector
    minus(v) {
        if (!(v instanceof Vector3d)) throw new TypeError('v is not Vector3d object');

        return new Vector3d(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    //multiplies 'this' vector by a scalar value
    times(x) {
        if (isNaN(x)) throw new TypeError(`invalid scalar value ‘${x}’`);

        return new Vector3d(this.x * x, this.y * x, this.z * x);
    }

    //divides ;this; vector by a scalar value
    dividedBy(x) {
        if (isNaN(x)) throw new TypeError(`invalid scalar value ‘${x}’`);

        return new Vector3d(this.x / x, this.y / x, this.z / x);
    }

    //multiplies 'this' vector by the supplied vector using dot (scalar) product
    dot(v) {
        if (!(v instanceof Vector3d)) throw new TypeError('v is not Vector3d object');

        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    //multiplies 'this' vector by the supplied vector using cross (vector) product
    cross(v) {
        if (!(v instanceof Vector3d)) throw new TypeError('v is not Vector3d object');

        const x = this.y * v.z - this.z * v.y;
        const y = this.z * v.x - this.x * v.z;
        const z = this.x * v.y - this.y * v.x;

        return new Vector3d(x, y, z);
    }

    //negates a vector to point in the opposite direction
    negate() {
        return new Vector3d(-this.x, -this.y, -this.z);
    }

    //Normalizes a vector to its unit vector - if the vector is already unit or is zero magnitude, this is a no-op
    unit() {
        const norm = this.length;
        if (norm == 1) return this;
        if (norm == 0) return this;

        const x = this.x / norm;
        const y = this.y / norm;
        const z = this.z / norm;

        return new Vector3d(x, y, z);
    }

    //calculates the angle between 'this' vector and supplied vector
    angleTo(v, n = undefined) {
        if (!(v instanceof Vector3d)) throw new TypeError('v is not Vector3d object');
        if (!(n instanceof Vector3d || n == undefined)) throw new TypeError('n is not Vector3d object');

        // q.v. stackoverflow.com/questions/14066933#answer-16544330, but n·p₁×p₂ is numerically
        // ill-conditioned, so just calculate sign to apply to |p₁×p₂|

        // if n·p₁×p₂ is -ve, negate |p₁×p₂|
        const sign = n == undefined || this.cross(v).dot(n) >= 0 ? 1 : -1;

        const sinθ = this.cross(v).length * sign;
        const cosθ = this.dot(v);

        return Math.atan2(sinθ, cosθ);
    }

    //rotates 'this' point around an axis by a specified angle
    rotateAround(axis, angle) {
        if (!(axis instanceof Vector3d)) throw new TypeError('axis is not Vector3d object');

        const θ = angle.toRadians();

        // en.wikipedia.org/wiki/Rotation_matrix#Rotation_matrix_from_axis_and_angle
        // en.wikipedia.org/wiki/Quaternions_and_spatial_rotation#Quaternion-derived_rotation_matrix
        const p = this.unit();
        const a = axis.unit();

        const s = Math.sin(θ);
        const c = Math.cos(θ);
        const t = 1 - c;
        const x = a.x, y = a.y, z = a.z;

        const r = [ // rotation matrix for rotation about supplied axis
            [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
            [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
            [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
        ];

        // multiply r × p
        const rp = [
            r[0][0] * p.x + r[0][1] * p.y + r[0][2] * p.z,
            r[1][0] * p.x + r[1][1] * p.y + r[1][2] * p.z,
            r[2][0] * p.x + r[2][1] * p.y + r[2][2] * p.z,
        ];
        const p2 = new Vector3d(rp[0], rp[1], rp[2]);

        return p2;
        // qv en.wikipedia.org/wiki/Rodrigues'_rotation_formula...
    }

    //string representation of vector
    toString(dp = 3) {
        return `[${this.x.toFixed(dp)},${this.y.toFixed(dp)},${this.z.toFixed(dp)}]`;
    }
}

// Extend Number object with methods to convert between degrees & radians
Number.prototype.toRadians = function () { return this * Math.PI / 180; };
Number.prototype.toDegrees = function () { return this * 180 / Math.PI; };

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

export default Vector3d;