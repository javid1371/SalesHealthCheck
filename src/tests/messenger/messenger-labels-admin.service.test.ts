import { beforeEach, describe, expect, it, vi } from "vitest";

const mockList = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/modules/messenger/messenger-labels.repository", () => ({
  listMessengerLabelsForAdmin: (...args: unknown[]) => mockList(...args),
  updateMessengerLabels: (...args: unknown[]) => mockUpdate(...args),
}));

describe("messenger-labels-admin.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      domains: [],
      modelVersionId: "model-1",
      modelVersionName: "v1",
    });
    mockUpdate.mockImplementation(async (updates: unknown[]) => ({
      updated: updates.length,
    }));
  });

  it("returns admin list payload", async () => {
    const { getMessengerLabelsForAdmin } = await import(
      "@/modules/messenger/messenger-labels-admin.service"
    );

    await expect(getMessengerLabelsForAdmin()).resolves.toEqual({
      domains: [],
      modelVersionId: "model-1",
      modelVersionName: "v1",
    });
  });

  it("normalizes empty labels to null and enforces 64-char max", async () => {
    const { saveMessengerLabels } = await import(
      "@/modules/messenger/messenger-labels-admin.service"
    );

    await expect(
      saveMessengerLabels([
        { optionId: "opt-1", messengerLabel: "  " },
        { optionId: "opt-2", messengerLabel: "برچسب کوتاه" },
      ]),
    ).resolves.toEqual({ updated: 2 });

    expect(mockUpdate).toHaveBeenCalledWith([
      { optionId: "opt-1", messengerLabel: null },
      { optionId: "opt-2", messengerLabel: "برچسب کوتاه" },
    ]);

    await expect(
      saveMessengerLabels([
        {
          optionId: "opt-3",
          messengerLabel: "الف".repeat(65),
        },
      ]),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("rejects missing optionId", async () => {
    const { saveMessengerLabels } = await import(
      "@/modules/messenger/messenger-labels-admin.service"
    );

    await expect(
      saveMessengerLabels([{ optionId: "", messengerLabel: "x" }]),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });
});
