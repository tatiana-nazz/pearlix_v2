from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.common.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/clinic/", include("apps.clinic.urls")),
    path("api/", include("apps.patients.urls")),
    path("api/", include("apps.scheduling.urls")),
    path("api/", include("apps.visits.urls")),
    path("api/", include("apps.xrays.urls")),
    path("api/", include("apps.billing.urls")),
    path("api/", include("apps.dashboard.urls")),
    path("api/", include("apps.audit.urls")),
]
