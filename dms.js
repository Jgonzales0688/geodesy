/* Geodesy representation conversion functions                        (c) Chris Veness 2002-2020  */

/* Degree-minutes-seconds (& cardinal directions) separator character */
let dmsSeparator = '\u202f'; // U+202F = 'narrow no-break space'

//functions for parsing and representing degrees/minutes/seconds
class Dms {
     /* note Unicode Degree = U+00B0. Prime = U+2032, Double prime = U+2033
      *
      * separator character to be use to separate degrees, minutes, seconds, and cardinal directions
      */

    static get separator() { return dmsSeparator; }
    static set separator(char) { dmsSeparator = char; }

    //parses string representing degree/minutes/seconds into numeric degrees
    static parse(dms) {
        // check for signed decimal degrees without NSEW, if so return it directly
        if (!isNaN(parseFloat(dms)) && isFinite(dms)) return Number(dms);

        // strip off any sign or compass dir'n & split out separate d/m/s
        const dmsParts = String(dms).trim().replace(/^-/, '').replace(/[NSEW]$/i, '').split(/[^0-9.,]+/);
        if (dmsParts[dmsParts.length - 1] == '') dmsParts.splice(dmsParts.length - 1);  // from trailing symbol

        if (dmsParts == '') return NaN;

        // and convert to decimal degrees...
        let deg = null;
        switch (dmsParts.length) {
            case 3:  // interpret 3-part result as d/m/s
                deg = dmsParts[0] / 1 + dmsParts[1] / 60 + dmsParts[2] / 3600;
                break;
            case 2:  // interpret 2-part result as d/m
                deg = dmsParts[0] / 1 + dmsParts[1] / 60;
                break;
            case 1:  // just d (possibly decimal) or non-separated dddmmss
                deg = dmsParts[0];
                // check for fixed-width unseparated format eg 0033709W
                //if (/[NS]/i.test(dmsParts)) deg = '0' + deg;  // - normalise N/S to 3-digit degrees
                //if (/[0-9]{7}/.test(deg)) deg = deg.slice(0,3)/1 + deg.slice(3,5)/60 + deg.slice(5)/3600;
                break;
            default:
                return NaN;
        }
        if (/^-|[WS]$/i.test(dms.trim())) deg = -deg; // take '-', west and south as -ve

        return Number(deg);
    }

    //converts decimal degrees to deg/minsec format
    static toDms(deg, format = 'd', dp = undefined) {
        if (isNaN(deg)) return null;  // give up here if we can't make a number from deg
        if (typeof deg == 'string' && deg.trim() == '') return null;
        if (typeof deg == 'boolean') return null;
        if (deg == Infinity) return null;
        if (deg == null) return null;

        // default values
        if (dp === undefined) {
            switch (format) {
                case 'd': case 'deg': dp = 4; break;
                case 'dm': case 'deg+min': dp = 2; break;
                case 'dms': case 'deg+min+sec': dp = 0; break;
                default: format = 'd'; dp = 4; break; // be forgiving on invalid format
            }
        }


        deg = Math.abs(deg);  // (unsigned result ready for appending compass dir'n)

        let dms = null, d = null, m = null, s = null;
        switch (format) {
            default: // invalid format spec!
            case 'd': case 'deg':
                d = deg.toFixed(dp);                       // round/right-pad degrees
                if (d < 100) d = '0' + d;                    // left-pad with leading zeros (note may include decimals)
                if (d < 10) d = '0' + d;
                dms = d + '°';
                break;
            case 'dm': case 'deg+min':
                d = Math.floor(deg);                       // get component deg
                m = ((deg * 60) % 60).toFixed(dp);           // get component min & round/right-pad
                if (m == 60) { m = (0).toFixed(dp); d++; } // check for rounding up
                d = ('000' + d).slice(-3);                   // left-pad with leading zeros
                if (m < 10) m = '0' + m;                     // left-pad with leading zeros (note may include decimals)
                dms = d + '°' + Dms.separator + m + '′';
                break;
            case 'dms': case 'deg+min+sec':
                d = Math.floor(deg);                       // get component deg
                m = Math.floor((deg * 3600) / 60) % 60;        // get component min
                s = (deg * 3600 % 60).toFixed(dp);           // get component sec & round/right-pad
                if (s == 60) { s = (0).toFixed(dp); m++; } // check for rounding up
                if (m == 60) { m = 0; d++; }               // check for rounding up
                d = ('000' + d).slice(-3);                   // left-pad with leading zeros
                m = ('00' + m).slice(-2);                    // left-pad with leading zeros
                if (s < 10) s = '0' + s;                     // left-pad with leading zeros (note may include decimals)
                dms = d + '°' + Dms.separator + m + '′' + Dms.separator + s + '″';
                break;
        }

        return dms;
    }

