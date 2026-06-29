export const TEAM_SIZE_OPTIONS = [
  { value: "1", label: "فقط خودم" },
  { value: "1-5", label: "۱ تا ۵ نفر" },
  { value: "6-10", label: "۶ تا ۱۰ نفر" },
  { value: "11-25", label: "۱۱ تا ۲۵ نفر" },
  { value: "26-50", label: "۲۶ تا ۵۰ نفر" },
  { value: "50+", label: "بیش از ۵۰ نفر" },
];

export function teamSizeLabel(value: string | null): string {
  const option = TEAM_SIZE_OPTIONS.find((o) => o.value === value);
  return option?.label ?? String(value ?? "—");
}
