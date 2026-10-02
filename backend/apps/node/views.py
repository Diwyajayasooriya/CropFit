from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.node.models.nodeDetails.models import Node
from apps.node.models.actuators.models import Actuator
from apps.node.sensor.sensors.models import Sensor
from apps.node.serializers import NodeSerializer, SensorSerializer, ActuatorSerializer
from apps.node.sensor.sensorServices.postSensorData import PostSensorData


from apps.authentication.Permitions.permissions import IsAdmin, IsFarmer, IsTechnician

class NodeViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Greenhouse Nodes (Raspberry Pi hubs / Gateways).
    """
    queryset = Node.objects.all().order_by('-created_at')
    serializer_class = NodeSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return [IsFarmer()]

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
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsTechnician()]
        return [IsFarmer()]


class ActuatorViewSet(viewsets.ModelViewSet):
    queryset = Actuator.objects.all()
    serializer_class = ActuatorSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsTechnician()]
        return [IsFarmer()]

    @action(detail=True, methods=['post'])
    def command(self, request, pk=None):
        """
        POST /api/v1/nodes/actuators/{id}/command/
        Also accessible via /api/v1/actuators/{id}/command/
        Payload: { "action": "ON" | "OFF" }
        """
        # Lookup by PK or actuator_id
        actuator = None
        if str(pk).isdigit():
            actuator = Actuator.objects.filter(id=int(pk)).first()
        if not actuator:
            actuator = Actuator.objects.filter(actuator_id=pk).first()

        if not actuator:
            return Response({"error": f"Actuator '{pk}' not found."}, status=status.HTTP_404_NOT_FOUND)

        action_cmd = request.data.get('action', '').upper()
        if action_cmd not in ['ON', 'OFF']:
            return Response({"error": "Payload must include action: 'ON' or 'OFF'"}, status=status.HTTP_400_BAD_REQUEST)

        actuator.is_active = (action_cmd == 'ON')
        actuator.save(update_fields=['is_active'])

        return Response({
            "status": "success",
            "actuator_id": actuator.actuator_id,
            "is_active": actuator.is_active,
            "action": action_cmd,
            "message": f"Actuator {actuator.actuator_id} successfully set to {action_cmd}."
        }, status=status.HTTP_200_OK)


import secrets
from django.utils import timezone
from rest_framework.views import APIView
from apps.greenhouses.models.models import GreenHouse


class ClaimHubView(APIView):
    """
    POST /api/v1/nodes/claim/
    Farmer claims an edge hub using the 8-character claim code found on the QR sticker.
    Binds the device to their greenhouse and generates an authentication token.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        claim_code = request.data.get('claim_code', '').strip().upper()
        greenhouse_id = request.data.get('greenhouse_id')
        node_name = request.data.get('node_name', '').strip()

        if not claim_code:
            return Response({"error": "claim_code is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not greenhouse_id:
            return Response({"error": "greenhouse_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate greenhouse ownership
        greenhouse = GreenHouse.objects.filter(id=greenhouse_id, user=request.user).first()
        if not greenhouse:
            return Response({"error": "Greenhouse not found or you do not have permission to manage it."}, status=status.HTTP_404_NOT_FOUND)

        node = Node.objects.filter(claim_code=claim_code).first()
        if not node:
            return Response({"error": "Invalid claim code. Please check the code on your hub sticker."}, status=status.HTTP_404_NOT_FOUND)

        if node.is_claimed:
            return Response({"error": "This device has already been claimed."}, status=status.HTTP_400_BAD_REQUEST)

        # Generate unique hub authorization token
        hub_token = secrets.token_urlsafe(32)

        node.greenHouse = greenhouse
        node.is_claimed = True
        node.hub_token = hub_token
        node.claimed_at = timezone.now()
        if node_name:
            node.node_name = node_name
        node.save()

        return Response({
            "status": "success",
            "message": "Device successfully claimed and linked to greenhouse.",
            "device_id": node.node_id,
            "node_name": node.node_name,
            "greenhouse_id": greenhouse.id,
            "greenhouse_name": greenhouse.name,
        }, status=status.HTTP_200_OK)


class PollClaimView(APIView):
    """
    GET /api/v1/nodes/poll-claim/?device_id=XXXX
    Polled by the Raspberry Pi after connecting to Wi-Fi.
    Returns whether the device has been claimed by the farmer and its token.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        device_id = request.query_params.get('device_id', '').strip()
        if not device_id:
            return Response({"error": "device_id query parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        node = Node.objects.filter(node_id=device_id).first()
        if not node:
            return Response({
                "status": "not_registered",
                "device_id": device_id,
                "message": "Device ID is not recognized in manufacturing records."
            }, status=status.HTTP_200_OK)

        if not node.is_claimed:
            return Response({
                "status": "unclaimed",
                "device_id": device_id,
                "claim_code": node.claim_code
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "claimed",
            "device_id": node.node_id,
            "hub_token": node.hub_token,
            "greenhouse_id": str(node.greenHouse_id or ""),
            "node_name": node.node_name
        }, status=status.HTTP_200_OK)

