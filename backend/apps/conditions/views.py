from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from apps.conditions.models.models import Condition, ConditionReading
from apps.conditions.serializers import (
    ConditionSerializer,
    ConditionReadingSerializer,
    BulkSyncRequestSerializer,
)
from apps.node.models.nodeDetails.models import Node
from rest_framework.permissions import AllowAny, IsAuthenticated
from apps.authentication.Permitions.permissions import IsFarmer
from config.permissions import HasEdgeSyncToken


class ConditionViewSet(viewsets.ModelViewSet):
    """CRUD API for condition thresholds."""
    queryset = Condition.objects.all().order_by('-timeStamp')
    serializer_class = ConditionSerializer
    permission_classes = [IsFarmer]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            qs = qs.filter(greenhouse__user=user, node__greenHouse__user=user)
        greenhouse = self.request.query_params.get('greenhouse')
        return qs.filter(greenhouse_id=greenhouse) if greenhouse else qs

    def save_condition(self, serializer):
        greenhouse = serializer.validated_data.get('greenhouse', getattr(serializer.instance, 'greenhouse', None))
        node = serializer.validated_data.get('node', getattr(serializer.instance, 'node', None))
        if not node or not greenhouse or node.greenHouse_id != greenhouse.id:
            raise ValidationError('The node must belong to the selected greenhouse.')
        user = self.request.user
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin') and greenhouse.user_id != user.id:
            raise PermissionDenied('Choose one of your own greenhouses.')
        serializer.save()

    perform_create = save_condition
    perform_update = save_condition


class ConditionReadingViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for telemetry history."""
    queryset = ConditionReading.objects.all().order_by('-reading_ts')
    serializer_class = ConditionReadingSerializer
    permission_classes = [IsFarmer]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            qs = qs.filter(node__greenHouse__user=user)
        greenhouse = self.request.query_params.get('greenhouse')
        node = self.request.query_params.get('node')
        if greenhouse:
            qs = qs.filter(node__greenHouse_id=greenhouse)
        if node:
            qs = qs.filter(node_id=node)
        device_id = self.request.query_params.get('device_id')
        hours = self.request.query_params.get('hours')
        if device_id:
            qs = qs.filter(device_id=device_id)
        if hours:
            try:
                import time
                hours_int = int(hours)
                if not 1 <= hours_int <= 168:
                    raise ValueError
                cutoff = int(time.time()) - (hours_int * 3600)
                qs = qs.filter(reading_ts__gte=cutoff)
            except ValueError:
                raise ValidationError({'hours': 'Choose a range between 1 and 168 hours.'})
        return qs[:500] if self.action == 'list' else qs


class BulkSyncView(APIView):
    """
    POST /api/v1/conditions/bulk-sync/
    Receives batch of sensor telemetry readings from Raspberry Pi edge nodes.
    Uses bulk_create for optimal SQL insertion performance.
    """
    permission_classes = [HasEdgeSyncToken]
    authentication_classes = []

    def post(self, request):
        serializer = BulkSyncRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        node_id_str = data.get('node_id')
        readings_data = data.get('readings', [])

        # Look up node
        node_obj = Node.objects.filter(node_id=node_id_str).first()
        authenticated_node = getattr(request, 'node', None)
        if authenticated_node and (not node_obj or node_obj.id != authenticated_node.id):
            raise PermissionDenied('A hub may only sync its own readings.')
        if not node_obj:
            raise ValidationError({'node_id': 'Unknown node.'})

        readings_to_create = []
        for item in readings_data:
            payload = item.get('payload', {})
            temp = payload.get('temperature', payload.get('temp'))
            hum = payload.get('humidity', payload.get('hum'))
            soil = payload.get('soil_moisture', payload.get('soil'))

            readings_to_create.append(
                ConditionReading(
                    node=node_obj,
                    device_id=item.get('device_id'),
                    temperature=float(temp) if temp is not None else None,
                    humidity=float(hum) if hum is not None else None,
                    soil_moisture=float(soil) if soil is not None else None,
                    payload=payload,
                    reading_ts=item.get('reading_ts'),
                )
            )

        if readings_to_create:
            ConditionReading.objects.bulk_create(readings_to_create, batch_size=100)

        return Response(
            {
                "status": "success",
                "synced_count": len(readings_to_create),
                "node_id": node_id_str,
            },
            status=status.HTTP_201_CREATED,
        )
