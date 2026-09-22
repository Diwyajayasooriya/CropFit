from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.conditions.models.models import Condition, ConditionReading
from apps.conditions.serializers import (
    ConditionSerializer,
    ConditionReadingSerializer,
    BulkSyncRequestSerializer,
)
from apps.node.models.nodeDetails.models import Node


class ConditionViewSet(viewsets.ModelViewSet):
    """CRUD API for condition thresholds."""
    queryset = Condition.objects.all().order_by('-timeStamp')
    serializer_class = ConditionSerializer
    permission_classes = [permissions.AllowAny]


class ConditionReadingViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for telemetry history."""
    queryset = ConditionReading.objects.all().order_by('-reading_ts')
    serializer_class = ConditionReadingSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        device_id = self.request.query_params.get('device_id')
        hours = self.request.query_params.get('hours')
        if device_id:
            qs = qs.filter(device_id=device_id)
        if hours:
            try:
                import time
                cutoff = int(time.time()) - (int(hours) * 3600)
                qs = qs.filter(reading_ts__gte=cutoff)
            except ValueError:
                pass
        return qs[:500]


class BulkSyncView(APIView):
    """
    POST /api/v1/conditions/bulk-sync/
    Receives batch of sensor telemetry readings from Raspberry Pi edge nodes.
    Uses bulk_create for optimal SQL insertion performance.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = BulkSyncRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        node_id_str = data.get('node_id')
        readings_data = data.get('readings', [])

        # Look up node
        node_obj = Node.objects.filter(node_id=node_id_str).first()

        readings_to_create = []
        for item in readings_data:
            payload = item.get('payload', {})
            temp = payload.get('temperature') or payload.get('temp')
            hum = payload.get('humidity') or payload.get('hum')
            soil = payload.get('soil_moisture') or payload.get('soil')

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
