from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Standard Greenhouse Farmer Login Serializer.
    Accepts either email or username. Blocks admin accounts from signing in
    through the general farmer portal.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False
        self.fields['email'] = serializers.CharField(required=False, write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = getattr(user, 'role', 'farmer')
        token['email'] = user.email
        return token

    def validate(self, attrs):
        login_identifier = (attrs.get('email') or attrs.get(self.username_field) or '').strip()

        if not login_identifier:
            raise serializers.ValidationError({
                "username": ["Please enter your email or username."]
            })

        # Match user by email or username
        matched_user = User.objects.filter(email__iexact=login_identifier).first() or \
                       User.objects.filter(username__iexact=login_identifier).first()

        if matched_user:
            attrs[self.username_field] = matched_user.username
        else:
            attrs[self.username_field] = login_identifier

        data = super().validate(attrs)

        # Restrict: Dedicated admin accounts must sign in through the admin portal
        if self.user.role == 'admin':
            raise serializers.ValidationError({
                "detail": "Administrative accounts must sign in through the secure Admin Console at /admin/login."
            })

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'role': getattr(self.user, 'role', 'farmer'),
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
        }
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class AdminTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Secure Admin Login Serializer.
    Enforces IP allowlisting and checks role/is_staff/is_superuser privileges.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False
        self.fields['email'] = serializers.CharField(required=False, write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = 'admin'
        token['email'] = user.email
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        return token

    def validate(self, attrs):
        # 1. IP allowlist security check
        request = self.context.get('request')
        if request:
            from django.conf import settings
            allowed = getattr(settings, 'ADMIN_ALLOWED_IPS', None)
            if allowed:
                x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                client_ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR', '').strip()
                allowed_list = [ip.strip() for ip in allowed.split(',') if ip.strip()] if isinstance(allowed, str) else [str(ip).strip() for ip in allowed]
                if '*' not in allowed_list and client_ip not in allowed_list:
                    raise serializers.ValidationError({
                        "detail": f"Admin authentication from IP {client_ip} is forbidden by security policy."
                    })

        # 2. Resolve username or email
        login_identifier = (attrs.get('email') or attrs.get(self.username_field) or '').strip()
        if not login_identifier:
            raise serializers.ValidationError({
                "username": ["Administrator email or username is required."]
            })

        matched_user = User.objects.filter(email__iexact=login_identifier).first() or \
                       User.objects.filter(username__iexact=login_identifier).first()

        if matched_user:
            attrs[self.username_field] = matched_user.username
        else:
            attrs[self.username_field] = login_identifier

        data = super().validate(attrs)

        # 3. Enforce administrator credentials
        if not (self.user.role == 'admin' or self.user.is_staff or self.user.is_superuser):
            raise serializers.ValidationError({
                "detail": "Access Denied: Account lacks administrative privileges."
            })

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'role': 'admin',
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
        }
        return data


class AdminTokenObtainPairView(TokenObtainPairView):
    serializer_class = AdminTokenObtainPairSerializer
