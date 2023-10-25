Imports System.Math

Module LatLonEllipsoidal_Vincenty
    Const π As Double = Math.PI
    Const ε As Double = Double.Epsilon

    ''' <summary>
    ''' Extends LatLonEllipsoidal with methods for calculating distances and bearings between points,
    ''' and destination points given distances and initial bearings, accurate to within 0.5mm distance,
    ''' 0.000015″ bearing.
    ''' </summary>
    Public Class LatLonEllipsoidal_Vincenty
        Inherits LatLonEllipsoidal

        Public Sub New(ByVal lat As Double, ByVal lon As Double, ByVal height As Double, ByVal datum As LatLonEllipsoidal_Datum)
            MyBase.New(lat, lon, height, datum)
        End Sub

        ''' <summary>
        ''' Returns the distance between ‘this’ point and destination point along a geodesic on the
        ''' surface of the ellipsoid, using Vincenty inverse solution.
        ''' </summary>
        ''' <param name="point">Latitude/longitude of the destination point.</param>
        ''' <returns>Distance in meters between points or NaN if failed to converge.</returns>
        Public Function DistanceTo(ByVal point As LatLonEllipsoidal) As Double
            Try
                Dim dist As Double = Me.Inverse(point).Distance
                Return Math.Round(dist, 3) ' round to 1mm precision
            Catch e As Exception
                If TypeOf e Is EvalError Then
                    Return Double.NaN ' λ > π or failed to converge
                End If
                Throw e
            End Try
        End Function

        ''' <summary>
        ''' Returns the initial bearing to travel along a geodesic from ‘this’ point to the given point,
        ''' using Vincenty inverse solution.
        ''' </summary>
        ''' <param name="point">Latitude/longitude of the destination point.</param>
        ''' <returns>Initial bearing in degrees from north (0°..360°) or NaN if failed to converge.</returns>
        Public Function InitialBearingTo(ByVal point As LatLonEllipsoidal) As Double
            Try
                Dim brng As Double = Me.Inverse(point).InitialBearing
                Return Math.Round(brng, 7) ' round to 0.001″ precision
            Catch e As Exception
                If TypeOf e Is EvalError Then
                    Return Double.NaN ' λ > π or failed to converge
                End If
                Throw e
            End Try
        End Function

        ''' <summary>
        ''' Returns the final bearing having traveled along a geodesic from ‘this’ point to the given
        ''' point, using Vincenty inverse solution.
        ''' </summary>
        ''' <param name="point">Latitude/longitude of the destination point.</param>
        ''' <returns>Final bearing in degrees from north (0°..360°) or NaN if failed to converge.</returns>
        Public Function FinalBearingTo(ByVal point As LatLonEllipsoidal) As Double
            Try
                Dim brng As Double = Me.Inverse(point).FinalBearing
                Return Math.Round(brng, 7) ' round to 0.001″ precision
            Catch e As Exception
                If TypeOf e Is EvalError Then
                    Return Double.NaN ' λ > π or failed to converge
                End If
                Throw e
            End Try
        End Function

        ''' <summary>
        ''' Returns the destination point having traveled the given distance along a geodesic given by
        ''' initial bearing from ‘this’ point, using Vincenty direct solution.
        ''' </summary>
        ''' <param name="distance">Distance traveled along the geodesic in meters.</param>
        ''' <param name="initialBearing">Initial bearing in degrees from north.</param>
        ''' <returns>Destination point.</returns>
        Public Function DestinationPoint(ByVal distance As Double, ByVal initialBearing As Double) As LatLonEllipsoidal
            Dim result = Me.Direct(distance, initialBearing)
            Return result.Point
        End Function

        ''' <summary>
        ''' Returns the final bearing having traveled along a geodesic given by initial bearing for a
        ''' given distance from ‘this’ point, using Vincenty direct solution.
        ''' </summary>
        ''' <param name="distance">Distance traveled along the geodesic in meters.</param>
        ''' <param name="initialBearing">Initial bearing in degrees from north.</param>
        ''' <returns>Final bearing in degrees from north (0°..360°).</returns>
        Public Function FinalBearingOn(ByVal distance As Double, ByVal initialBearing As Double) As Double
            Dim brng As Double = Me.Direct(distance, initialBearing).FinalBearing
            Return Math.Round(brng, 7) ' round to 0.001″ precision
        End Function

        ''' <summary>
        ''' Returns the point at the given fraction between ‘this’ point and the given point.
        ''' </summary>
        ''' <param name="point">Latitude/longitude of the destination point.</param>
        ''' <param name="fraction">Fraction between the two points (0 = this point, 1 = specified point).</param>
        ''' <returns>Intermediate point between this point and destination point.</returns>
        Public Function IntermediatePointTo(ByVal point As LatLonEllipsoidal, ByVal fraction As Double) As LatLonEllipsoidal
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

        ' Vincenty direct calculation
        Private Function Direct(ByVal distance As Double, ByVal initialBearing As Double) As DirectResult
            If Double.IsNaN(distance) Then
                Throw New ArgumentException("Invalid distance")
            End If
            If distance = 0 Then
                Return New DirectResult(Me, Double.NaN, 0)
            End If
            If Double.IsNaN(initialBearing) Then
                Throw New ArgumentException("Invalid bearing")
            End If
            If Me.Height <> 0 Then
                Throw New ArgumentOutOfRangeException("Point must be on the surface of the ellipsoid")
            End If

            Dim φ1 = Me.Latitude.ToRadians()
            Dim λ1 = Me.Longitude.ToRadians()
            Dim α1 = initialBearing.ToRadians()
            Dim s = distance

            Dim ellipsoid = If(Me.Datum IsNot Nothing, Me.Datum.Ellipsoid, LatLonEllipsoidal.ellipsoids.WGS84)
            Dim a = ellipsoid.A
            Dim b = ellipsoid.B
            Dim f = ellipsoid.F

            Dim sinα1 = Math.Sin(α1)
            Dim cosα1 = Math.Cos(α1)

            Dim tanU1 = (1 - f) * Math.Tan(φ1)
            Dim cosU1 = 1 / Math.Sqrt(1 + tanU1 * tanU1)
