from decimal import Decimal

from django.db.models import Count, DecimalField, QuerySet, Sum
from django.db.models.functions import Coalesce

from apps.billing.models import BillingHandoff


ZERO = Decimal("0.00")
FINANCIAL_DECIMAL_FIELD = DecimalField(max_digits=14, decimal_places=2)


def annotate_handoff_financials(queryset: QuerySet[BillingHandoff]) -> QuerySet[BillingHandoff]:
    """Project canonical paid and receipt-count values onto Bills."""
    return queryset.annotate(
        financial_paid_amount=Coalesce(
            Sum("invoices__amount"),
            ZERO,
            output_field=FINANCIAL_DECIMAL_FIELD,
        ),
        financial_invoice_count=Count("invoices", distinct=True),
    )


def handoffs_for_billing_api() -> QuerySet[BillingHandoff]:
    """Return Bills with the loading and financial projection used by the Billing API."""
    queryset = BillingHandoff.objects.select_related(
        "patient",
        "visit",
        "visit__appointment",
        "doctor",
        "created_by",
        "updated_by",
    ).prefetch_related("invoices", "invoices__created_by")
    return annotate_handoff_financials(queryset).order_by("-created_at", "-id")
