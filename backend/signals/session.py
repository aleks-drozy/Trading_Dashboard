"""
NY session status check.

NY trading session: 9:30 AM – 10:30 AM ET, weekdays only.
Matches Pine source (FYP_BOT_1_3.pine lines 21-33):
  currentTimeInMinutes >= startTimeInMinutes and currentTimeInMinutes < endTimeInMinutes
  isWeekday = dayofweek != sunday and dayofweek != saturday
"""

from datetime import datetime
from zoneinfo import ZoneInfo

_NY_TZ = ZoneInfo("America/New_York")
_SESSION_START_MINUTES = 9 * 60 + 30   # 570
_SESSION_END_MINUTES = 10 * 60 + 30    # 630


def is_ny_session_active() -> bool:
    """Return True if current time falls within the NY session window (9:30-10:30 ET, Mon-Fri)."""
    now = datetime.now(ZoneInfo("America/New_York"))
    # Weekday check: Monday=0 ... Friday=4, Saturday=5, Sunday=6
    if now.weekday() >= 5:  # weekday() < 5 means Mon-Fri
        return False
    current_minutes = now.hour * 60 + now.minute
    return _SESSION_START_MINUTES <= current_minutes < _SESSION_END_MINUTES
