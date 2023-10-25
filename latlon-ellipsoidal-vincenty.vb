Imports System

Public Module VincentyDirectInverse
    Private Const π As Double = Math.PI
    Private Const ε As Double = Double.Epsilon

    Public Class LatLonEllipsoidal_Vincenty
        Inherits LatLonEllipsoidal

        Public Sub New(latitude As Double, longitude As Double, Optional height As Double = 0, Optional datum As Datum = Nothing)
            MyBase.New(latitude, longitude, height, datum)
        End Sub

        Public Function DistanceTo(point As LatLonEllipsoidal) As Double
            Try
                Dim dist = Me.Inverse(point).Distance
                Return Math.Round(dist, 3) ' round to 1mm precision
            Catch ex As Exception
                If TypeOf ex Is EvalException Then
                    Return Double.NaN ' λ > π or failed to converge
                End If
                Throw ex
            End Try
        End Function

        Public Function InitialBearingTo(point As LatLonEllipsoidal) As Double
            Try
                Dim brng = Me.Inverse(point).InitialBearing
                Return Math.Round(brng, 7) ' round to 0.001″ precision
            Catch ex As Exception
                If TypeOf ex Is EvalException Then
                    Return Double.NaN ' λ > π or failed to converge
                End If
                Throw ex
            End Try
        End Function

        Public Function FinalBearingTo(point As LatLonEllipsoidal) As Double
            Try
                Dim brng = Me.Inverse(point).FinalBearing
                Return Math.Round(brng, 7) ' round to 0.001″ precision
            Catch ex As Exception
                If TypeOf ex Is EvalException Then
                    Return Double.NaN ' λ > π or failed to converge
                End If
                Throw ex
            End Try
        End Function

        Public Function DestinationPoint(distance As Double, initialBearing As Double) As LatLonEllipsoidal
            Return Me.Direct(distance, initialBearing).Point
        End Function

        Public Function FinalBearingOn(distance As Double, initialBearing As Double) As Double
            Dim brng = Me.Direct(distance, initialBearing).FinalBearing
            Return Math.Round(brng, 7) ' round to 0.001″ precision
        End Function

        Public Function IntermediatePointTo(point As LatLonEllipsoidal, fraction As Double) As LatLonEllipsoidal
            If fraction = 0 Then
                Return Me
            ElseIf fraction = 1 Then
                Return point
            End If

            Dim inverse = Me.Inverse(point)
            Dim dist = inverse.Distance
            Dim brng = inverse.InitialBearing

            If Double.IsNaN(brng) Then
                Return Me
            Else
                Return Me.DestinationPoint(dist * fraction, brng)
            End If
        End Function

        Private Function Direct(distance As Double, initialBearing As Double) As Object
            If Double.IsNaN(distance) Then
                Throw New ArgumentException("Invalid distance")
            End If

            If distance = 0 Then
                Return New With {.Point = Me, .FinalBearing = Double.NaN, .Iterations = 0}
            End If

            If Double.IsNaN(initialBearing) Then
                Throw New ArgumentException("Invalid bearing")
            End If

            If Me.Height <> 0 Then
                Throw New ArgumentOutOfRangeException("Point must be on the surface of the ellipsoid")
            End If

            Dim φ1 = MathExtensions.ToRadians(Me.Latitude)
            Dim λ1 = MathExtensions.ToRadians(Me.Longitude)
            Dim α1 = MathExtensions.ToRadians(initialBearing)
            Dim s = distance

            Dim ellipsoid = If(Me.Datum IsNot Nothing, Me.Datum.Ellipsoid, LatLonEllipsoidal.Ellipsoids.WGS84)
            Dim a = ellipsoid.A
            Dim b = ellipsoid.B
            Dim f = ellipsoid.F

            Dim sinα1 = Math.Sin(α1)
            Dim cosα1 = Math.Cos(α1)

            Dim tanU1 = (1 - f) * Math.Tan(φ1)
            Dim cosU1 = 1 / Math.Sqrt(1 + tanU1 * tanU1)
            Dim sinU1 = tanU1 * cosU1
            Dim σ1 = Math.Atan2(tanU1, cosα1)
            Dim sinα = cosU1 * sinα1
            Dim cosSqα = 1 - sinα * sinα
            Dim uSq = cosSqα * (a * a - b * b) / (b * b)
            Dim A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)))
            Dim B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)))

            Dim σ = s / (b * A)
            Dim sinσ As Double = 0
            Dim cosσ As Double = 0
            Dim cos2σₘ As Double = 0
            Dim σʹ As Double = 0
            Dim iterations As Integer = 0

            Do
                cos2σₘ = Math.Cos(2 * σ1 + σ)
                sinσ = Math.Sin(σ)
                cosσ = Math.Cos(σ)
                Dim Δσ = B * sinσ * (cos2σₘ + B / 4 * (cosσ * (-1 + 2 * cos2σₘ * cos2σₘ) - B / 6 * cos2σₘ * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σₘ * cos2σₘ)))
                σʹ = σ
                σ = s / (b * A) + Δσ
            Loop While Math.Abs(σ - σʹ) > 1e-12 AndAlso iterations < 100

            If iterations >= 100 Then
                Throw New EvalException("Vincenty formula failed to converge")
            End If

            Dim x = sinU1 * sinσ - cosU1 * cosσ * cosα1
            Dim φ2 = Math.Atan2(sinU1 * cosσ + cosU1 * sinσ * cosα1, (1 - f) * Math.Sqrt(sinα * sinα + x * x))
            Dim λ = Math.Atan2(sinσ * sinα1, cosU1 * cosσ - sinU1 * sinσ * cosα1)
            Dim C = f / 16 * cosSqα * (4 + f * (4 - 3 * cosSqα))
            Dim L = λ - (1 - C) * f * sinα * (σ + C * sinσ * (cos2σₘ + C * cosσ * (-1 + 2 * cos2σₘ * cos2σₘ)))
            Dim λ2 = λ1 + L
            Dim α2 = Math.Atan2(sinα, -x)

            Dim destinationPoint = New LatLonEllipsoidal_Vincenty(MathExtensions.ToDegrees(φ2), MathExtensions.ToDegrees(λ2), 0, Me.Datum)

            Return New With {.Point = destinationPoint, .FinalBearing = Dms.Wrap360(MathExtensions.ToDegrees(α2)), .Iterations = iterations}
        End Function
    End Class
End Module

Public Class EvalException
    Inherits Exception
    Public Sub New(message As String)
        MyBase.New(message)
    End Sub
End Class

Public Class MathExtensions
    Public Shared Function ToRadians(degrees As Double) As Double
        Return degrees * Math.PI / 180
    End Function

    Public Shared Function ToDegrees(radians As Double) As Double
        Return radians * 180 / Math.PI
    End Function
End Class

Public Class Dms
    Public Shared Function Wrap360(degrees As Double) As Double
        Return If(degrees < 0, (degrees Mod 360) + 360, degrees Mod 360)
    End Function
End Class
