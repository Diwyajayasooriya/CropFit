import logging
from django.conf import settings
from django.http import HttpResponseForbidden

logger = logging.getLogger(__name__)


class AdminIPRestrictionMiddleware:
    """
    Restricts access to Django Admin (/admin/*) to authorized IP addresses.
    Configured via settings.ADMIN_ALLOWED_IPS (comma-separated or list).
    Default allows localhost / 127.0.0.1 / ::1.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/admin/'):
            raw_allowed = getattr(settings, 'ADMIN_ALLOWED_IPS', '127.0.0.1,::1,localhost')
            if raw_allowed:
                if isinstance(raw_allowed, str):
                    allowed_ips = [ip.strip() for ip in raw_allowed.split(',') if ip.strip()]
                else:
                    allowed_ips = [str(ip).strip() for ip in raw_allowed]

                # If wildcard '*' is in allowed_ips, allow all
                if '*' not in allowed_ips:
                    # Resolve client IP
                    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                    if x_forwarded_for:
                        client_ip = x_forwarded_for.split(',')[0].strip()
                    else:
                        client_ip = request.META.get('REMOTE_ADDR', '').strip()

                    if client_ip not in allowed_ips:
                        logger.warning(
                            f"[SECURITY] Blocked unauthorized attempt to access Django Admin from IP: {client_ip}"
                        )
                        return HttpResponseForbidden(
                            "<h1>403 Forbidden</h1><p>Access to CropFit Administration is restricted to authorized network IPs.</p>"
                        )

        return self.get_response(request)
