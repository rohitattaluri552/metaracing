export const TIME_SLOT_INTERVAL_MINUTES = 30;
export const DEFAULT_OPEN_TIME = "06:00";
export const DEFAULT_CLOSE_TIME = "23:00";

export function parseTimeToMinutes(time: string): number | null {
  const [hour, minute] = time.split(":").map((value) => Number(value));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function buildTimeOptions(
  openTime = DEFAULT_OPEN_TIME,
  closeTime = DEFAULT_CLOSE_TIME,
  stepMinutes = TIME_SLOT_INTERVAL_MINUTES
): string[] {
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);

  if (
    openMinutes === null ||
    closeMinutes === null ||
    openMinutes >= closeMinutes
  ) {
    return [];
  }

  const slots: string[] = [];
  for (
    let totalMinutes = openMinutes;
    totalMinutes < closeMinutes;
    totalMinutes += stepMinutes
  ) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    slots.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    );
  }
  return slots;
}

export function formatTimeLabel(time: string): string {
  const [hour, minute] = time.split(":").map((value) => Number(value));
  const safeHour = Number.isNaN(hour) ? 0 : hour;
  const safeMinute = Number.isNaN(minute) ? 0 : minute;
  const ampm = safeHour >= 12 ? "PM" : "AM";
  const h12 = safeHour % 12 === 0 ? 12 : safeHour % 12;
  return `${h12}:${String(safeMinute).padStart(2, "0")} ${ampm}`;
}

export function addDaysToDate(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateWithinBookingWindow(
  date: string,
  now = new Date()
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const selected = new Date(`${date}T00:00:00`);
  if (Number.isNaN(selected.getTime())) return false;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = addDaysToDate(start, 6);
  end.setHours(23, 59, 59, 999);

  return selected >= start && selected <= end;
}

export function getValidTimeOptions(
  date: string,
  openTime = DEFAULT_OPEN_TIME,
  closeTime = DEFAULT_CLOSE_TIME,
  now = new Date()
): string[] {
  const options = buildTimeOptions(
    openTime,
    closeTime,
    TIME_SLOT_INTERVAL_MINUTES
  );
  if (!date) return [];

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const selectedDay = new Date(`${date}T00:00:00`);

  if (selectedDay.getTime() !== today.getTime()) return options;

  return options.filter((time) => {
    const [hour, minute] = time.split(":").map((value) => Number(value));
    const slotDate = new Date(selectedDay);
    slotDate.setHours(hour, minute, 0, 0);
    return slotDate.getTime() > now.getTime();
  });
}

export const TIME_SLOT_OPTIONS = buildTimeOptions();
