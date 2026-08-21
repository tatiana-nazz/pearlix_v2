from django.contrib import admin

from apps.billing.models import BillingHandoff, Invoice


@admin.register(BillingHandoff)
class BillingHandoffAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "visit", "doctor", "status", "total_amount", "currency", "created_at")
    list_filter = ("status", "currency", "created_at")
    search_fields = ("patient__first_name", "patient__last_name", "doctor__full_name", "note")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "billing_handoff", "amount", "issued_at", "created_by")
    list_filter = ("issued_at", "created_at")
    search_fields = ("invoice_number", "billing_handoff__patient__first_name", "billing_handoff__patient__last_name", "notes")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
