from django.db import models
from apps.greenhouses.models.models import GreenHouse
from apps.node.models.nodeDetails.models import Node


class Condition(models.Model):
    """Represents a condition or threshold configuration in the system."""
    greenhouse = models.ForeignKey(GreenHouse, on_delete=models.CASCADE, related_name='conditions')
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='conditions')
    condition_id = models.CharField(max_length=100, unique=True)
    condition_type = models.CharField(max_length=100)
    threshold_value = models.FloatField()
    timeStamp = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.condition_type} ({self.condition_id})"


class ConditionReading(models.Model):
    """
    Time-series sensor readings synced from Raspberry Pi edge nodes.
    Supports bulk-insertion from sync_service.py.
    """
    node = models.ForeignKey(Node, on_delete=models.SET_NULL, null=True, blank=True, related_name='readings')
    device_id = models.CharField(max_length=100, db_index=True)
    temperature = models.FloatField(null=True, blank=True)
    humidity = models.FloatField(null=True, blank=True)
    soil_moisture = models.FloatField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    reading_ts = models.BigIntegerField(db_index=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-reading_ts']
        indexes = [
            models.Index(fields=['device_id', '-reading_ts']),
        ]

    def __str__(self):
        return f"{self.device_id} @ {self.reading_ts}"
