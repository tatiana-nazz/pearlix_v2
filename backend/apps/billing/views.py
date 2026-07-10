from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.audit.services import log_activity
from apps.billing.models import BillingHandoff, Invoice
from apps.billing.permissions import BillingHandoffPermission, InvoicePermission
from apps.billing.serializers import (
    BillingHandoffSerializer,
    HandoffConversionSerializer,
    InvoiceCreateUpdateSerializer,
    InvoicePaymentResponseSerializer,
    InvoiceSerializer,
    PaymentCreateSerializer,
    PaymentSerializer,
)
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

    def get_queryset(self):
        queryset = Invoice.objects.select_related(
            "patient",
            "appointment",
            "visit",
            "visit__appointment",
            "billing_handoff",
            "created_by",
        ).prefetch_related("payments", "payments__created_by")

        invoice_status = self.request.query_params.get("status")
        patient_id = self.request.query_params.get("patient_id")
        visit_id = self.request.query_params.get("visit_id")
        appointment_id = self.request.query_params.get("appointment_id")
        currency = self.request.query_params.get("currency")
        created_from = self.request.query_params.get("created_from")
        created_to = self.request.query_params.get("created_to")

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
        if created_from:
            queryset = queryset.filter(created_at__gte=created_from)
        if created_to:
            queryset = queryset.filter(created_at__lte=created_to)
        return queryset

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
            metadata={"invoice_id": invoice.id, "patient_id": invoice.patient_id},
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
