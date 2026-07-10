from rest_framework.routers import DefaultRouter

from apps.xrays.views import ExternalXrayViewSet, XrayViewSet


router = DefaultRouter()
router.register("xrays", XrayViewSet, basename="xray")
router.register("external-xrays", ExternalXrayViewSet, basename="external-xray")

urlpatterns = router.urls
