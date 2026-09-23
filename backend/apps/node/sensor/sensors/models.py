from django.db import models

from apps.node.models.nodeDetails.models import Node


class Sensor(models.Model):
    node = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name="sensors"
    )
    sensor_id = models.CharField(max_length=100, unique=True)
    sensor_type = models.CharField(max_length=50)
    unit = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)