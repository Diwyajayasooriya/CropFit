from django.urls import path
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from .services.LoginService import RegistrationView
from .login.views import CustomTokenObtainPairView

urlpatterns = [
    path("register/", RegistrationView.as_view(), name="register"),
    #user token
    path("token/", CustomTokenObtainPairView.as_view(), name="token"),
    #get refreshToken
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]