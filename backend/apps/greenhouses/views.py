from rest_framework import viewsets, permissions
from apps.greenhouses.models.models import GreenHouse
from apps.greenhouses.serializers import GreenHouseSerializer


class GreenHouseViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Greenhouses.
    List, Create, Retrieve, Update, and Delete user greenhouses.
    Farmers have full self-service control over their own greenhouses.
    """
    serializer_class = GreenHouseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return GreenHouse.objects.none()
        if user.is_superuser or getattr(user, 'role', '') == 'admin':
            return GreenHouse.objects.all().order_by('-created_at')
        return GreenHouse.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

