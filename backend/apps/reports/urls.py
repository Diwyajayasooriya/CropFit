from django.urls import path
from apps.reports.views import ReportSummaryView, DashboardSummaryView

urlpatterns = [
    path('summary/', ReportSummaryView.as_view(), name='report-summary'),
    path('dashboard/', DashboardSummaryView.as_view(), name='dashboard-summary'),
]
