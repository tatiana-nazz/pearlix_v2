from django.contrib import admin

from apps.billing.models import BillingHandoff, Invoice, Payment


@admin.register(BillingHandoff)
class BillingHandoffAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "visit", "doctor", "status", "suggested_amount", "currency", "created_at")
    list_filter = ("status", "currency", "created_at")
    search_fields = ("patient__first_name", "patient__last_name", "doctor__full_name", "note")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "patient", "currency", "total_amount", "status", "created_at")
    list_filter = ("status", "currency", "created_at")
    search_fields = ("invoice_number", "patient__first_name", "patient__last_name", "notes")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice", "amount", "currency", "payment_date", "created_by")
    list_filter = ("currency", "payment_date")
    search_fields = ("invoice__invoice_number", "notes")
