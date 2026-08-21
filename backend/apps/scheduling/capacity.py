from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable


Interval = tuple[datetime, datetime]


@dataclass(frozen=True)
class CapacityAssessment:
    """Peak occupancy for one proposed half-open appointment interval."""

    existing_peak: int
    projected_peak: int
    capacity: int

    @property
    def available(self) -> bool:
        return self.projected_peak <= self.capacity


def maximum_simultaneous_occupancy(
    intervals: Iterable[Interval],
    *,
    window_start: datetime,
    window_end: datetime,
) -> int:
    """Return peak occupancy inside ``[window_start, window_end)``.

    Intervals are clipped to the requested window. End events sort before start
    events at the same instant, so adjacent appointments never overlap.
    """

    if window_start >= window_end:
        raise ValueError("Capacity windows require window_start < window_end.")

    events: list[tuple[datetime, int]] = []
    for interval_start, interval_end in intervals:
        start = max(interval_start, window_start)
        end = min(interval_end, window_end)
        if start >= end:
            continue
        events.append((start, 1))
        events.append((end, -1))

    current = 0
    peak = 0
    for _, delta in sorted(events, key=lambda event: (event[0], event[1])):
        current += delta
        peak = max(peak, current)
    return peak


def assess_candidate_capacity(
    intervals: Iterable[Interval],
    *,
    start_datetime: datetime,
    end_datetime: datetime,
    capacity: int,
) -> CapacityAssessment:
    """Assess adding one candidate to the active intervals in its window."""

    if capacity < 1:
        raise ValueError("Clinic capacity must be at least one.")
    existing_peak = maximum_simultaneous_occupancy(
        intervals,
        window_start=start_datetime,
        window_end=end_datetime,
    )
    return CapacityAssessment(
        existing_peak=existing_peak,
        projected_peak=existing_peak + 1,
        capacity=capacity,
    )
