import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST


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

        # 1. Match against fleet sync token
        if configured_token and secrets.compare_digest(supplied_token, configured_token):
            return True

        # 2. Match against per-device claimed hub_token
        try:
            from apps.node.models.nodeDetails.models import Node
            return Node.objects.filter(hub_token=supplied_token, is_claimed=True).exists()
        except Exception:
            return False