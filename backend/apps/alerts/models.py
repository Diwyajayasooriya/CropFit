from django.db import models
from apps.greenhouses.models.models import GreenHouse
from apps.node.models.nodeDetails.models import Node


class Alert(models.Model):
    SEVERITY_CHOICES = [
        ('info', 'Information'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]

    greenhouse = models.ForeignKey(GreenHouse, on_delete=models.CASCADE, related_name='alerts', null=True, blank=True)
    node = models.ForeignKey(Node, on_delete=models.SET_NULL, null=True, blank=True, related_name='alerts')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='warning')
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.severity.upper()}] {self.title} - {'Resolved' if self.is_resolved else 'Active'}"
