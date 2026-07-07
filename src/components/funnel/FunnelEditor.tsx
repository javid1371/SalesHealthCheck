"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DownloadFunnelExports } from "@/components/funnel/DownloadFunnelExports";
import { FunnelAnalysisPanel } from "@/components/funnel/FunnelAnalysisPanel";
import { SalesFunnelChart } from "@/components/funnel/SalesFunnelChart";
import { FunnelTransitionLabels } from "@/components/funnel/FunnelTransitionLabels";
import {
  buildShareChartUrl,
  formatPercent,
  toChartStages,
} from "@/components/funnel/funnel-utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiClientError, apiPatch, apiPost } from "@/lib/api-client";
import { formatPersianNumber } from "@/lib/report-ui";
import { SALES_MODEL_OPTIONS, salesModelLabel } from "@/lib/sales-model";
import {
  computeSalesFunnel,
  goalSeek,
  whatIf,
} from "@/modules/sales-funnel/sales-funnel.engine";
import type { FunnelResponse } from "@/modules/sales-funnel/sales-funnel.types";

type StageDraft = {
  name: string;
  count: string;
};

interface FunnelEditorProps {
  initialFunnel: FunnelResponse;
}

export function FunnelEditor({ initialFunnel }: FunnelEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialFunnel.name);
  const [salesModel, setSalesModel] = useState(initialFunnel.salesModel ?? "");
  const [averageOrderValue, setAverageOrderValue] = useState(
    initialFunnel.averageOrderValue?.toString() ?? "",
  );
  const [repeatPurchaseRate, setRepeatPurchaseRate] = useState(
    initialFunnel.repeatPurchaseRate?.toString() ?? "",
  );
  const [stages, setStages] = useState<StageDraft[]>(
    initialFunnel.stages.map((stage) => ({
      name: stage.name,
      count: String(stage.count),
    })),
  );
  const [whatIfStageIndex, setWhatIfStageIndex] = useState(0);
  const [whatIfDelta, setWhatIfDelta] = useState(0);
  const [goalTarget, setGoalTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const parsedStages = useMemo(
    () =>
      stages.map((stage) => ({
        name: stage.name.trim(),
        count: Number.parseFloat(stage.count),
      })),
    [stages],
  );

  const engineInput = useMemo(
    () => ({
      stages: parsedStages,
      aov: averageOrderValue ? Number.parseFloat(averageOrderValue) : undefined,
      repeatRate: repeatPurchaseRate
        ? Number.parseFloat(repeatPurchaseRate)
        : undefined,
    }),
    [parsedStages, averageOrderValue, repeatPurchaseRate],
  );

  const baseAnalysis = useMemo(
    () => computeSalesFunnel(engineInput),
    [engineInput],
  );

  const previewAnalysis = useMemo(() => {
    if (whatIfDelta === 0) return baseAnalysis;
    return whatIf(engineInput, whatIfStageIndex, whatIfDelta) ?? baseAnalysis;
  }, [baseAnalysis, engineInput, whatIfDelta, whatIfStageIndex]);

  const goalSeekResult = useMemo(() => {
    const target = Number.parseFloat(goalTarget);
    if (!Number.isFinite(target) || target <= 0) return null;
    return goalSeek(engineInput, target);
  }, [engineInput, goalTarget]);

  const chartStages = toChartStages(previewAnalysis);
  const shareUrl = buildShareChartUrl(
    initialFunnel.id,
    initialFunnel.shareToken,
  );

  function updateStage(index: number, patch: Partial<StageDraft>) {
    setStages((current) =>
      current.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, ...patch } : stage,
      ),
    );
  }

  function addStage() {
    setStages((current) => [...current, { name: "مرحله جدید", count: "0" }]);
  }

  function removeStage(index: number) {
    setStages((current) => current.filter((_, stageIndex) => stageIndex !== index));
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await apiPatch<FunnelResponse>(`/api/funnels/${initialFunnel.id}`, {
        name: name.trim(),
        salesModel: salesModel || null,
        averageOrderValue: averageOrderValue
          ? Number.parseFloat(averageOrderValue)
          : null,
        repeatPurchaseRate: repeatPurchaseRate
          ? Number.parseFloat(repeatPurchaseRate)
          : null,
        stages: parsedStages,
      });
      setSuccess("قیف ذخیره شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "ذخیره قیف با خطا مواجه شد.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSnapshot() {
    setError(null);
    setSnapshotLoading(true);

    try {
      await apiPost(`/api/funnels/${initialFunnel.id}/snapshot`);
      setSuccess("تصویر لحظه‌ای ثبت شد.");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "ثبت تصویر لحظه‌ای با خطا مواجه شد.",
      );
    } finally {
      setSnapshotLoading(false);
    }
  }

  async function handleCopyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("کپی لینک اشتراک‌گذاری ممکن نشد.");
    }
  }

  function applyGoalSeek() {
    if (!goalSeekResult) return;
    setStages(
      goalSeekResult.requiredStages.map((stage) => ({
        name: stage.name,
        count: String(stage.count),
      })),
    );
    setSuccess("مراحل بر اساس هدف مشتری به‌روز شد. برای ذخیره دائمی «ذخیره» را بزنید.");
  }

  const transitionCount = Math.max(parsedStages.length - 1, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">
            مدل فروش: {salesModelLabel(initialFunnel.salesModel)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DownloadFunnelExports funnelId={initialFunnel.id} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleCopyShareLink()}
          >
            {copied ? "کپی شد" : "کپی لینک اشتراک"}
          </Button>
          <Link
            href={`/funnel/${initialFunnel.id}/chart?token=${encodeURIComponent(initialFunnel.shareToken)}`}
            className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-medium text-zinc-900 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
          >
            پیش‌نمایش اشتراک
          </Link>
          <Button
            variant="secondary"
            size="sm"
            loading={snapshotLoading}
            loadingLabel="در حال ثبت…"
            onClick={() => void handleSnapshot()}
          >
            ثبت snapshot
          </Button>
          <Button
            size="sm"
            loading={loading}
            loadingLabel="در حال ذخیره…"
            onClick={() => void handleSave()}
          >
            ذخیره
          </Button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">تنظیمات قیف</h2>
            <FieldLabel label="نام" htmlFor="funnel-edit-name">
              <Input
                id="funnel-edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FieldLabel>
            <FieldLabel label="مدل فروش" htmlFor="funnel-edit-model">
              <Select
                id="funnel-edit-model"
                value={salesModel}
                onChange={(e) => setSalesModel(e.target.value)}
              >
                <option value="">—</option>
                {SALES_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="میانگین ارزش سفارش (AOV)" htmlFor="funnel-aov">
                <Input
                  id="funnel-aov"
                  type="number"
                  min="0"
                  step="any"
                  value={averageOrderValue}
                  onChange={(e) => setAverageOrderValue(e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="نرخ خرید تکراری" htmlFor="funnel-repeat">
                <Input
                  id="funnel-repeat"
                  type="number"
                  min="0"
                  step="any"
                  value={repeatPurchaseRate}
                  onChange={(e) => setRepeatPurchaseRate(e.target.value)}
                />
              </FieldLabel>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-900">مراحل قیف</h2>
              <Button variant="secondary" size="sm" onClick={addStage}>
                افزودن مرحله
              </Button>
            </div>
            <div className="space-y-3">
              {stages.map((stage, index) => (
                <div
                  key={`stage-${index}`}
                  className="grid gap-3 rounded-xl border border-zinc-200 p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
                >
                  <FieldLabel label={`مرحله ${index + 1}`}>
                    <Input
                      value={stage.name}
                      onChange={(e) =>
                        updateStage(index, { name: e.target.value })
                      }
                    />
                  </FieldLabel>
                  <FieldLabel label="تعداد">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={stage.count}
                      onChange={(e) =>
                        updateStage(index, { count: e.target.value })
                      }
                    />
                  </FieldLabel>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={stages.length <= 1}
                      onClick={() => removeStage(index)}
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">What-if</h2>
            <p className="text-sm text-zinc-600">
              تغییر موقت نرخ تبدیل یک مرحله برای پیش‌نمایش اثر روی قیف.
            </p>
            {transitionCount > 0 ? (
              <>
                <FieldLabel label="مرحله" htmlFor="what-if-stage">
                  <Select
                    id="what-if-stage"
                    value={String(whatIfStageIndex)}
                    onChange={(e) =>
                      setWhatIfStageIndex(Number.parseInt(e.target.value, 10))
                    }
                  >
                    {parsedStages.slice(0, -1).map((stage, index) => (
                      <option key={`what-if-${index}`} value={index}>
                        {stage.name} → {parsedStages[index + 1]?.name}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>
                <FieldLabel
                  label={`تغییر نرخ تبدیل: ${formatPercent(whatIfDelta)}`}
                  htmlFor="what-if-delta"
                >
                  <input
                    id="what-if-delta"
                    type="range"
                    min={-0.3}
                    max={0.3}
                    step={0.01}
                    value={whatIfDelta}
                    onChange={(e) =>
                      setWhatIfDelta(Number.parseFloat(e.target.value))
                    }
                    className="w-full"
                  />
                </FieldLabel>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setWhatIfDelta(0)}
                >
                  بازنشانی what-if
                </Button>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                حداقل دو مرحله برای what-if لازم است.
              </p>
            )}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">Goal-seek</h2>
            <p className="text-sm text-zinc-600">
              تعداد مشتری هدف را وارد کنید تا تعداد لازم در هر مرحله محاسبه شود.
            </p>
            <FieldLabel label="مشتری هدف (ماهانه)" htmlFor="goal-target">
              <Input
                id="goal-target"
                type="number"
                min="1"
                step="any"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
              />
            </FieldLabel>
            {goalSeekResult && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                <p className="font-medium">مراحل پیشنهادی:</p>
                <ul className="mt-2 space-y-1">
                  {goalSeekResult.requiredStages.map((stage) => (
                    <li key={stage.name}>
                      {stage.name}: {formatPersianNumber(stage.count)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-zinc-500">
                  نرخ تبدیل کلی:{" "}
                  {formatPercent(goalSeekResult.overallConversionRate)}
                </p>
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={!goalSeekResult}
              onClick={applyGoalSeek}
            >
              اعمال به مراحل
            </Button>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">نمودار قیف</h2>
            <SalesFunnelChart stages={chartStages} height={360} />
            {previewAnalysis && (
              <FunnelTransitionLabels
                transitions={previewAnalysis.transitions}
                bottleneckTransitionIndex={
                  previewAnalysis.bottleneck?.transitionIndex
                }
              />
            )}
          </Card>
          <FunnelAnalysisPanel analysis={previewAnalysis} />
        </div>
      </div>
    </div>
  );
}
