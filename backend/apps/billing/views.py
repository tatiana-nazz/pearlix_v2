from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.billing.models import BillingHandoff, Invoice
from apps.billing.permissions import BillingHandoffPermission, InvoicePermission
from apps.billing.selectors import annotate_handoff_financials, handoffs_for_billing_api
from apps.billing.serializers import (
    BillingHandoffQuerySerializer,
    BillingHandoffSerializer,
    HandoffInvoiceResponseSerializer,
    InvoiceIssueSerializer,
    InvoiceQuerySerializer,
    InvoiceReceiptSerializer,
)
from apps.billing.services import (
    BillingRuleError,
    invoice_print_data,
    issue_invoice,
)
from apps.clinic.models import ClinicSettings
from apps.common.errors import error_response


ZERO = Decimal("0.00")


class BillingPagination(PageNumberPagination):
    page_size = 20


def _clinic_context():
    clinic = ClinicSettings.get_solo()
    clinic_timezone = ZoneInfo(clinic.timezone)
    clinic_date = timezone.localtime(timezone.now(), clinic_timezone).date()
    return clinic.timezone, clinic_timezone, clinic_date


def _date_bounds(params, clinic_timezone):
    date_from = params.get("date_from")
    date_to = params.get("date_to")
    start = timezone.make_aware(datetime.combine(date_from, time.min), clinic_timezone) if date_from else None
    end = (
        timezone.make_aware(datetime.combine(date_to + timedelta(days=1), time.min), clinic_timezone)
        if date_to
        else None
    )
    return start, end


class BillingHandoffViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = BillingHandoffSerializer
    permission_classes = [BillingHandoffPermission]
    pagination_class = BillingPagination
    http_method_names = ["get", "post", "head", "options"]

    def _query_params(self):
        serializer = BillingHandoffQuerySerializer(data=self.request.query_params)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    @staticmethod
    def _filter_queryset(queryset, params):
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        if params.get("currency"):
            queryset = queryset.filter(currency=params["currency"])
        if params.get("patient_id"):
            queryset = queryset.filter(patient_id=params["patient_id"])
        if params.get("doctor_id"):
            queryset = queryset.filter(doctor_id=params["doctor_id"])
        if params.get("visit_id"):
            queryset = queryset.filter(visit_id=params["visit_id"])
        if params.get("search"):
            search = params["search"]
            criteria = (
                Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(doctor__full_name__icontains=search)
                | Q(description__icontains=search)
            )
            if search.isdigit():
                criteria |= Q(id=int(search))
            queryset = queryset.filter(criteria)
        _, clinic_timezone, _ = _clinic_context()
        start, end = _date_bounds(params, clinic_timezone)
        if start:
            queryset = queryset.filter(created_at__gte=start)
        if end:
            queryset = queryset.filter(created_at__lt=end)
        return queryset

    def get_queryset(self):
        queryset = handoffs_for_billing_api()
        if self.request.user.is_authenticated and self.request.user.role == "DOCTOR":
            queryset = queryset.filter(doctor=self.request.user)
        return self._filter_queryset(queryset, self._query_params())

    @action(detail=True, methods=["post"], url_path="invoices")
    def issue_invoice(self, request, pk=None):
        forbidden = sorted({"patient", "patient_id", "currency", "description", "billing_handoff"}.intersection(request.data))
        if forbidden:
            return error_response(
                "VALIDATION_ERROR",
                "Some fields are invalid.",
                {field: ["Invoice context is inherited from the bill."] for field in forbidden},
            )
        serializer = InvoiceIssueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invoice, handoff = issue_invoice(
                handoff=self.get_object(),
                user=request.user,
                data=serializer.validated_data,
                request=request,
            )
        except BillingRuleError as exc:
            return exc.to_response()
        data = HandoffInvoiceResponseSerializer(
            {"invoice": invoice, "handoff": handoffs_for_billing_api().get(pk=handoff.pk)}
        ).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        params = self._query_params()
        timezone_name, _, clinic_date = _clinic_context()
        queryset = BillingHandoff.objects.all()
        if request.user.role == "DOCTOR":
            queryset = queryset.filter(doctor=request.user)
        queryset = self._filter_queryset(queryset, params)
        status_counts = {choice: 0 for choice, _ in BillingHandoff.Status.choices}
        for row in queryset.values("status").annotate(count=Count("id")):
            status_counts[row["status"]] = row["count"]
        totals = {
            choice: {"bill_total": ZERO, "paid": ZERO, "outstanding": ZERO}
            for choice, _ in BillingHandoff.Currency.choices
        }
        for handoff in annotate_handoff_financials(queryset):
            bucket = totals[handoff.currency]
            bucket["bill_total"] += handoff.total_amount
            bucket["paid"] += handoff.paid_amount
            if handoff.status != BillingHandoff.Status.CANCELLED:
                bucket["outstanding"] += handoff.remaining_amount
        return Response(
            {
                "clinic_date": clinic_date.isoformat(),
                "clinic_timezone": timezone_name,
                "status_counts": status_counts,
                "open_count": status_counts[BillingHandoff.Status.OPEN],
                "partially_paid_count": status_counts[BillingHandoff.Status.PARTIALLY_PAID],
                "paid_count": status_counts[BillingHandoff.Status.PAID],
                "cancelled_count": status_counts[BillingHandoff.Status.CANCELLED],
                "currency_totals": totals,
            }
        )


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InvoiceReceiptSerializer
    permission_classes = [InvoicePermission]
    pagination_class = BillingPagination
    http_method_names = ["get", "head", "options"]

    def _query_params(self):
        serializer = InvoiceQuerySerializer(data=self.request.query_params)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    @staticmethod
    def _filter_queryset(queryset, params):
        if params.get("patient_id"):
            queryset = queryset.filter(billing_handoff__patient_id=params["patient_id"])
        if params.get("handoff_id"):
            queryset = queryset.filter(billing_handoff_id=params["handoff_id"])
        if params.get("visit_id"):
            queryset = queryset.filter(billing_handoff__visit_id=params["visit_id"])
        if params.get("appointment_id"):
            queryset = queryset.filter(billing_handoff__visit__appointment_id=params["appointment_id"])
        if params.get("currency"):
            queryset = queryset.filter(billing_handoff__currency=params["currency"])
        if params.get("search"):
            search = params["search"]
            queryset = queryset.filter(
                Q(invoice_number__icontains=search)
                | Q(billing_handoff__patient__first_name__icontains=search)
                | Q(billing_handoff__patient__last_name__icontains=search)
            )
        _, clinic_timezone, _ = _clinic_context()
        start, end = _date_bounds(params, clinic_timezone)
        if start:
            queryset = queryset.filter(issued_at__gte=start)
        if end:
            queryset = queryset.filter(issued_at__lt=end)
        return queryset

    def get_queryset(self):
        queryset = Invoice.objects.select_related(
            "billing_handoff",
            "billing_handoff__patient",
            "billing_handoff__visit",
            "billing_handoff__visit__appointment",
            "created_by",
        )
        return self._filter_queryset(queryset, self._query_params())

    @action(detail=False, methods=["get"])
    def summary(self, request):
        params = self._query_params()
        timezone_name, _, clinic_date = _clinic_context()
        queryset = self._filter_queryset(Invoice.objects.all(), params)
        totals = {choice: ZERO for choice, _ in BillingHandoff.Currency.choices}
        for row in queryset.values("billing_handoff__currency").annotate(total=Sum("amount")):
            totals[row["billing_handoff__currency"]] = row["total"] or ZERO
        return Response(
            {
                "clinic_date": clinic_date.isoformat(),
                "clinic_timezone": timezone_name,
                "invoice_count": queryset.count(),
                "collected_by_currency": totals,
            }
        )

    @action(detail=True, methods=["get"], url_path="print-data")
    def print_data(self, request, pk=None):
        return Response(invoice_print_data(self.get_object()))
