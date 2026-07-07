import { SalesModel } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type {
  CreateFunnelInput,
  FunnelStageInput,
  UpdateFunnelInput,
} from "./sales-funnel.types";

const SALES_MODELS = new Set<string>(Object.values(SalesModel));

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseSalesModel(value: unknown, field = "salesModel"): SalesModel {
  if (typeof value !== "string" || !SALES_MODELS.has(value)) {
    throw new AppError("VALIDATION_ERROR", "Invalid sales model", 400, { field });
  }
  return value as SalesModel;
}

function parseOptionalSalesModel(
  value: unknown,
  field = "salesModel",
): SalesModel | undefined {
  if (value === undefined || value === null) return undefined;
  return parseSalesModel(value, field);
}

function parseNullableSalesModel(value: unknown): SalesModel | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseSalesModel(value);
}

function parsePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a positive number`, 400, {
      field,
    });
  }
  return value;
}

function parseOptionalPositiveNumber(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return parsePositiveNumber(value, field);
}

function parseNullablePositiveNumber(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parsePositiveNumber(value, field);
}

function parseStageCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a non-negative number`, 400, {
      field,
    });
  }
  return value;
}

function parseStages(value: unknown): FunnelStageInput[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("VALIDATION_ERROR", "stages must be a non-empty array", 400, {
      field: "stages",
    });
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new AppError("VALIDATION_ERROR", "Invalid stage entry", 400, {
        field: `stages[${index}]`,
      });
    }

    const stage = item as Record<string, unknown>;
    if (!isNonEmptyString(stage.name)) {
      throw new AppError("VALIDATION_ERROR", "Stage name is required", 400, {
        field: `stages[${index}].name`,
      });
    }

    const domainId =
      typeof stage.domainId === "string" && stage.domainId.trim().length > 0
        ? stage.domainId.trim()
        : undefined;

    return {
      name: stage.name.trim(),
      count: parseStageCount(stage.count, `stages[${index}].count`),
      domainId,
    };
  });
}

export function validateCreateFunnelRequest(body: unknown): CreateFunnelInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;

  if (!isNonEmptyString(data.name)) {
    throw new AppError("VALIDATION_ERROR", "Name is required", 400, { field: "name" });
  }

  const assessmentSessionId =
    typeof data.assessmentSessionId === "string"
      ? data.assessmentSessionId.trim()
      : undefined;
  const organizationId =
    typeof data.organizationId === "string"
      ? data.organizationId.trim()
      : undefined;

  return {
    name: data.name.trim(),
    prefillFromAssessment: data.prefillFromAssessment === true,
    assessmentSessionId: assessmentSessionId || undefined,
    organizationId: organizationId || undefined,
    salesModel: parseOptionalSalesModel(data.salesModel),
    averageOrderValue: parseOptionalPositiveNumber(
      data.averageOrderValue,
      "averageOrderValue",
    ),
    repeatPurchaseRate: parseOptionalPositiveNumber(
      data.repeatPurchaseRate,
      "repeatPurchaseRate",
    ),
    stages: parseStages(data.stages),
  };
}

export function validateUpdateFunnelRequest(body: unknown): UpdateFunnelInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;
  const result: UpdateFunnelInput = {};

  if ("name" in data) {
    if (!isNonEmptyString(data.name)) {
      throw new AppError("VALIDATION_ERROR", "Name is required", 400, { field: "name" });
    }
    result.name = data.name.trim();
  }

  if ("salesModel" in data) {
    result.salesModel = parseNullableSalesModel(data.salesModel);
  }

  if ("averageOrderValue" in data) {
    result.averageOrderValue = parseNullablePositiveNumber(
      data.averageOrderValue,
      "averageOrderValue",
    );
  }

  if ("repeatPurchaseRate" in data) {
    result.repeatPurchaseRate = parseNullablePositiveNumber(
      data.repeatPurchaseRate,
      "repeatPurchaseRate",
    );
  }

  if ("assessmentSessionId" in data) {
    result.assessmentSessionId =
      typeof data.assessmentSessionId === "string"
        ? data.assessmentSessionId.trim()
        : data.assessmentSessionId === null
          ? null
          : undefined;
  }

  if ("organizationId" in data) {
    result.organizationId =
      typeof data.organizationId === "string"
        ? data.organizationId.trim()
        : data.organizationId === null
          ? null
          : undefined;
  }

  if ("stages" in data) {
    result.stages = parseStages(data.stages);
  }

  if (Object.keys(result).length === 0) {
    throw new AppError("VALIDATION_ERROR", "No fields to update", 400);
  }

  return result;
}
