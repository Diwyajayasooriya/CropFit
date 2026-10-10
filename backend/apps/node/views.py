from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
import secrets

from apps.node.models.nodeDetails.models import Node
from apps.node.models.actuators.models import Actuator
from apps.node.sensor.sensors.models import Sensor
from apps.node.serializers import NodeSerializer, SensorSerializer, ActuatorSerializer
from apps.node.sensor.sensorServices.postSensorData import PostSensorData


from apps.authentication.Permitions.permissions import IsAdmin, IsFarmer, IsTechnician

from config.permissions import HasEdgeSyncToken
from apps.greenhouses.models.models import GreenHouse
from apps.node.commands import enqueue_command, expire_commands, command_data


class NodeViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Greenhouse Nodes (Raspberry Pi hubs / Gateways).
    Farmers can view and manage their claimed nodes.
    """
    serializer_class = NodeSerializer

    def get_permissions(self):
        if self.action in ['config']:
            return [permissions.AllowAny()]
        return [IsFarmer()]

    def get_queryset(self):
        user = self.request.user
        qs = Node.objects.all().order_by('-created_at')
        if not user.is_authenticated:
            return Node.objects.none()
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            qs = qs.filter(greenHouse__user=user)

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

    @action(detail=False, methods=['get'], url_path='config', authentication_classes=[])
    def config(self, request):
        """
        GET /api/v1/nodes/config/?node_id=GN-HUB-001
        Called by Raspberry Pi edge gateway using Bearer <hub_token> to pull
        its authorized sensors and actuators configured by the farmer.
        """
        auth_header = request.headers.get("Authorization", "")
        node_id = request.query_params.get("node_id", "").strip()
        node = None

        if auth_header.startswith("Bearer ") and HasEdgeSyncToken().has_permission(request, self):
            node = getattr(request, 'node', None)

        if not node and node_id:
            # If farmer is logged in, verify ownership
            if request.user.is_authenticated:
                node = Node.objects.filter(node_id=node_id, greenHouse__user=request.user).first()

        if not node:
            return Response(
                {"error": "Unauthorized or unknown node. Provide a valid Bearer hub_token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        sensors_data = [
            {
                "id": s.id,
                "sensor_id": s.sensor_id,
                "sensor_type": s.sensor_type,
                "unit": s.unit,
                "is_active": s.is_active,
            }
            for s in node.sensors.all()
        ]

        actuators_data = [
            {
                "id": a.id,
                "actuator_id": a.actuator_id,
                "actuator_type": a.actuator_type,
                "is_active": a.is_active,
            }
            for a in node.actuators.all()
        ]

        return Response({
            "node_id": node.node_id,
            "node_name": node.node_name,
            "greenhouse_id": node.greenHouse_id,
            "greenhouse_name": node.greenHouse.name if node.greenHouse else None,
            "is_claimed": node.is_claimed,
            "sensors": sensors_data,
            "actuators": actuators_data,
        }, status=status.HTTP_200_OK)


class SensorViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Sensors.
    Farmers can add, update, and remove sensors under their claimed nodes.
    """
    serializer_class = SensorSerializer
    permission_classes = [IsFarmer]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Sensor.objects.none()
        if user.is_superuser or getattr(user, 'role', '') == 'admin':
            return Sensor.objects.all()
        return Sensor.objects.filter(node__greenHouse__user=user)

    def perform_create(self, serializer):
        user = self.request.user
        node = serializer.validated_data.get('node')
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if not node or node.greenHouse.user != user:
                raise permissions.exceptions.PermissionDenied(
                    "You can only add sensors to nodes in your own greenhouses."
                )
        serializer.save()


class ActuatorViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Actuators.
    Farmers can add, update, and remove actuators under their claimed nodes.
    """
    serializer_class = ActuatorSerializer
    permission_classes = [IsFarmer]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Actuator.objects.none()
        if user.is_superuser or getattr(user, 'role', '') == 'admin':
            return Actuator.objects.all()
        return Actuator.objects.filter(node__greenHouse__user=user)

    def perform_create(self, serializer):
        user = self.request.user
        node = serializer.validated_data.get('node')
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if not node or node.greenHouse.user != user:
                raise permissions.exceptions.PermissionDenied(
                    "You can only add actuators to nodes in your own greenhouses."
                )
        serializer.save()


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
            actuator = self.get_queryset().filter(id=int(pk)).first()
        if not actuator:
            actuator = self.get_queryset().filter(actuator_id=pk).first()

        if not actuator:
            return Response({"error": f"Actuator '{pk}' not found."}, status=status.HTTP_404_NOT_FOUND)

        action_cmd = str(request.data.get('action', '')).upper()
        if action_cmd not in ['ON', 'OFF']:
            return Response({"error": "Payload must include action: 'ON' or 'OFF'"}, status=status.HTTP_400_BAD_REQUEST)

        return enqueue_command(actuator, action_cmd)

    @action(detail=True, methods=['get'], url_path='command-status')
    def command_status(self, request, pk=None):
        actuator = self.get_object()
        expire_commands(actuator.commands.all())
        command = actuator.commands.order_by('-created_at').first()
        return Response({'command': command_data(command) if command else None,
                         'is_active': actuator.is_active, 'confirmed_at': actuator.confirmed_at})


from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from apps.greenhouses.models.models import GreenHouse
from apps.node.serializers import (
    NodeBootstrapSerializer,
    NodeClaimSerializer,
    NodeHeartbeatSerializer,
    TokenExchangeSerializer,
)


class NodeBootstrapView(APIView):
    """
    POST /api/v1/nodes/bootstrap/
    Unclaimed Pi announces presence upon first connecting to Wi-Fi.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = NodeBootstrapSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        node, created = Node.objects.get_or_create(
            node_id=data["device_id"],
            defaults={
                "node_name": f"GreenNode {data['device_id']}",
                "claim_code": data.get("claim_code") or secrets.token_hex(3).upper(),
                "software_version": data.get("software_version", "0.1.0"),
                "hardware_info": data.get("hardware", "Raspberry Pi 4B"),
                "ip_address": data.get("ip_address"),
                "last_seen": timezone.now(),
            }
        )

        if not created:
            node.software_version = data.get("software_version", node.software_version)
            node.hardware_info = data.get("hardware", node.hardware_info)
            if data.get("ip_address"):
                node.ip_address = data["ip_address"]
            node.last_seen = timezone.now()
            node.save(update_fields=["software_version", "hardware_info", "ip_address", "last_seen"])

        return Response({
            "status": "claimed" if node.is_claimed else "waiting_for_claim",
            "device_id": node.node_id,
            "is_claimed": node.is_claimed,
        }, status=status.HTTP_200_OK)


class NodeClaimView(APIView):
    """
    POST /api/v1/nodes/claim/
    Farmer claims an edge hub using device_id + claim_code.
    Validates ownership, prevents brute-forcing, links to greenhouse,
    and creates a 10-minute one-time exchange token.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = NodeClaimSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        device_id = data["device_id"].strip()
        claim_code = data["claim_code"].strip().upper()
        greenhouse_id = data["greenhouse_id"]

        with transaction.atomic():
            greenhouse = GreenHouse.objects.filter(id=greenhouse_id, user=request.user).first()
            if not greenhouse:
                return Response(
                    {"error": "Greenhouse not found or you lack permission to manage it."},
                    status=status.HTTP_404_NOT_FOUND
                )

            node = Node.objects.select_for_update().filter(node_id=device_id).first()
            if not node:
                # Try fallback matching by claim_code
                node = Node.objects.select_for_update().filter(claim_code=claim_code).first()

            if not node:
                return Response(
                    {"error": f"Device '{device_id}' is not recognized in records."},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Brute-force lockout check
            if node.claim_locked_until and timezone.now() < node.claim_locked_until:
                remaining = int((node.claim_locked_until - timezone.now()).total_seconds())
                return Response(
                    {"error": f"Too many failed claim attempts. Try again in {remaining} seconds.",
                     "retry_after_seconds": max(1, remaining)},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )

            if node.is_claimed:
                return Response(
                    {"error": "This device has already been claimed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not secrets.compare_digest(node.claim_code.upper(), claim_code):
                node.failed_claim_attempts += 1
                if node.failed_claim_attempts >= 5:
                    node.claim_locked_until = timezone.now() + timedelta(minutes=15)
                    node.failed_claim_attempts = 0
                node.save(update_fields=["failed_claim_attempts", "claim_locked_until"])
                return Response(
                    {"error": "Invalid claim code. Please check the sticker on your hub."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Generate one-time exchange token (valid 10 minutes)
            one_time_token = f"cft_exch_{secrets.token_urlsafe(24)}"
            node.greenHouse = greenhouse
            node.is_claimed = True
            node.claimed_at = timezone.now()
            node.failed_claim_attempts = 0
            node.claim_locked_until = None
            node.one_time_claim_token = one_time_token
            node.one_time_token_expires_at = timezone.now() + timedelta(minutes=10)
            
            # Generate permanent hub token & hash immediately as well for backward compatibility
            raw_token = f"cft_sec_live_{secrets.token_urlsafe(32)}"
            node.set_hub_token(raw_token)
            node.save()

        return Response({
            "status": "success",
            "message": f"Device {node.node_id} successfully linked to {greenhouse.name}.",
            "device_id": node.node_id,
            "greenhouse_id": greenhouse.id,
            "greenhouse_name": greenhouse.name,
        }, status=status.HTTP_200_OK)


# Keep ClaimHubView alias for backward compatibility
ClaimHubView = NodeClaimView


class NodePollClaimView(APIView):
    """
    GET /api/v1/nodes/poll-claim/?device_id=XXXX
    Polled by the Raspberry Pi after connecting to Wi-Fi.
    Returns ephemeral exchange token and permanent token once claimed.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        device_id = request.query_params.get("device_id", "").strip()
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
                "status": "waiting",
                "device_id": device_id,
                "claim_code": node.claim_code
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "claimed",
            "device_id": node.node_id,
            "exchange_token": node.one_time_claim_token or "",
            "hub_token": node.hub_token or "",
            "greenhouse_id": str(node.greenHouse_id or ""),
            "node_name": node.node_name,
        }, status=status.HTTP_200_OK)


