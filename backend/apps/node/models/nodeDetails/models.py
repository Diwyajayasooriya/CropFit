from django.db import models

from apps.greenhouses.models.models import GreenHouse


class Node(models.Model):
    greenHouse = models.ForeignKey(GreenHouse, on_delete=models.CASCADE, related_name='nodes', null=True, blank=True)
    node_id = models.CharField(max_length=100, unique=True)
    node_name = models.CharField(max_length=100)
    node_type = models.CharField(max_length=100, default='gateway')
    mac_address = models.CharField(max_length=100, blank=True, null=True)
    claim_code = models.CharField(max_length=32, unique=True, null=True, blank=True)
    is_claimed = models.BooleanField(default=False)
    hub_token = models.CharField(max_length=128, blank=True, null=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.node_name} ({self.node_id})"