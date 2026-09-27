from rest_framework import serializers
from apps.greenhouses.models.models import GreenHouse


class GreenHouseSerializer(serializers.ModelSerializer):
    node_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = GreenHouse
        fields = [
            'id',
            'user',
            'name',
            'location',
            'crop',
            'plantation_date',
            'created_at',
            'node_count',
        ]
        read_only_fields = ['id', 'created_at', 'node_count']

    def get_node_count(self, obj):
        return obj.nodes.count() if hasattr(obj, 'nodes') else 0
