from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.conditions.views import ConditionViewSet, ConditionReadingViewSet, BulkSyncView

router = DefaultRouter()
router.register(r'thresholds', ConditionViewSet, basename='condition-threshold')
router.register(r'readings', ConditionReadingViewSet, basename='condition-reading')

urlpatterns = [
    path('bulk-sync/', BulkSyncView.as_view(), name='conditions-bulk-sync'),
    path('', include(router.urls)),
]
