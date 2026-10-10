import hashlib
import secrets
from django.db import models
from django.utils import timezone
from apps.greenhouses.models.models import GreenHouse


class Node(models.Model):
    greenHouse = models.ForeignKey(
        GreenHouse, 
        on_delete=models.CASCADE, 
        related_name='nodes', 
        null=True, 
        blank=True
    )
    node_id = models.CharField(max_length=100, unique=True, db_index=True)
    node_name = models.CharField(max_length=100)
    node_type = models.CharField(max_length=100, default='gateway')
    mac_address = models.CharField(max_length=100, blank=True, null=True)

    # Claim & Factory Identity
    claim_code = models.CharField(max_length=32, unique=True, null=True, blank=True, db_index=True)
    is_claimed = models.BooleanField(default=False, db_index=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    failed_claim_attempts = models.PositiveIntegerField(default=0)
    claim_locked_until = models.DateTimeField(null=True, blank=True)

    # Production Token Security (SHA-256 hashed in database)
    hub_token_hash = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    hub_token_created_at = models.DateTimeField(null=True, blank=True)

    # One-time exchange token used during zero-trust claim handshake
    one_time_claim_token = models.CharField(max_length=64, blank=True, null=True)
    one_time_token_expires_at = models.DateTimeField(null=True, blank=True)

    # Legacy cleartext token (preserved for compatibility)
    hub_token = models.CharField(max_length=128, blank=True, null=True)

    # Heartbeat & Telemetry Metadata
    software_version = models.CharField(max_length=50, blank=True, default='0.1.0')
    hardware_info = models.CharField(max_length=100, blank=True, default='Raspberry Pi 4B')
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    uptime_seconds = models.PositiveIntegerField(default=0)
    last_seen = models.DateTimeField(null=True, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.node_name} ({self.node_id})"

    @property
    def is_online(self) -> bool:
        """Derives live connection state: active if heartbeat received within the last 90 seconds."""
        if not self.last_seen:
            return False
        return (timezone.now() - self.last_seen).total_seconds() < 90

    def set_hub_token(self, raw_token: str):
        """Hashes raw token using SHA-256 and records creation timestamp."""
        self.hub_token_hash = hashlib.sha256(raw_token.strip().encode('utf-8')).hexdigest()
        self.hub_token = raw_token.strip()  # Keep for backwards compatibility
        self.hub_token_created_at = timezone.now()

    def verify_hub_token(self, raw_token: str) -> bool:
        """Verifies supplied raw token against stored SHA-256 hash or legacy token."""
        if not raw_token:
            return False
        supplied_hash = hashlib.sha256(raw_token.strip().encode('utf-8')).hexdigest()
        if self.hub_token_hash and secrets.compare_digest(self.hub_token_hash, supplied_hash):
            return True
        if self.hub_token and secrets.compare_digest(self.hub_token, raw_token.strip()):
            return True
        return False