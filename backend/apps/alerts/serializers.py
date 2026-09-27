from rest_framework import serializers
from apps.alerts.models import Alert


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = [
            'id',
            'greenhouse',
            'node',
            'severity',
            'title',
            'message',
            'is_resolved',
            'resolved_at',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
