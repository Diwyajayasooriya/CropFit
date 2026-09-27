from django.db import models
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.rules.models import Rule
from apps.rules.serializers import RuleSerializer


from apps.authentication.Permitions.permissions import IsAdmin, IsFarmer

class RuleViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Automation Rules.
    Rules can be global, greenhouse-specific, or node-specific.
    """
    queryset = Rule.objects.all().order_by('-created_at')
    serializer_class = RuleSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return [IsFarmer()]

    def get_queryset(self):
        qs = super().get_queryset()
        greenhouse_id = self.request.query_params.get('greenhouse')
        node_id = self.request.query_params.get('node')
        if greenhouse_id:
            qs = qs.filter(greenhouse_id=greenhouse_id)
        if node_id:
            qs = qs.filter(node_id=node_id)
        return qs

    @action(detail=False, methods=['get'], url_path='export/(?P<node_id>[^/.]+)')
    def export_rules_for_node(self, request, node_id=None):
        """
        Endpoint for Raspberry Pi edge nodes to download active rules for local caching.
        GET /api/v1/rules/export/{node_id}/
        """
        rules = Rule.objects.filter(is_active=True).filter(
            models.Q(node__node_id=node_id) | models.Q(node__isnull=True)
        )
        serializer = self.get_serializer(rules, many=True)
        return Response(serializer.data)
