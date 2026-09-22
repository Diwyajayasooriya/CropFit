from django.db import models
from apps.greenhouses.models.models import GreenHouse
from apps.node.models.nodeDetails.models import Node


class Rule(models.Model):
    CONDITION_CHOICES = [
        ('below', 'Below (<)'),
        ('above', 'Above (>)'),
        ('equals', 'Equals (==)'),
    ]

    greenhouse = models.ForeignKey(GreenHouse, on_delete=models.CASCADE, related_name='rules', null=True, blank=True)
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='rules', null=True, blank=True)
    rule_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    sensor_device_id = models.CharField(max_length=100)
    field = models.CharField(max_length=50, help_text="e.g. temperature, humidity, soil_moisture")
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    threshold = models.FloatField()
    actuator_device_id = models.CharField(max_length=100)
    command_payload = models.JSONField(default=dict, help_text="JSON payload to dispatch, e.g. {'action': 'on', 'duration_s': 120}")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.rule_id}): IF {self.field} {self.condition} {self.threshold}"
