from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from apps.authentication.Serializers.serializers import UserSerializer
from apps.authentication.Permitions.permissions import IsAdmin


class UserMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        data = serializer.data
        # Include onboarding progress
        from apps.authentication.models.UserProfile import UserProfile
        from apps.greenhouses.models.models import GreenHouse
        from apps.node.models.nodeDetails.models import Node

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        step = "COMPLETED"
        if not profile.onboarding_completed:
            greenhouse = GreenHouse.objects.filter(user=request.user).first()
            if not greenhouse:
                step = "CREATE_GREENHOUSE"
            else:
                hub = Node.objects.filter(greenHouse=greenhouse, is_claimed=True).first()
                if not hub:
                    step = "CLAIM_HUB"
                elif not (hub.sensors.exists() or hub.actuators.exists()):
                    step = "CONFIGURE_DEVICES"
                else:
                    step = "COMPLETED"
                    profile.onboarding_completed = True
                    profile.save(update_fields=["onboarding_completed"])

        data["onboarding_completed"] = profile.onboarding_completed
        data["onboarding_step"] = step
        return Response(data)


class OnboardingStatusView(APIView):
    """
    GET /api/v1/auth/onboarding-status/
    Returns whether the farmer has completed onboarding and their next actionable step.
    POST /api/v1/auth/onboarding-status/
    Manually marks onboarding as completed or updates state.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.authentication.models.UserProfile import UserProfile
        from apps.greenhouses.models.models import GreenHouse
        from apps.node.models.nodeDetails.models import Node

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        greenhouses = GreenHouse.objects.filter(user=request.user)
        greenhouse = greenhouses.first()
        hubs = Node.objects.filter(greenHouse__in=greenhouses, is_claimed=True) if greenhouses.exists() else Node.objects.none()
        primary_hub = hubs.first()

        step = "COMPLETED"
        if not profile.onboarding_completed:
            if not greenhouse:
                step = "CREATE_GREENHOUSE"
            elif not primary_hub:
                step = "CLAIM_HUB"
            elif not (primary_hub.sensors.exists() or primary_hub.actuators.exists()):
                step = "CONFIGURE_DEVICES"
            else:
                step = "COMPLETED"
                profile.onboarding_completed = True
                profile.save(update_fields=["onboarding_completed"])

        return Response({
            "onboarding_completed": profile.onboarding_completed,
            "onboarding_step": step,
            "greenhouse": {
                "id": greenhouse.id,
                "name": greenhouse.name,
                "crop": greenhouse.crop,
            } if greenhouse else None,
            "hub": {
                "id": primary_hub.id,
                "node_id": primary_hub.node_id,
                "node_name": primary_hub.node_name,
            } if primary_hub else None,
            "has_sensors": primary_hub.sensors.exists() if primary_hub else False,
            "has_actuators": primary_hub.actuators.exists() if primary_hub else False,
        })

    def post(self, request):
        from apps.authentication.models.UserProfile import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        completed = request.data.get("completed", True)
        profile.onboarding_completed = bool(completed)
        profile.save(update_fields=["onboarding_completed"])
        return Response({"onboarding_completed": profile.onboarding_completed})



class RegistrationView(APIView):
    permission_classes = [IsAdmin] #only admin can register users

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    #login logic
    def post(self,request):

        if request.user.is_authenticated:
            return Response(
                {
                    "message":"login successful",
                    "user": {
                        "username": request.user.username,
                        "role": request.user.role
                    }
                },status=200
            )
        else:
            return Response(
                {
                    "message":"Login failed"
                }, status=status.HTTP_401_UNAUTHORIZED
            )


