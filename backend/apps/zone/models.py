from django.db import models

# Create your models here.
class Zone(models.Model):
    name=models.CharField(max_length=200,unique=True)
    description=models.TextField()
    
    