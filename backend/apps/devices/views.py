from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.devices.models import Device
from apps.devices.serializers import (
    DeviceSerializer,
    DeviceSyncRequestSerializer,
)
from apps.node.models.nodeDetails.models import Node


class DeviceViewSet(viewsets.ModelViewSet):
    """
    CRUD API for device registry across greenhouses.
    """
    queryset = Device.objects.all().order_by('-registered_at')
    serializer_class = DeviceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        node_id = self.request.query_params.get('node')
        device_type = self.request.query_params.get('type')
        if node_id:
            qs = qs.filter(node__node_id=node_id)
        if device_type:
            qs = qs.filter(device_type=device_type)
        return qs


class DeviceSyncView(APIView):
    """
    POST /api/v1/devices/sync/
    Receives connected devices registry from Raspberry Pi edge node.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = DeviceSyncRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        node_id_str = data.get('node_id')
        devices_data = data.get('devices', [])

        node_obj = Node.objects.filter(node_id=node_id_str).first()

        synced_count = 0
        for d in devices_data:
            dev_id = d.get('device_id')
            Device.objects.update_or_create(
                device_id=dev_id,
                defaults={
                    'node': node_obj,
                    'device_type': d.get('device_type', 'sensor'),
                    'name': d.get('name') or dev_id,
                    'revoked': d.get('revoked', False),
                }
            )
            synced_count += 1

        return Response(
            {
                "status": "success",
                "synced_devices": synced_count,
                "node_id": node_id_str,
            },
            status=status.HTTP_200_OK,
        )
