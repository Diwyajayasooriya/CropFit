from django.db import models

from apps.greenhouses.models.models import GreenHouse


class Node(models.Model):
    greenHouse=models.ForeignKey(GreenHouse,on_delete=models.CASCADE,related_name='nodes')
    node_id = models.CharField(max_length=100, unique=True)
    node_name = models.CharField(max_length=100)
    node_type = models.CharField(max_length=100)
    mac_address = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.node_name} ({self.node_id})"