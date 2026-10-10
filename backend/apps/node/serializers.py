from rest_framework import serializers
from apps.node.models.nodeDetails.models import Node
from apps.node.models.actuators.models import Actuator
from apps.node.sensor.sensors.models import Sensor


class OwnedNodeSerializer(serializers.ModelSerializer):
    def validate_node(self, node):
        user = self.context['request'].user
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if not node.greenHouse_id or node.greenHouse.user_id != user.id:
                raise serializers.ValidationError('Choose a node in your own greenhouse.')
        return node


class SensorSerializer(OwnedNodeSerializer):
    class Meta:
        model = Sensor
        fields = ['id', 'node', 'sensor_id', 'sensor_type', 'unit', 'is_active']


class ActuatorSerializer(OwnedNodeSerializer):
    class Meta:
        model = Actuator
        fields = ['id', 'node', 'actuator_id', 'actuator_type', 'is_active', 'confirmed_at']
        read_only_fields = ['is_active', 'confirmed_at']


class NodeSerializer(serializers.ModelSerializer):
    sensors = SensorSerializer(many=True, read_only=True)
    actuators = ActuatorSerializer(many=True, read_only=True)
    is_online = serializers.BooleanField(read_only=True)

    def validate_greenHouse(self, greenhouse):
        user = self.context['request'].user
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if not greenhouse or greenhouse.user_id != user.id:
                raise serializers.ValidationError('Choose one of your own greenhouses.')
        return greenhouse

    class Meta:
        model = Node
        fields = [
            'id',
            'greenHouse',
            'node_id',
            'node_name',
            'node_type',
            'mac_address',
            'is_claimed',
            'is_online',
            'last_seen',
            'software_version',
            'hardware_info',
            'ip_address',
            'uptime_seconds',
            'created_at',
            'last_updated',
            'sensors',
            'actuators',
        ]
        read_only_fields = ['id', 'created_at', 'last_updated', 'is_online', 'last_seen', 'is_claimed', 'uptime_seconds', 'software_version', 'hardware_info', 'ip_address']


class NodeBootstrapSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=100)
    claim_code = serializers.CharField(max_length=32, required=False, allow_blank=True)
    software_version = serializers.CharField(max_length=50, required=False, default='0.1.0')
    hardware = serializers.CharField(max_length=100, required=False, default='Raspberry Pi 4B')
    ip_address = serializers.IPAddressField(required=False, allow_null=True)


class NodeClaimSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=100)
    claim_code = serializers.CharField(max_length=32)
    greenhouse_id = serializers.IntegerField()


class NodeHeartbeatSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=100)
    software_version = serializers.CharField(max_length=50, required=False)
    ip_address = serializers.IPAddressField(required=False, allow_null=True)
    uptime_seconds = serializers.IntegerField(required=False, min_value=0)


class TokenExchangeSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=100)
    exchange_token = serializers.CharField(max_length=64)
