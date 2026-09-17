
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    email = models.EmailField(unique=True)
    
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("tech", "Technician"),
        ("farmer", "Farmer"),
    ]
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="farmer",
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.username