from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.alerts.models import Alert
from apps.alerts.serializers import AlertSerializer
from apps.authentication.Permitions.permissions import IsFarmer
from rest_framework.exceptions import PermissionDenied


class AlertViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Alerts and Notification management.
    """
    queryset = Alert.objects.all().order_by('-created_at')
    serializer_class = AlertSerializer
    permission_classes = [IsFarmer]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            qs = qs.filter(greenhouse__user=user)
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

    def save_alert(self, serializer):
        greenhouse = serializer.validated_data.get('greenhouse', getattr(serializer.instance, 'greenhouse', None))
        node = serializer.validated_data.get('node', getattr(serializer.instance, 'node', None))
        user = self.request.user
        if not (user.is_superuser or getattr(user, 'role', '') == 'admin'):
            if not greenhouse or greenhouse.user_id != user.id or (node and node.greenHouse_id != greenhouse.id):
                raise PermissionDenied('Choose one of your own greenhouses.')
        serializer.save()

    perform_create = save_alert
    perform_update = save_alert

    @action(detail=True, methods=['patch'])
    def acknowledge(self, request, pk=None):
        """Mark an alert as resolved/acknowledged."""
        alert = self.get_object()
        alert.is_resolved = True
        alert.resolved_at = timezone.now()
        alert.save()
        return Response(self.get_serializer(alert).data, status=status.HTTP_200_OK)
