from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.node.models.nodeDetails.models import Node
from apps.node.models.actuators.models import Actuator
from apps.node.sensor.sensors.models import Sensor
from apps.node.serializers import NodeSerializer, SensorSerializer, ActuatorSerializer
from apps.node.sensor.sensorServices.postSensorData import PostSensorData


class NodeViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Greenhouse Nodes (Raspberry Pi hubs / Gateways).
    """
    queryset = Node.objects.all().order_by('-created_at')
    serializer_class = NodeSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        greenhouse_id = self.request.query_params.get('greenhouse')
        if greenhouse_id:
            qs = qs.filter(greenHouse_id=greenhouse_id)
        return qs

    @action(detail=True, methods=['get'])
    def sensors(self, request, pk=None):
        node = self.get_object()
        sensors = node.sensors.all()
        serializer = SensorSerializer(sensors, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def actuators(self, request, pk=None):
        node = self.get_object()
        actuators = node.actuators.all()
        serializer = ActuatorSerializer(actuators, many=True)
        return Response(serializer.data)


class SensorViewSet(viewsets.ModelViewSet):
    queryset = Sensor.objects.all()
    serializer_class = SensorSerializer
    permission_classes = [permissions.AllowAny]


class ActuatorViewSet(viewsets.ModelViewSet):
    queryset = Actuator.objects.all()
    serializer_class = ActuatorSerializer
    permission_classes = [permissions.AllowAny]
