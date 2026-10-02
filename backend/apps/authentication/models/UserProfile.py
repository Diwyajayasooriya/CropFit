from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    # Role is now handled in the User model to avoid redundancy.
    # Add other profile specific fields here (e.g., bio, address)
    onboarding_completed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - Profile"