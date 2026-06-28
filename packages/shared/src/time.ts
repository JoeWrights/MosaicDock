export function formatTime(dateString: string, style = "friendly"): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const dateTime = date.getTime();
  if (Number.isNaN(dateTime)) return "";

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const dateCompare = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();

  if (style !== "friendly") {
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const diffDays = Math.floor((todayStart - dateCompare) / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (diffDays === 1) return "昨天";
  if (diffDays === 2) return "前天";

  const day = date.getDay();
  const weekStart =
    todayStart - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;

  if (dateCompare >= weekStart) {
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][day];
  }

  const lastWeekStart = weekStart - 7 * 86400000;
  if (dateCompare >= lastWeekStart && dateCompare < weekStart) {
    return "上周";
  }

  if (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return "更早";
}