    //converts numeric degrees to deg/min/sec latitude
    static toLat(deg, format, dp) {
        const lat = Dms.toDms(Dms.wrap90(deg), format, dp);
        return lat === null ? '–' : lat.slice(1) + Dms.separator + (deg < 0 ? 'S' : 'N');  // knock off initial '0' for lat!
    }

    //convert numeric degrees to deg/min/sec longitude
    static toLon(deg, format, dp) {
        const lon = Dms.toDms(Dms.wrap180(deg), format, dp);
        return lon === null ? '–' : lon + Dms.separator + (deg < 0 ? 'W' : 'E');
    }

    //converts numeric degrees to deg/min/sec as a bearing(0 degrees... 360 degrees)
    static toBrng(deg, format, dp) {
        const brng = Dms.toDms(Dms.wrap360(deg), format, dp);
        return brng === null ? '–' : brng.replace('360', '0');  // just in case rounding took us up to 360°!
    }

    //converts DMS string from locale thousands/decimal separators to JS comma/dot separators for subsequent parsing
    static fromLocale(str) {
        const locale = (123456.789).toLocaleString();
        const separator = { thousands: locale.slice(3, 4), decimal: locale.slice(7, 8) };
        return str.replace(separator.thousands, '⁜').replace(separator.decimal, '.').replace('⁜', ',');
    }

    //Converts DMS string from JavaScript comma/dot thousands/decimal separators to locale separators.
    static toLocale(str) {
        const locale = (123456.789).toLocaleString();
        const separator = { thousands: locale.slice(3, 4), decimal: locale.slice(7, 8) };
        return str.replace(/,([0-9])/, '⁜$1').replace('.', separator.decimal).replace('⁜', separator.thousands);
    }

    //returns compass point (to given precision) for supplied bearing
    static compassPoint(bearing, precision = 3) {
        if (![1, 2, 3].includes(Number(precision))) throw new RangeError(`invalid precision ‘${precision}’`);
        // note precision could be extended to 4 for quarter-winds (eg NbNW), but I think they are little used

        bearing = Dms.wrap360(bearing); // normalise to range 0..360°

        const cardinals = [
            'N', 'NNE', 'NE', 'ENE',
            'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW',
            'W', 'WNW', 'NW', 'NNW'];
        const n = 4 * 2 ** (precision - 1); // no of compass points at req’d precision (1=>4, 2=>8, 3=>16)
        const cardinal = cardinals[Math.round(bearing * n / 360) % n * 16 / n];

        return cardinal;
    }

    //Constrain degrees to range -90..+90 (for latitude); e.g. -91 => -89, 91 => 89.
    static wrap90(degrees) {
        if (-90 <= degrees && degrees <= 90) return degrees; // avoid rounding due to arithmetic ops if within range

        // latitude wrapping requires a triangle wave function; a general triangle wave is
        //     f(x) = 4a/p ⋅ | (x-p/4)%p - p/2 | - a
        // where a = amplitude, p = period, % = modulo; however, JavaScript '%' is a remainder operator
        // not a modulo operator - for modulo, replace 'x%n' with '((x%n)+n)%n'
        const x = degrees, a = 90, p = 360;
        return 4 * a / p * Math.abs((((x - p / 4) % p) + p) % p - p / 2) - a;
    }

    //Constrain degrees to range -180..+180 (for longitude); e.g. -181 => 179, 181 => -179.
    static wrap180(degrees) {
        if (-180 <= degrees && degrees <= 180) return degrees; // avoid rounding due to arithmetic ops if within range

        // longitude wrapping requires a sawtooth wave function; a general sawtooth wave is
        //     f(x) = (2ax/p - p/2) % p - a
        // where a = amplitude, p = period, % = modulo; however, JavaScript '%' is a remainder operator
        // not a modulo operator - for modulo, replace 'x%n' with '((x%n)+n)%n'
        const x = degrees, a = 180, p = 360;
        return (((2 * a * x / p - p / 2) % p) + p) % p - a;
    }

    //Constrain degrees to range 0..360 (for bearings); e.g. -1 => 359, 361 => 1.
    static wrap360(degrees) {
        if (0 <= degrees && degrees < 360) return degrees; // avoid rounding due to arithmetic ops if within range

        // bearing wrapping requires a sawtooth wave function with a vertical offset equal to the
        // amplitude and a corresponding phase shift; this changes the general sawtooth wave function from
        //     f(x) = (2ax/p - p/2) % p - a
        // to
        //     f(x) = (2ax/p) % p
        // where a = amplitude, p = period, % = modulo; however, JavaScript '%' is a remainder operator
        // not a modulo operator - for modulo, replace 'x%n' with '((x%n)+n)%n'
        const x = degrees, a = 180, p = 360;
        return (((2 * a * x / p) % p) + p) % p;
    }

}

    // Extend Number object with methods to convert between degrees & radians
    Number.prototype.toRadians = function () { return this * Math.PI / 180; };
    Number.prototype.toDegrees = function () { return this * 180 / Math.PI; };

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

export default Dms;