from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.alerts.models import Alert
from apps.alerts.serializers import AlertSerializer


class AlertViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Alerts and Notification management.
    """
    queryset = Alert.objects.all().order_by('-created_at')
    serializer_class = AlertSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        greenhouse_id = self.request.query_params.get('greenhouse')
        severity = self.request.query_params.get('severity')
        resolved = self.request.query_params.get('resolved')

        if greenhouse_id:
            qs = qs.filter(greenhouse_id=greenhouse_id)
        if severity:
            qs = qs.filter(severity=severity)
        if resolved is not None:
            is_res = resolved.lower() in ('true', '1')
            qs = qs.filter(is_resolved=is_res)

        return qs

    @action(detail=True, methods=['patch'])
    def acknowledge(self, request, pk=None):
        """Mark an alert as resolved/acknowledged."""
        alert = self.get_object()
        alert.is_resolved = True
        alert.resolved_at = timezone.now()
        alert.save()
        return Response(self.get_serializer(alert).data, status=status.HTTP_200_OK)
