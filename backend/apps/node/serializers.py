from rest_framework import serializers
from apps.node.models.nodeDetails.models import Node
from apps.node.models.actuators.models import Actuator
from apps.node.sensor.sensors.models import Sensor


class SensorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sensor
        fields = ['id', 'node', 'sensor_id', 'sensor_type', 'unit', 'is_active']


class ActuatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Actuator
        fields = ['id', 'node', 'actuator_id', 'actuator_type', 'is_active']


class NodeSerializer(serializers.ModelSerializer):
    sensors = SensorSerializer(many=True, read_only=True)
    actuators = ActuatorSerializer(many=True, read_only=True)

    class Meta:
        model = Node
        fields = [
            'id',
            'greenHouse',
            'node_id',
            'node_name',
            'node_type',
            'mac_address',
            'created_at',
            'last_updated',
            'sensors',
            'actuators',
        ]
        read_only_fields = ['id', 'created_at', 'last_updated']
