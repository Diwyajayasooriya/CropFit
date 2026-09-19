from rest_framework import serializers

from apps.conditions.models.models import Condition


class SensorSerializer(serializers.ModelSerializer):
    class Meta:
        model=Condition
        fields="__all__"

        read_only_fields=["timeStamp","created_at","last_updated","condition_type"]
