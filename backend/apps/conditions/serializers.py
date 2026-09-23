from rest_framework import serializers
from apps.conditions.models.models import Condition, ConditionReading


class ConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Condition
        fields = '__all__'
        read_only_fields = ['id', 'timeStamp', 'created_at', 'last_updated']


class ConditionReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConditionReading
        fields = [
            'id',
            'node',
            'device_id',
            'temperature',
            'humidity',
            'soil_moisture',
            'payload',
            'reading_ts',
            'received_at',
        ]
        read_only_fields = ['id', 'received_at']


class BulkReadingItemSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=100)
    payload = serializers.DictField()
    reading_ts = serializers.IntegerField()
    received_ts = serializers.IntegerField(required=False)


class BulkSyncRequestSerializer(serializers.Serializer):
    node_id = serializers.CharField(max_length=100)
    greenhouse_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    readings = BulkReadingItemSerializer(many=True)
