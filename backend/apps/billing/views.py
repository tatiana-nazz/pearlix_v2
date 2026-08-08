from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db.models import Count, DecimalField, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.audit.services import log_activity
from apps.billing.models import BillingHandoff, Invoice, Payment
from apps.billing.permissions import BillingHandoffPermission, InvoicePermission
from apps.billing.serializers import (
    BillingHandoffSerializer,
    HandoffConversionSerializer,
    InvoiceCreateUpdateSerializer,
    InvoicePaymentResponseSerializer,
    InvoiceQuerySerializer,
    InvoiceSerializer,
    PaymentCreateSerializer,
    PaymentSerializer,
)
from apps.clinic.models import ClinicSettings
from apps.billing.services import (
    BillingRuleError,
    cancel_invoice,
    convert_handoff_to_invoice,
    create_invoice,
    dismiss_handoff,
    invoice_print_data,
    record_payment,
    update_invoice,
)
from apps.common.errors import error_response


class BillingPagination(PageNumberPagination):
    page_size = 20


class BillingHandoffViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BillingHandoffSerializer
    permission_classes = [BillingHandoffPermission]
    pagination_class = BillingPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        queryset = BillingHandoff.objects.select_related(
            "patient",
            "visit",
            "visit__appointment",
            "doctor",
            "converted_invoice",
            "created_by",
            "updated_by",
        ).all()
        user = self.request.user
        if user.is_authenticated and user.role == "DOCTOR":
            queryset = queryset.filter(doctor=user)

        handoff_status = self.request.query_params.get("status")
        doctor_id = self.request.query_params.get("doctor_id")
        patient_id = self.request.query_params.get("patient_id")
        visit_id = self.request.query_params.get("visit_id")
        created_from = self.request.query_params.get("created_from")
        created_to = self.request.query_params.get("created_to")

        if handoff_status:
            queryset = queryset.filter(status=handoff_status)
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if visit_id:
            queryset = queryset.filter(visit_id=visit_id)
        if created_from:
            queryset = queryset.filter(created_at__gte=created_from)
        if created_to:
            queryset = queryset.filter(created_at__lte=created_to)
        return queryset

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        handoff = self.get_object()
        try:
            handoff = dismiss_handoff(handoff=handoff, user=request.user, data=request.data)
        except BillingRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="billing_handoff_dismissed",
            entity_type="billing_handoff",
            entity_id=handoff.id,
            metadata={"handoff_id": handoff.id, "visit_id": handoff.visit_id, "patient_id": handoff.patient_id},
        )
        return Response(BillingHandoffSerializer(handoff).data)

    @action(detail=True, methods=["post"], url_path="convert-to-invoice")
    def convert_to_invoice(self, request, pk=None):
        handoff = self.get_object()
        serializer = HandoffConversionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invoice = convert_handoff_to_invoice(handoff=handoff, user=request.user, data=serializer.validated_data)
        except BillingRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="billing_handoff_converted_to_invoice",
            entity_type="billing_handoff",
            entity_id=handoff.id,
            metadata={"handoff_id": handoff.id, "invoice_id": invoice.id, "visit_id": invoice.visit_id, "patient_id": invoice.patient_id},
        )
        log_activity(
            request=request,
            action="invoice_created",
            entity_type="invoice",
            entity_id=invoice.id,
            metadata={"invoice_id": invoice.id, "patient_id": invoice.patient_id, "billing_handoff_id": handoff.id},
        )
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


class InvoiceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = InvoiceSerializer
    permission_classes = [InvoicePermission]
    pagination_class = BillingPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    blocked_frontend_fields = {
        "billing_handoff",
        "billing_handoff_id",
        "invoice_number",
        "paid_amount",
        "remaining_amount",
        "status",
        "payments",
        "payment_count",
    }

    def _query_params(self):
        serializer = InvoiceQuerySerializer(data=self.request.query_params)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    @staticmethod
    def _clinic_context():
        clinic = ClinicSettings.get_solo()
        clinic_timezone = ZoneInfo(clinic.timezone)
        clinic_date = timezone.localtime(timezone.now(), clinic_timezone).date()
        return clinic.timezone, clinic_timezone, clinic_date

    @staticmethod
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

    def _filter_queryset(self, queryset, params, *, include_invoice_dates=True):
        invoice_status = params.get("status")
        patient_id = params.get("patient_id")
        visit_id = params.get("visit_id")
        appointment_id = params.get("appointment_id")
        currency = params.get("currency")
        search = params.get("search")

        if invoice_status:
            queryset = queryset.filter(status=invoice_status)
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if visit_id:
            queryset = queryset.filter(visit_id=visit_id)
        if appointment_id:
            queryset = queryset.filter(appointment_id=appointment_id)
        if currency:
            queryset = queryset.filter(currency=currency)
        if search:
            queryset = queryset.filter(
                Q(invoice_number__icontains=search)
                | Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(description__icontains=search)
            )

        if include_invoice_dates:
            _, clinic_timezone, _ = self._clinic_context()
            date_start, date_end = self._date_bounds(params, clinic_timezone)
            if date_start:
                queryset = queryset.filter(created_at__gte=date_start)
            if date_end:
                queryset = queryset.filter(created_at__lt=date_end)
            if params.get("created_from"):
                queryset = queryset.filter(created_at__gte=params["created_from"])
            if params.get("created_to"):
                queryset = queryset.filter(created_at__lte=params["created_to"])
        return queryset

    def get_queryset(self):
        queryset = Invoice.objects.select_related(
            "patient",
            "appointment",
            "visit",
            "visit__appointment",
            "billing_handoff",
            "created_by",
        ).prefetch_related("payments", "payments__created_by")

        return self._filter_queryset(queryset, self._query_params())

    @action(detail=False, methods=["get"])
    def summary(self, request):
        params = self._query_params()
        clinic_timezone_name, clinic_timezone, clinic_date = self._clinic_context()

        base_queryset = Invoice.objects.all()
        filtered_queryset = self._filter_queryset(base_queryset, params)
        status_rows = filtered_queryset.values("status").annotate(count=Count("id"))
        status_counts = {choice: 0 for choice, _ in Invoice.Status.choices}
        for row in status_rows:
            status_counts[row["status"]] = row["count"]

        zero = Decimal("0.00")
        decimal_field = DecimalField(max_digits=14, decimal_places=2)
        financial_rows = filtered_queryset.values("id", "currency", "status", "total_amount").annotate(
            summary_paid=Coalesce(Sum("payments__amount"), zero, output_field=decimal_field)
        )
        currency_totals = {
            choice: {"invoiced": zero, "paid": zero, "outstanding": zero}
            for choice, _ in Invoice.Currency.choices
        }
        for row in financial_rows:
            totals = currency_totals[row["currency"]]
            total_amount = row["total_amount"] or zero
            paid_amount = row["summary_paid"] or zero
            totals["invoiced"] += total_amount
            totals["paid"] += paid_amount
            if row["status"] != Invoice.Status.CANCELLED:
                totals["outstanding"] += max(total_amount - paid_amount, zero)

        payment_invoice_queryset = self._filter_queryset(base_queryset, params, include_invoice_dates=False)
        payments = Payment.objects.filter(invoice__in=payment_invoice_queryset)
        payment_start, payment_end = self._date_bounds(params, clinic_timezone)
        if payment_start:
            payments = payments.filter(payment_date__gte=payment_start)
        if payment_end:
            payments = payments.filter(payment_date__lt=payment_end)
        if params.get("created_from"):
            payments = payments.filter(payment_date__gte=params["created_from"])
        if params.get("created_to"):
            payments = payments.filter(payment_date__lte=params["created_to"])

        payment_rows = payments.values("currency").annotate(total=Sum("amount"))
        payments_collected = {choice: zero for choice, _ in Payment.Currency.choices}
        for row in payment_rows:
            payments_collected[row["currency"]] = row["total"] or zero

        return Response(
            {
                "clinic_date": clinic_date.isoformat(),
                "clinic_timezone": clinic_timezone_name,
                "invoice_count": sum(status_counts.values()),
                "status_counts": status_counts,
                "open_invoice_count": status_counts[Invoice.Status.UNPAID]
                + status_counts[Invoice.Status.PARTIALLY_PAID],
                "currency_totals": currency_totals,
                "payments_collected_in_period": payments_collected,
            }
        )

    def _reject_frontend_fields(self, request):
        blocked = sorted(self.blocked_frontend_fields.intersection(request.data))
        if blocked:
            return error_response(
                "VALIDATION_ERROR",
                "Some fields are invalid.",
                {field: ["This field is calculated by the backend and cannot be set."] for field in blocked},
            )
        return None

    def create(self, request, *args, **kwargs):
        blocked_response = self._reject_frontend_fields(request)
        if blocked_response is not None:
            return blocked_response
        serializer = InvoiceCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invoice = create_invoice(user=request.user, data=serializer.validated_data)
        except BillingRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="invoice_created",
            entity_type="invoice",
            entity_id=invoice.id,
            metadata={"invoice_id": invoice.id, "patient_id": invoice.patient_id, "origin": invoice.origin},
        )
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        blocked_response = self._reject_frontend_fields(request)
        if blocked_response is not None:
            return blocked_response
        invoice = self.get_object()
        serializer = InvoiceCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            invoice = update_invoice(invoice=invoice, user=request.user, data=serializer.validated_data)
        except BillingRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="invoice_updated",
            entity_type="invoice",
            entity_id=invoice.id,
            metadata={"invoice_id": invoice.id, "updated_fields": sorted(request.data.keys())},
        )
        return Response(InvoiceSerializer(invoice).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        try:
            invoice = cancel_invoice(invoice=invoice, user=request.user, data=request.data)
        except BillingRuleError as exc:
            return exc.to_response()
        log_activity(
            request=request,
            action="invoice_cancelled",
            entity_type="invoice",
            entity_id=invoice.id,
            metadata={"invoice_id": invoice.id, "patient_id": invoice.patient_id},
        )
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=["get", "post"])
    def payments(self, request, pk=None):
        invoice = self.get_object()
        if request.method == "GET":
            return Response(PaymentSerializer(invoice.payments.all(), many=True).data)

        serializer = PaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = record_payment(invoice=invoice, user=request.user, data=serializer.validated_data)
        except BillingRuleError as exc:
            return exc.to_response()
        invoice.refresh_from_db()
        log_activity(
            request=request,
            action="payment_recorded",
            entity_type="payment",
            entity_id=payment.id,
            metadata={"payment_id": payment.id, "invoice_id": invoice.id, "amount": str(payment.amount), "currency": payment.currency},
        )
        data = InvoicePaymentResponseSerializer({"payment": payment, "invoice": invoice}).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="print-data")
    def print_data(self, request, pk=None):
        invoice = self.get_object()
        return Response(invoice_print_data(invoice))
