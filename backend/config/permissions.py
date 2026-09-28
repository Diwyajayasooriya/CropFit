import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST


class HasEdgeSyncToken(BasePermission):
    message = "A valid edge synchronization token is required."

    def has_permission(self, request, view):
        configured_token = getattr(settings, "EDGE_SYNC_TOKEN", "")
        authorization = request.headers.get("Authorization", "")

        if not configured_token or not authorization.startswith("Bearer "):
            return Response(
                {
                    "message":"error"
                },status=HTTP_400_BAD_REQUEST
            )

        supplied_token = authorization.removeprefix("Bearer ").strip()
        return secrets.compare_digest(supplied_token, configured_token)