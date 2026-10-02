from django.contrib import admin
from django.urls import path, include

admin.site.site_header = "CropFit Administration"
admin.site.site_title = "CropFit Admin Portal"
admin.site.index_title = "Welcome to CropFit Admin Portal"

from apps.node.views import ClaimHubView, PollClaimView, ActuatorViewSet

urlpatterns = [
    path('admin/', admin.site.urls),

    # Legacy / Authentication
    path('api/auth/', include('apps.authentication.urls')),
    path('api/sensor/', include('apps.node.urls')),

    # API v1 Endpoints (Cloud Backend for GreenNode)
    path('api/v1/greenhouses/', include('apps.greenhouses.urls')),
    path('api/v1/nodes/', include('apps.node.urls')),
    path('api/v1/conditions/', include('apps.conditions.urls')),
    path('api/v1/rules/', include('apps.rules.urls')),
    path('api/v1/devices/', include('apps.devices.urls')),
    path('api/v1/alerts/', include('apps.alerts.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),

    # Edge Onboarding & Claiming Aliases
    path('api/v1/edge/poll-claim/', PollClaimView.as_view(), name='edge-poll-claim'),
    path('api/v1/hubs/claim/', ClaimHubView.as_view(), name='hubs-claim'),
    path('api/v1/actuators/<str:pk>/command/', ActuatorViewSet.as_view({'post': 'command'}), name='actuator-direct-command'),
]
