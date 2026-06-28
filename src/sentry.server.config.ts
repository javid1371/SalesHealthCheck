import * as Sentry from "@sentry/nextjs";
import { getServerSentryOptions } from "@/lib/sentry-init";

Sentry.init(getServerSentryOptions());
