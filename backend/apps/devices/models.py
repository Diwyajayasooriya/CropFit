from django.db import models
from apps.node.models.nodeDetails.models import Node


class Device(models.Model):
    DEVICE_TYPES = [
        ('sensor', 'Sensor'),
        ('actuator', 'Actuator'),
    ]

    node = models.ForeignKey(Node, on_delete=models.SET_NULL, null=True, blank=True, related_name='registered_devices')
    device_id = models.CharField(max_length=100, unique=True, db_index=True)
    device_type = models.CharField(max_length=50, choices=DEVICE_TYPES)
    name = models.CharField(max_length=150, null=True, blank=True)
    mac_address = models.CharField(max_length=50, null=True, blank=True)
    revoked = models.BooleanField(default=False)
    registered_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name or self.device_id} ({self.device_type}) - {'Active' if not self.revoked else 'Revoked'}"
