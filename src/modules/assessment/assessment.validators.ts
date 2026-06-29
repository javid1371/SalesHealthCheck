import { SalesModel } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type {
  FinishAssessmentInput,
  SaveAnswersInput,
  StartAssessmentInput,
  UpdateBusinessInfoInput,
  UpdateBusinessMetricsInput,
} from "./assessment.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SALES_MODELS = new Set<string>(Object.values(SalesModel));

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseSalesModel(value: unknown): SalesModel {
  if (typeof value !== "string" || !SALES_MODELS.has(value)) {
    throw new AppError(
      "invalid_organization_data",
      "Invalid sales model",
      400,
      { field: "salesModel" },
    );
  }
  return value as SalesModel;
}

export function validateStartRequest(body: unknown): StartAssessmentInput {
  if (!body || typeof body !== "object") {
    throw new AppError(
      "invalid_user_data",
      "Request body is required",
      400,
    );
  }

  const { user, organization } = body as Record<string, unknown>;

  if (!user || typeof user !== "object") {
    throw new AppError(
      "invalid_user_data",
      "User information is required",
      400,
    );
  }

  const userObj = user as Record<string, unknown>;
  const name = userObj.name;

  if (!isNonEmptyString(name)) {
    throw new AppError(
      "invalid_user_data",
      "User name is required",
      400,
      { field: "name" },
    );
  }

  const email =
    typeof userObj.email === "string" ? userObj.email.trim() : undefined;

  if (email && !EMAIL_REGEX.test(email)) {
    throw new AppError(
      "invalid_user_data",
      "Invalid email format",
      400,
      { field: "email" },
    );
  }

  if (!organization || typeof organization !== "object") {
    throw new AppError(
      "invalid_organization_data",
      "Organization information is required",
      400,
    );
  }

  const orgObj = organization as Record<string, unknown>;

  if (!isNonEmptyString(orgObj.businessName)) {
    throw new AppError(
      "invalid_organization_data",
      "Business name is required",
      400,
      { field: "businessName" },
    );
  }

  if (!isNonEmptyString(orgObj.teamSize)) {
    throw new AppError(
      "invalid_organization_data",
      "Team size is required",
      400,
      { field: "teamSize" },
    );
  }

  const salesModel = parseSalesModel(orgObj.salesModel);

  return {
    user: {
      name: name.trim(),
      email,
    },
    organization: {
      businessName: orgObj.businessName.trim(),
      industry:
        typeof orgObj.industry === "string"
          ? orgObj.industry.trim() || undefined
          : undefined,
      teamSize: orgObj.teamSize.trim(),
      salesModel,
    },
  };
}

export function validateSaveAnswersRequest(body: unknown): SaveAnswersInput {
  if (!body || typeof body !== "object") {
    throw new AppError(
      "invalid_answer_payload",
      "Request body is required",
      400,
    );
  }

  const { answers } = body as Record<string, unknown>;

  if (!Array.isArray(answers) || answers.length === 0) {
    throw new AppError(
      "invalid_answer_payload",
      "At least one answer is required",
      400,
    );
  }

  const parsed = answers.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new AppError(
        "invalid_answer_payload",
        `Invalid answer at index ${index}`,
        400,
      );
    }

    const answer = entry as Record<string, unknown>;

    if (!isNonEmptyString(answer.questionId)) {
      throw new AppError(
        "invalid_answer_payload",
        "questionId is required for each answer",
        400,
        { index },
      );
    }

    if (!isNonEmptyString(answer.selectedOptionId)) {
      throw new AppError(
        "invalid_answer_payload",
        "selectedOptionId is required for each answer",
        400,
        { index },
      );
    }

    return {
      questionId: answer.questionId.trim(),
      selectedOptionId: answer.selectedOptionId.trim(),
    };
  });

  return { answers: parsed };
}

export function validateBusinessInfoRequest(
  body: unknown,
): UpdateBusinessInfoInput {
  if (!body || typeof body !== "object") {
    throw new AppError(
      "invalid_business_info",
      "Request body is required",
      400,
    );
  }

  const obj = body as Record<string, unknown>;

  if (!isNonEmptyString(obj.businessName)) {
    throw new AppError(
      "invalid_business_info",
      "Business name is required",
      400,
      { field: "businessName" },
    );
  }

  if (!isNonEmptyString(obj.teamSize)) {
    throw new AppError(
      "invalid_business_info",
      "Team size is required",
      400,
      { field: "teamSize" },
    );
  }

  return {
    businessName: obj.businessName.trim(),
    industry:
      typeof obj.industry === "string"
        ? obj.industry.trim() || undefined
        : undefined,
    teamSize: obj.teamSize.trim(),
    salesModel: parseSalesModel(obj.salesModel),
  };
}

function parsePositiveNumber(
  value: unknown,
  field: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new AppError(
      "invalid_business_metrics",
      `${field} must be a positive number`,
      400,
      { field },
    );
  }
  return value;
}

export function validateBusinessMetricsRequest(
  body: unknown,
): UpdateBusinessMetricsInput {
  if (!body || typeof body !== "object") {
    throw new AppError(
      "invalid_business_metrics",
      "Request body is required",
      400,
    );
  }

  const obj = body as Record<string, unknown>;

  const monthlyRevenue = parsePositiveNumber(obj.monthlyRevenue, "monthlyRevenue");
  const averageOrderValue = parsePositiveNumber(
    obj.averageOrderValue,
    "averageOrderValue",
  );
  const monthlyLeads = parsePositiveNumber(obj.monthlyLeads, "monthlyLeads");

  let repeatPurchaseRate: number | undefined;
  if (obj.repeatPurchaseRate !== undefined && obj.repeatPurchaseRate !== null) {
    repeatPurchaseRate = parsePositiveNumber(
      obj.repeatPurchaseRate,
      "repeatPurchaseRate",
    );
  }

  return {
    monthlyRevenue,
    averageOrderValue,
    monthlyLeads,
    repeatPurchaseRate,
  };
}

export function validateFinishRequest(body: unknown): FinishAssessmentInput {
  if (!body || typeof body !== "object") {
    return { generateAiExplanation: false };
  }

  const { generateAiExplanation } = body as Record<string, unknown>;

  return {
    generateAiExplanation: generateAiExplanation === true,
  };
}

export function buildResultUrl(assessmentId: string, resultToken: string): string {
  return `/assessment/${assessmentId}/result?token=${resultToken}`;
}
