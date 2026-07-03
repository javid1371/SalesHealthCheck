export interface SmsSendResult {
  providerMessageId?: string;
}

export interface SmsSender {
  sendOtp(phone: string, code: string): Promise<void>;
  sendMessage(phone: string, message: string): Promise<SmsSendResult>;
}
