from django.db import models

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

    def __str__(self):
        return f"{self.actuator_type} ({self.actuator_id})"