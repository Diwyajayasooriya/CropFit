from django.db import models

from apps.greenhouses.models.models import GreenHouse
from apps.node.models.nodeDetails.models import Node


class Condition(models.Model):
    """Represents a condition in the system."""
    greenhouse=models.ForeignKey(GreenHouse,on_delete=models.CASCADE,related_name='conditions')
    """which greenhouse this condition is associated with"""

    node=models.ForeignKey(Node,on_delete=models.CASCADE,related_name='conditions')
    """which node this condition is associated with"""

    timeStamp = models.DateTimeField(auto_now_add=True)
    condition_id = models.CharField(max_length=100, unique=True)
    """Name of the condition (e.g., Temperature, Humidity, etc.)"""
    condition_type = models.CharField(max_length=100)


    """Type of condition (e.g., temperature, humidity, etc.)"""
    threshold_value = models.FloatField()

    """The threshold value for the condition."""
    created_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    """The last time the condition was updated."""


    def __str__(self):
        return f"{self.condition_name} ({self.condition_id}) "
