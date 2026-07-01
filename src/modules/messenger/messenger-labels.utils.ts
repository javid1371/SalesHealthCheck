export const MESSENGER_BUTTON_MAX_LENGTH = 64;

export function truncateMessengerLabel(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MESSENGER_BUTTON_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MESSENGER_BUTTON_MAX_LENGTH - 1)}…`;
}

export function resolveMessengerButtonLabel(
  messengerLabel: string | null | undefined,
  optionText: string,
): string {
  if (messengerLabel?.trim()) {
    return truncateMessengerLabel(messengerLabel);
  }

  return truncateMessengerLabel(optionText);
}
