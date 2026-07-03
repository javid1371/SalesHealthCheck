import { db } from "@/lib/db";
import {
  FUNNEL_SEQUENCES,
  type SequenceKey,
} from "@/modules/sms-funnel/sequences";

async function main() {
  for (const key of Object.keys(FUNNEL_SEQUENCES) as SequenceKey[]) {
    const sequence = FUNNEL_SEQUENCES[key];
    for (const step of sequence.steps) {
      await db.smsFunnelStepConfig.upsert({
        where: {
          sequenceKey_stepKey: {
            sequenceKey: key,
            stepKey: step.stepKey,
          },
        },
        create: {
          sequenceKey: key,
          stepKey: step.stepKey,
          body: step.body,
          bodyLow: step.bodyByScoreBand?.low ?? null,
          bodyMedium: step.bodyByScoreBand?.medium ?? null,
          bodyHigh: step.bodyByScoreBand?.high ?? null,
          delayMs: step.delayMs,
          enabled: true,
        },
        update: {},
      });
    }
  }

  console.log("SMS funnel step configs seeded from defaults.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
