from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.devices.views import DeviceViewSet, DeviceSyncView

router = DefaultRouter()
router.register(r'', DeviceViewSet, basename='device')

urlpatterns = [
    path('sync/', DeviceSyncView.as_view(), name='device-sync'),
    path('', include(router.urls)),
]
