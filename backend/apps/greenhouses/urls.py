from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.greenhouses.views import GreenHouseViewSet

router = DefaultRouter()
router.register(r'', GreenHouseViewSet, basename='greenhouse')

urlpatterns = [
    path('', include(router.urls)),
]
