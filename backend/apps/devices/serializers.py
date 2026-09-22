from rest_framework import serializers
from apps.devices.models import Device


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            'id',
            'node',
            'device_id',
            'device_type',
            'name',
            'mac_address',
            'revoked',
            'registered_at',
            'last_seen',
        ]
        read_only_fields = ['id', 'registered_at']


class DeviceSyncItemSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=100)
    device_type = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    revoked = serializers.BooleanField(default=False)
    registered_ts = serializers.IntegerField(required=False)


class DeviceSyncRequestSerializer(serializers.Serializer):
    node_id = serializers.CharField(max_length=100)
    devices = DeviceSyncItemSerializer(many=True)
