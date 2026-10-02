from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.node.views import NodeViewSet, SensorViewSet, ActuatorViewSet, ClaimHubView, PollClaimView
from apps.node.sensor.sensorServices.postSensorData import PostSensorData

router = DefaultRouter()
router.register(r'nodes', NodeViewSet, basename='node')
router.register(r'sensors', SensorViewSet, basename='sensor')
router.register(r'actuators', ActuatorViewSet, basename='actuator')

urlpatterns = [
    path('claim/', ClaimHubView.as_view(), name='hub-claim'),
    path('poll-claim/', PollClaimView.as_view(), name='hub-poll-claim'),
    path('sensordata/', PostSensorData.as_view(), name='condition-create'),
    path('', include(router.urls)),
]