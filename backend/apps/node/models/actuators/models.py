from django.db import models
import uuid

from apps.node.models.nodeDetails.models import Node


class Actuator(models.Model):
    node = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name="actuators"
    )
    actuator_id = models.CharField(max_length=100, unique=True)
    actuator_type = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.actuator_type} ({self.actuator_id})"


class ActuatorCommand(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actuator = models.ForeignKey(Actuator, on_delete=models.CASCADE, related_name='commands')
    action = models.CharField(max_length=3, choices=[('ON', 'ON'), ('OFF', 'OFF')])
    status = models.CharField(max_length=12, default='pending', choices=[(s, s) for s in ['pending', 'delivered', 'confirmed', 'failed', 'expired']])
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    error = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['created_at']
        constraints = [models.UniqueConstraint(fields=['actuator'], condition=models.Q(status__in=['pending', 'delivered']), name='one_pending_actuator_command')]
