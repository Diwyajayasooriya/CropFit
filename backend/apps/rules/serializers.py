from rest_framework import serializers
from apps.rules.models import Rule


class RuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rule
        fields = [
            'id',
            'greenhouse',
            'node',
            'rule_id',
            'name',
            'sensor_device_id',
            'field',
            'condition',
            'threshold',
            'actuator_device_id',
            'command_payload',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
