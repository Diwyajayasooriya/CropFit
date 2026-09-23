from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from apps.authentication.Serializers.serializers import UserSerializer
from apps.authentication.Permitions.permissions import IsAdmin


class UserMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class RegistrationView(APIView):
    permission_classes = [IsAdmin] #only admin can register users

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    #login logic
    def post(self,request):

        if request.user.is_authenticated:
            return Response(
                {
                    "message":"login successful",
                    "user": {
                        "username": request.user.username,
                        "role": request.user.role
                    }
                },status=200
            )
        else:
            return Response(
                {
                    "message":"Login failed"
                }, status=status.HTTP_401_UNAUTHORIZED
            )


