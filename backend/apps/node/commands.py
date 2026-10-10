from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission
from apps.node.models.actuators.models import Actuator, ActuatorCommand
from config.permissions import HasEdgeSyncToken


def expire_commands(queryset):
    queryset.filter(status__in=['pending', 'delivered'], expires_at__lte=timezone.now()).update(status='expired', completed_at=timezone.now(), error='No hardware confirmation before the deadline.')


def command_data(command):
    return {'id': str(command.id), 'actuator_id': command.actuator.actuator_id,
            'action': command.action, 'status': command.status,
            'created_at': command.created_at.isoformat(),
            'expires_at': command.expires_at.isoformat(), 'error': command.error}


def enqueue_command(actuator, action):
    with transaction.atomic():
        actuator = Actuator.objects.select_for_update().get(pk=actuator.pk)
        expire_commands(actuator.commands.all())
        pending = actuator.commands.filter(status__in=['pending', 'delivered']).first()
        if pending:
            return Response(command_data(pending), status=status.HTTP_409_CONFLICT)
        command = ActuatorCommand.objects.create(actuator=actuator, action=action, expires_at=timezone.now() + timedelta(minutes=2))
    return Response(command_data(command), status=status.HTTP_202_ACCEPTED)


class DeviceCommandPermission(BasePermission):
    def has_permission(self, request, view):
        # Fleet-wide tokens are deliberately insufficient for command delivery.
        return HasEdgeSyncToken().has_permission(request, view) and getattr(request, 'node', None) is not None


class CommandPollView(APIView):
    authentication_classes = []
    permission_classes = [DeviceCommandPermission]

    def get(self, request):
        commands = ActuatorCommand.objects.filter(actuator__node=request.node)
        expire_commands(commands)
        command = commands.filter(status__in=['pending', 'delivered']).select_related('actuator').first()
        if not command:
            return Response({'commands': []})
        ActuatorCommand.objects.filter(pk=command.pk, status='pending').update(status='delivered')
        command.refresh_from_db()
        return Response({'commands': [command_data(command)]})


class AckSerializer(serializers.Serializer):
    command_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=['confirmed', 'failed'])
    is_active = serializers.BooleanField(required=False)
    error = serializers.CharField(max_length=200, required=False, allow_blank=True)


class CommandAckView(APIView):
    authentication_classes = []
    permission_classes = [DeviceCommandPermission]

    def post(self, request):
        serializer = AckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            command = ActuatorCommand.objects.select_for_update().filter(pk=data['command_id'], actuator__node=request.node).select_related('actuator').first()
            if not command:
                return Response({'error': 'Command not found.'}, status=404)
            expire_commands(ActuatorCommand.objects.filter(pk=command.pk))
            command.refresh_from_db()
            if command.status in ['confirmed', 'failed', 'expired']:
                return Response(command_data(command))
            if data['status'] == 'confirmed' and data.get('is_active') != (command.action == 'ON'):
                return Response({'error': 'Hardware state does not match the requested action.'}, status=400)
            command.status = data['status']
            command.error = data.get('error', '')
            command.completed_at = timezone.now()
            command.save(update_fields=['status', 'error', 'completed_at'])
            if command.status == 'confirmed':
                Actuator.objects.filter(pk=command.actuator_id).update(is_active=data['is_active'], confirmed_at=command.completed_at)
        return Response(command_data(command))
