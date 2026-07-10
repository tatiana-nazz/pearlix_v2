from rest_framework.routers import DefaultRouter

from apps.audit.views import ActivityLogViewSet


router = DefaultRouter()
router.register("audit-logs", ActivityLogViewSet, basename="audit-log")

urlpatterns = router.urls
