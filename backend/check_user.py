from django.contrib.auth import get_user_model
import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

User = get_user_model()
print(f'User model: {User}')
print(f'Table: {User._meta.db_table}')
try:
    count = User.objects.count()
    print(f'User count: {count}')
except Exception as e:
    print(f'Error: {e}')
