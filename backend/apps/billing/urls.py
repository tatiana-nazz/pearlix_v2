from rest_framework.routers import DefaultRouter

from apps.billing.views import BillingHandoffViewSet, InvoiceViewSet


router = DefaultRouter()
router.register("billing-handoffs", BillingHandoffViewSet, basename="billing-handoff")
router.register("invoices", InvoiceViewSet, basename="invoice")

urlpatterns = router.urls
