Imports System

Namespace YourNamespace

    Public Class Vector3d

        Public Property x As Double
        Public Property y As Double
        Public Property z As Double

        Public Sub New(ByVal x As Double, ByVal y As Double, ByVal z As Double)
            If Double.IsNaN(x) OrElse Double.IsNaN(y) OrElse Double.IsNaN(z) Then
                Throw New ArgumentException("Invalid vector [" & x & "," & y & "," & z & "]")
            End If

            Me.x = x
            Me.y = y
            Me.z = z
        End Sub

        Public ReadOnly Property Length() As Double
            Get
                Return Math.Sqrt(Me.x * Me.x + Me.y * Me.y + Me.z * Me.z)
            End Get
        End Property

        Public Function Plus(ByVal v As Vector3d) As Vector3d
            If v Is Nothing Then
                Throw New ArgumentNullException("v is not Vector3d object")
            End If

            Return New Vector3d(Me.x + v.x, Me.y + v.y, Me.z + v.z)
        End Function

        Public Function Minus(ByVal v As Vector3d) As Vector3d
            If v Is Nothing Then
                Throw New ArgumentNullException("v is not Vector3d object")
            End If

            Return New Vector3d(Me.x - v.x, Me.y - v.y, Me.z - v.z)
        End Function

        Public Function Times(ByVal x As Double) As Vector3d
            Return New Vector3d(Me.x * x, Me.y * x, Me.z * x)
        End Function

        Public Function DividedBy(ByVal x As Double) As Vector3d
            Return New Vector3d(Me.x / x, Me.y / x, Me.z / x)
        End Function

        Public Function Dot(ByVal v As Vector3d) As Double
            If v Is Nothing Then
                Throw New ArgumentNullException("v is not Vector3d object")
            End If

            Return Me.x * v.x + Me.y * v.y + Me.z * v.z
        End Function

        Public Function Cross(ByVal v As Vector3d) As Vector3d
            If v Is Nothing Then
                Throw New ArgumentNullException("v is not Vector3d object")
            End If

            Dim x As Double = Me.y * v.z - Me.z * v.y
            Dim y As Double = Me.z * v.x - Me.x * v.z
            Dim z As Double = Me.x * v.y - Me.y * v.x

            Return New Vector3d(x, y, z)
        End Function

        Public Function Negate() As Vector3d
            Return New Vector3d(-Me.x, -Me.y, -Me.z)
        End Function

        Public Function Unit() As Vector3d
            Dim norm As Double = Me.Length

            If norm = 1 OrElse norm = 0 Then
                Return Me
            End If

            Dim x As Double = Me.x / norm
            Dim y As Double = Me.y / norm
            Dim z As Double = Me.z / norm

            Return New Vector3d(x, y, z)
        End Function

        Public Function AngleTo(ByVal v As Vector3d, Optional ByVal n As Vector3d = Nothing) As Double
            If v Is Nothing Then
                Throw New ArgumentNullException("v is not Vector3d object")
            End If

            If n IsNot Nothing AndAlso Not TypeOf n Is Vector3d Then
                Throw New ArgumentException("n is not Vector3d object")
            End If

            Dim sign As Integer = If(n Is Nothing OrElse Me.Cross(v).Dot(n) >= 0, 1, -1)
            Dim sinθ As Double = Me.Cross(v).Length * sign
            Dim cosθ As Double = Me.Dot(v)

            Return Math.Atan2(sinθ, cosθ)
        End Function

        Public Function RotateAround(ByVal axis As Vector3d, ByVal angle As Double) As Vector3d
            If axis Is Nothing Then
                Throw New ArgumentNullException("axis is not Vector3d object")
            End If

            Dim θ As Double = angle.ToRadians()
            Dim p As Vector3d = Me.Unit()
            Dim a As Vector3d = axis.Unit()
            Dim s As Double = Math.Sin(θ)
            Dim c As Double = Math.Cos(θ)
            Dim t As Double = 1 - c
            Dim x As Double = a.x, y As Double = a.y, z As Double = a.z

            Dim r(2, 2) As Double
            Dim rp(2) As Double

            r(0, 0) = t * x * x + c
            r(0, 1) = t * x * y - s * z
            r(0, 2) = t * x * z + s * y
            r(1, 0) = t * x * y + s * z
            r(1, 1) = t * y * y + c
            r(1, 2) = t * y * z - s * x
            r(2, 0) = t * x * z - s * y
            r(2, 1) = t * y * z + s * x
            r(2, 2) = t * z * z + c

            rp(0) = r(0, 0) * p.x + r(0, 1) * p.y + r(0, 2) * p.z
            rp(1) = r(1, 0) * p.x + r(1, 1) * p.y + r(1, 2) * p.z
            rp(2) = r(2, 0) * p.x + r(2, 1) * p.y + r(2, 2) * p.z

            Dim p2 As New Vector3d(rp(0), rp(1), rp(2))

            Return p2
        End Function

        Public Overrides Function ToString() As String
            Return "[" & Me.x.ToString("F3") & "," & Me.y.ToString("F3") & "," & Me.z.ToString("F3") & "]"
        End Function
    End Class

    <System.Runtime.CompilerServices.Extension()>
    Public Shared Function ToRadians(ByVal value As Double) As Double
        Return value * Math.PI / 180.0
    End Function

    <System.Runtime.CompilerServices.Extension()>
    Public Shared Function ToDegrees(ByVal value As Double) As Double
        Return value * 180.0 / Math.PI
    End Function

End Namespace

