from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.xrays.models import ExternalXrayCase, ImagingDeletionTask
from apps.xrays.services import process_imaging_deletion_task, purge_external_artifacts


class Command(BaseCommand):
    help = "Delete expired temporary/discarded external X-ray blobs in bounded batches."

    def add_arguments(self, parser):
        parser.add_argument("--batch-size", type=int, default=100)
        parser.add_argument(
            "--fail-on-deferred",
            action="store_true",
            help="Exit nonzero when selected objects remain pending after this bounded run.",
        )

    def handle(self, *args, **options):
        batch_size = min(1000, max(1, int(options["batch_size"])))
        ids = list(
            ExternalXrayCase.objects.filter(
                purge_after__lte=timezone.now(), artifacts_purged_at__isnull=True
            ).order_by("purge_after", "id").values_list("id", flat=True)[:batch_size]
        )
        purged = sum(1 for external_id in ids if purge_external_artifacts(external_id))
        remaining = max(0, batch_size - len(ids))
        task_ids = list(ImagingDeletionTask.objects.order_by("created_at", "id").values_list("id", flat=True)[:remaining])
        deleted = sum(1 for task_id in task_ids if process_imaging_deletion_task(task_id))
        deferred_external = len(ids) - purged
        deferred_tasks = len(task_ids) - deleted
        deferred_total = deferred_external + deferred_tasks
        message = (
            "Imaging cleanup attempted "
            f"{len(ids)} expired artifact set(s) and {len(task_ids)} deletion task(s): "
            f"purged {purged}, deleted {deleted}, deferred {deferred_total}."
        )
        self.stdout.write(
            self.style.WARNING(message) if deferred_total else self.style.SUCCESS(message)
        )
        if options["fail_on_deferred"] and deferred_total:
            raise CommandError("Imaging cleanup left selected objects pending for retry.")
