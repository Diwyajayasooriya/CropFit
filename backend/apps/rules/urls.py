from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.rules.views import RuleViewSet

router = DefaultRouter()
router.register(r'', RuleViewSet, basename='rule')

urlpatterns = [
    path('', include(router.urls)),
]
