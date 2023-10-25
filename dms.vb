```vbnet
Imports System.Globalization

''' <summary>
''' Latitude/longitude points may be represented as decimal degrees or subdivided into sexagesimal minutes and seconds.
''' This class provides methods for parsing and representing degrees/minutes/seconds.
''' </summary>
Public Class Dms
    ''' <summary>
    ''' Separator character to be used to separate degrees, minutes, seconds, and cardinal directions.
    ''' Default separator is a narrow no-break space (U+202F).
    ''' To change this (e.g., to an empty string or full space), set Dms.separator prior to invoking formatting.
    ''' </summary>
    Public Shared Property Separator As String = " " ' U+202F = 'narrow no-break space'

    ''' <summary>
    ''' Parses a string representing degrees/minutes/seconds into numeric degrees.
    ''' This is very flexible on formats, allowing signed decimal degrees or deg-min-sec optionally suffixed by compass direction (NSEW).
    ''' Thousands/decimal separators must be comma/dot; use Dms.FromLocale to convert locale-specific thousands/decimal separators.
    ''' </summary>
    ''' <param name="dms">Degrees or deg/min/sec in a variety of formats.</param>
    ''' <returns>Degrees as a decimal number.</returns>
    Public Shared Function Parse(dms As String) As Double
        ' Check for signed decimal degrees without NSEW; if so, return it directly
        If Double.TryParse(dms, CultureInfo.InvariantCulture, NumberStyles.Any, Nothing, Nothing) Then
            Return Double.Parse(dms, CultureInfo.InvariantCulture)
        End If

        ' Strip off any sign or compass dir'n & split out separate d/m/s
        dms = dms.Trim()
        dms = dms.TrimStart("-"c)
        dms = dms.TrimEnd("NnSsEeWw")

        Dim dmsParts() As String = dms.Split(New Char() {" "c, "'"c, "′"c, "″"c}, StringSplitOptions.RemoveEmptyEntries)

        If dmsParts.Length = 0 Then
            Return Double.NaN
        End If

        Dim deg As Double = Double.NaN

        Select Case dmsParts.Length
            Case 3 ' Interpret 3-part result as d/m/s
                deg = Double.Parse(dmsParts(0), CultureInfo.InvariantCulture) + Double.Parse(dmsParts(1), CultureInfo.InvariantCulture) / 60 + Double.Parse(dmsParts(2), CultureInfo.InvariantCulture) / 3600
            Case 2 ' Interpret 2-part result as d/m
                deg = Double.Parse(dmsParts(0), CultureInfo.InvariantCulture) + Double.Parse(dmsParts(1), CultureInfo.InvariantCulture) / 60
            Case 1 ' Just d (possibly decimal) or non-separated dddmmss
                deg = Double.Parse(dmsParts(0), CultureInfo.InvariantCulture)
                ' Check for fixed-width unseparated format, e.g., 0033709W
                ' If (New Regex("[NS]", RegexOptions.IgnoreCase)).IsMatch(dmsParts(0)) Then
                '     deg = "0" + deg
                ' End If
                ' If (New Regex("[0-9]{7}")).IsMatch(deg) Then
                '     deg = deg.Substring(0, 3) + deg.Substring(3, 2) / 60 + deg.Substring(5) / 3600
                ' End If
        End Select

        If dmsParts.Length > 0 AndAlso (dms.TrimEnd()(0) = "-"c OrElse (New Regex("[WSws]")).IsMatch(dms.Trim())) Then
            deg = -deg
        End If

        Return deg
    End Function

    ''' <summary>
    ''' Converts decimal degrees to deg/min/sec format.
    ''' Degree, prime, double-prime symbols are added, but the sign is discarded, though no compass direction is added.
    ''' Degrees are zero-padded to 3 digits; for degrees latitude, use .Substring(1) to remove the leading zero.
    ''' </summary>
    ''' <param name="deg">Degrees to be formatted as specified.</param>
    ''' <param name="format">Return value as 'd', 'dm', 'dms' for deg, deg+min, deg+min+sec.</param>
    ''' <param name="dp">Number of decimal places to use – default 4 for d, 2 for dm, 0 for dms.</param>
    ''' <returns>Degrees formatted as deg/min/secs according to the specified format.</returns>
    Private Shared Function ToDms(deg As Double, Optional format As String = "d", Optional dp As Integer = 4) As String
        If Double.IsNaN(deg) Then
            Return Nothing
        End If

        Dim dms As String = Nothing, d As String = Nothing, m As String = Nothing, s As String = Nothing

        Select Case format
            Case "d", "deg"
                d = deg.ToString("F" & dp, CultureInfo.InvariantCulture)
                If d.Length < 6 Then
                    d = "0" & d
                End If
                dms = d & "°"
            Case "dm", "deg+min"
                d = Math.Floor(deg).ToString().PadLeft(3, "0"c)
                m = ((deg * 60) Mod 60).ToString("F" & dp, CultureInfo.InvariantCulture)
                If m = "60" Then
                    m = (0).ToString("F" & dp, CultureInfo.InvariantCulture)
                    d += 1
                End If
                If m.Length < 4 Then
                    m = "0" & m
                End If
                dms = d & "°" & Separator & m & "′"
            Case "dms", "deg+min+sec"
                d = Math.Floor(deg).ToString().PadLeft(3, "0"c)
                m = Math.Floor((deg * 3600) / 60) Mod 60
                s = (deg * 3600 Mod 60).ToString("F" & dp, CultureInfo.InvariantCulture)
                If s = "60" Then
                    s = (0).ToString("F" & dp, CultureInfo.InvariantCulture)
                    m += 1
                End If
                If m = 60 Then
                    m = 0
                    d += 1
                End If
                If m.ToString().Length < 2 Then
                    m = "0" & m
                End If
                If s.Length < 4 Then
                    s = "0" & s
                End If
                dms = d & "°" & Separator & m & "′" & Separator & s & "″"
        End Select

        Return dms
    End Function

    ''' <summary>
    ''' Converts numeric degrees to deg/min/sec latitude (2-digit degrees, suffixed with N/S).
    ''' </summary>
    ''' <param name="deg">Degrees to be formatted as specified.</param>
    ''' <param name="format">Return value as 'd', 'dm', 'dms' for deg, deg+min, deg+min+sec.</param>
   