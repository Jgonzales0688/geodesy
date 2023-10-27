Imports System

' Vector3d class
Public Class Vector3d
    Public Property x As Double
    Public Property y As Double
    Public Property z As Double

    Public Sub New(x As Double, y As Double, z As Double)
        Me.x = x
        Me.y = y
        Me.z = z
    End Sub

    Public Function Length() As Double
        Return Math.Sqrt(x * x + y * y + z * z)
    End Function

    Public Overrides Function ToString() As String
        Return $"({x}, {y}, {z})"
    End Function
End Class

' Dms class
Public Class Dms
    Public Shared Function Wrap360(deg As Double) As Double
        Return If(deg >= 0, deg Mod 360, 360 + (deg Mod 360))
    End Function

    Public Shared Function ToDegrees(radians As Double) As Double
        Return radians * 180.0 / Math.PI
    End Function

    Public Shared Function ToRadians(degrees As Double) As Double
        Return degrees * Math.PI / 180.0
    End Function

    Public Shared Function ToDms(deg As Double) As String
        Dim d As Integer = CInt(Math.Floor(deg))
        Dim m As Integer = CInt(Math.Floor((deg - d) * 60))
        Dim s As Double = ((deg - d) * 60 - m) * 60
        Return $"{d}°{m}'{s}"""
    End Function

    Public Shared Function ParseDms(dms As String) As Double
        Dim parts = dms.Split("°"c, "'"c, """"c)
        If parts.Length <> 3 Then
            Throw New FormatException("Invalid DMS format.")
        End If

        Dim deg As Double = Convert.ToDouble(parts(0))
        Dim min As Double = Convert.ToDouble(parts(1))
        Dim sec As Double = Convert.ToDouble(parts(2))

        Return deg + min / 60 + sec / 3600
    End Function
End Class

' LatLonEllipsoidal class
Public Class LatLonEllipsoidal
    Private _lat As Double
    Private _lon As Double
    Private _height As Double

    Public Property Lat As Double
        Get
            Return _lat
        End Get
        Set(value As Double)
            _lat = Dms.Wrap360(value)
        End Set
    End Property

    Public Property Lon As Double
        Get
            Return _lon
        End Get
        Set(value As Double)
            _lon = Dms.Wrap180(value)
        End Set
    End Property

    Public Property Height As Double
        Get
            Return _height
        End Get
        Set(value As Double)
            _height = value
        End Set
    End Property

    Public Sub New(lat As Double, lon As Double, Optional height As Double = 0)
        _lat = Dms.Wrap360(lat)
        _lon = Dms.Wrap180(lon)
        _height = height
    End Sub

    Public Overrides Function ToString() As String
        Return $"Lat: {_lat}, Lon: {_lon}, Height: {_height}"
    End Function
End Class

' Cartesian class
Public Class Cartesian
    Inherits Vector3d

    Public Sub New(x As Double, y As Double, z As Double)
        MyBase.New(x, y, z)
    End Sub

    Public Function ToLatLon(ellipsoid As Ellipsoid) As LatLonEllipsoidal
        If ellipsoid Is Nothing Then
            ellipsoid = Ellipsoids.WGS84
        End If

        Dim a As Double = ellipsoid.A
        Dim b As Double = ellipsoid.B
        Dim f As Double = ellipsoid.F

        Dim e2 As Double = 2 * f - f * f
        Dim ε2 As Double = e2 / (1 - e2)
        Dim p As Double = Math.Sqrt(x * x + y * y)
        Dim R As Double = Math.Sqrt(p * p + z * z)

        Dim tanβ As Double = (b * z) / (a * p) * (1 + ε2 * b / R)
        Dim sinβ As Double = tanβ / Math.Sqrt(1 + tanβ * tanβ)
        Dim cosβ As Double = sinβ / tanβ

        Dim φ As Double
        If Not Double.IsNaN(cosβ) Then
            φ = Math.Atan2(z + ε2 * b * sinβ * sinβ * sinβ, p - e2 * a * cosβ * cosβ * cosβ)
        Else
            φ = 0
        End If

        Dim λ As Double = Math.Atan2(y, x)

        Dim sinφ As Double = Math.Sin(φ)
        Dim cosφ As Double = Math.Cos(φ)
        Dim ν As Double = a / Math.Sqrt(1 - e2 * sinφ * sinφ)
        Dim h As Double = p * cosφ + z * sinφ - (a * a / ν)

        Return New LatLonEllipsoidal(Dms.ToDegrees(φ), Dms.ToDegrees(λ), h)
    End Function

    Public Overrides Function ToString() As String
        Return $"Cartesian: {MyBase.ToString()}"
    End Function
End Class

' Ellipsoid class
Public Class Ellipsoid
    Public Property A As Double
    Public Property B As Double
    Public Property F As Double

    Public Sub New(a As Double, b As Double, f As Double)
        Me.A = a
        Me.B = b
        Me.F = f
    End Sub
End Class

' Ellipsoids class
Public Class Ellipsoids
    Public Shared ReadOnly WGS84 As New Ellipsoid(6378137, 6356752.314245, 1 / 298.257223563)
End Class
