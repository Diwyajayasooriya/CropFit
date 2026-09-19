from django.contrib import admin
from .models.models import GreenHouse

@admin.register(GreenHouse)
class GreenHouseAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'location', 'crop', 'plantation_date', 'created_at')
    list_filter = ('crop', 'plantation_date', 'user')
    search_fields = ('name', 'location', 'crop', 'user__username')
    date_hierarchy = 'plantation_date'
    ordering = ('-created_at',)