# Keep PollClaimView alias
PollClaimView = NodePollClaimView


class NodeExchangeTokenView(APIView):
    """
    POST /api/v1/nodes/exchange-token/
    Raspberry Pi exchanges its one-time claim token for permanent SHA-256 hashed Bearer credential.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = TokenExchangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            node = Node.objects.select_for_update().filter(node_id=data["device_id"]).first()
            if not node or not node.one_time_claim_token:
                # If already exchanged, fallback to existing token
                if node and node.hub_token:
                    return Response({
                        "status": "provisioned",
                        "device_id": node.node_id,
                        "hub_token": node.hub_token,
                    }, status=status.HTTP_200_OK)
                return Response({"error": "Invalid exchange request"}, status=status.HTTP_400_BAD_REQUEST)

            if not secrets.compare_digest(node.one_time_claim_token, data["exchange_token"]):
                return Response({"error": "Invalid exchange token"}, status=status.HTTP_403_FORBIDDEN)

            raw_hub_token = f"cft_sec_live_{secrets.token_urlsafe(32)}"
            node.set_hub_token(raw_hub_token)
            node.one_time_claim_token = None
            node.one_time_token_expires_at = None
            node.save()

        return Response({
            "status": "provisioned",
            "device_id": node.node_id,
            "hub_token": raw_hub_token,
        }, status=status.HTTP_200_OK)


class NodeHeartbeatView(APIView):
    """
    POST /api/v1/nodes/heartbeat/
    Periodic heartbeat from edge Pi. Authenticated using Bearer <hub_token>.
    """
    permission_classes = [HasEdgeSyncToken]
    authentication_classes = []

    def post(self, request):
        serializer = NodeHeartbeatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        node = getattr(request, "node", None)
        if not node:
            node = Node.objects.filter(node_id=data["device_id"]).first()

        if not node:
            return Response({"error": "Node not found"}, status=status.HTTP_404_NOT_FOUND)

        node.last_seen = timezone.now()
        if data.get("ip_address"):
            node.ip_address = data["ip_address"]
        if data.get("software_version"):
            node.software_version = data["software_version"]
        if data.get("uptime_seconds") is not None:
            node.uptime_seconds = data["uptime_seconds"]

        node.save(update_fields=["last_seen", "ip_address", "software_version", "uptime_seconds"])

        return Response({
            "status": "acknowledged",
            "server_time": timezone.now().isoformat(),
            "is_online": True,
        }, status=status.HTTP_200_OK)
