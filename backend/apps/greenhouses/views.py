from rest_framework import viewsets, permissions
from apps.greenhouses.models.models import GreenHouse
from apps.greenhouses.serializers import GreenHouseSerializer


class GreenHouseViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Greenhouses.
    List, Create, Retrieve, Update, and Delete user greenhouses.
    """
    queryset = GreenHouse.objects.all().order_by('-created_at')
    serializer_class = GreenHouseSerializer
    permission_classes = [permissions.AllowAny]  # Can be permissions.IsAuthenticated in prod

    def perform_create(self, serializer):
        # If user is authenticated, link to user, else fallback to user in data or first user
        user = self.request.user if self.request.user.is_authenticated else None
        if not user and 'user' in serializer.validated_data:
            user = serializer.validated_data['user']
        if user:
            serializer.save(user=user)
        else:
            serializer.save()
