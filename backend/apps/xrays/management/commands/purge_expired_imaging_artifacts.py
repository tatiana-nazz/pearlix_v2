from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.xrays.models import ExternalXrayCase, ImagingDeletionTask
from apps.xrays.services import process_imaging_deletion_task, purge_external_artifacts


class Command(BaseCommand):
    help = "Delete expired temporary/discarded external X-ray blobs in bounded batches."

    def add_arguments(self, parser):
        parser.add_argument("--batch-size", type=int, default=100)

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
        self.stdout.write(self.style.SUCCESS(f"Purged {purged} expired artifact set(s) and {deleted} deferred object(s)."))
