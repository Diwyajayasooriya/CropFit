from django.urls import path
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from .services.LoginService import RegistrationView, UserMeView, OnboardingStatusView
from .login.views import CustomTokenObtainPairView, AdminTokenObtainPairView

urlpatterns = [
    path("register/", RegistrationView.as_view(), name="register"),
    # Standard Farmer Token
    path("token/", CustomTokenObtainPairView.as_view(), name="token"),
    # Secure Administrator Token
    path("admin/token/", AdminTokenObtainPairView.as_view(), name="admin_token"),
    # get refreshToken
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", UserMeView.as_view(), name="me"),
    path("onboarding-status/", OnboardingStatusView.as_view(), name="onboarding-status"),
]