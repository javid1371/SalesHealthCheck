import { randomBytes } from "crypto";

export function generateResultToken(): string {
  return randomBytes(32).toString("hex");
}
