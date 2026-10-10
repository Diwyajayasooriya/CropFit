from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.node.commands import CommandPollView, CommandAckView

from apps.node.views import (
    NodeViewSet,
    SensorViewSet,
    ActuatorViewSet,
    NodeBootstrapView,
    NodeClaimView,
    NodePollClaimView,
    NodeExchangeTokenView,
    NodeHeartbeatView,
)
from apps.node.sensor.sensorServices.postSensorData import PostSensorData

router = DefaultRouter()
router.register(r'nodes', NodeViewSet, basename='node')
router.register(r'sensors', SensorViewSet, basename='sensor')
router.register(r'actuators', ActuatorViewSet, basename='actuator')

urlpatterns = [
    path('commands/poll/', CommandPollView.as_view(), name='command-poll'),
    path('commands/ack/', CommandAckView.as_view(), name='command-ack'),
    path('bootstrap/', NodeBootstrapView.as_view(), name='node-bootstrap'),
    path('claim/', NodeClaimView.as_view(), name='hub-claim'),
    path('poll-claim/', NodePollClaimView.as_view(), name='hub-poll-claim'),
    path('exchange-token/', NodeExchangeTokenView.as_view(), name='node-exchange-token'),
    path('heartbeat/', NodeHeartbeatView.as_view(), name='node-heartbeat'),
    path('sensordata/', PostSensorData.as_view(), name='condition-create'),
    path('', include(router.urls)),
]
