import hashlib
import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission


class HasEdgeSyncToken(BasePermission):
    message = "A valid edge synchronization token or hub authorization token is required."

    def has_permission(self, request, view):
        configured_token = getattr(settings, "EDGE_SYNC_TOKEN", "")
        authorization = request.headers.get("Authorization", "")

        if not authorization.startswith("Bearer "):
            return False

        supplied_token = authorization.removeprefix("Bearer ").strip()
        if not supplied_token:
            return False

        # 1. Match against fleet master sync token
        if configured_token and secrets.compare_digest(supplied_token, configured_token):
            return True

        # 2. Match against per-device SHA-256 hash or legacy token
        try:
            from apps.node.models.nodeDetails.models import Node
            supplied_hash = hashlib.sha256(supplied_token.encode("utf-8")).hexdigest()
            node = Node.objects.filter(hub_token_hash=supplied_hash, is_claimed=True).first()
            if not node:
                node = Node.objects.filter(hub_token=supplied_token, is_claimed=True).first()

            if node:
                request.node = node
                return True
            return False
        except Exception:
            return False


HasHubToken = HasEdgeSyncToken