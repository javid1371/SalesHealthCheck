#!/usr/bin/env node
/**
 * MVP QA runner — exercises API flows for scenarios 1–6 against a running server.
 * Usage: node scripts/run-mvp-qa.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

const results = [];

function log(msg) {
  console.log(msg);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function record(scenario, pass, notes) {
  results.push({ scenario, pass, notes });
  log(`  ${pass ? "PASS" : "FAIL"} — ${notes}`);
}

function qaUser(suffix) {
  return {
    user: {
      name: `QA Tester ${suffix}`,
      email: `qa-${suffix}@example.com`,
      phone: `0912${String(suffix).padStart(7, "0")}`,
    },
    organization: {
      businessName: `QA Biz ${suffix}`,
      industry: "technology",
      teamSize: "1-5",
      salesModel: "online",
    },
  };
}

async function startAssessment(suffix) {
  const { status, json } = await api("POST", "/api/assessments/start", qaUser(suffix));
  if (status !== 200) throw new Error(`start failed: ${status} ${JSON.stringify(json)}`);
  return json;
}

async function fetchQuestions(assessmentId) {
  const { status, json } = await api("GET", `/api/assessments/${assessmentId}/questions`);
  if (status !== 200) throw new Error(`questions failed: ${status}`);
  return json;
}

async function saveAllAnswers(assessmentId, questionsPayload, domainLimit = 16) {
  const domains = questionsPayload.domains.slice(0, domainLimit);
  const answers = [];
  for (const domain of domains) {
    for (const question of domain.questions) {
      const option = question.options[2] ?? question.options[0];
      answers.push({ questionId: question.id, selectedOptionId: option.id });
    }
  }
  const { status, json } = await api("POST", `/api/assessments/${assessmentId}/answers`, {
    answers,
  });
  if (status !== 200) throw new Error(`saveAnswers failed: ${status} ${JSON.stringify(json)}`);
  return answers;
}

async function finish(assessmentId) {
  return api("POST", `/api/assessments/${assessmentId}/finish`, {});
}

async function getResult(assessmentId, token) {
  return api("GET", `/api/assessments/${assessmentId}/result?token=${encodeURIComponent(token)}`);
}

async function getReport(reportId, token) {
  return api("GET", `/api/reports/${reportId}?token=${encodeURIComponent(token)}`);
}

async function scenario1() {
  log("\n=== Scenario 1 — Full completion ===");
  const start = await startAssessment("s1");
  const questions = await fetchQuestions(start.assessmentId);
  await saveAllAnswers(start.assessmentId, questions);
  const finishRes = await finish(start.assessmentId);
  const okFinish =
    finishRes.status === 200 &&
    finishRes.json?.reportId &&
    finishRes.json?.status === "completed";
  record(1, okFinish, okFinish ? `reportId=${finishRes.json.reportId}` : `finish status ${finishRes.status}`);

  const resultRes = await getResult(start.assessmentId, start.resultToken);
  const hasScore = resultRes.json?.overallScore != null;
  const bottlenecks = resultRes.json?.bottlenecks ?? [];
  record(
    1,
    resultRes.status === 200 && hasScore && bottlenecks.length >= 3,
    `result: score=${hasScore}, bottlenecks=${bottlenecks.length}`,
  );

  const reportRes = await getReport(finishRes.json.reportId, start.resultToken);
  const hasReportSpec = reportRes.json?.reportSpec != null;
  record(
    1,
    reportRes.status === 200 && hasReportSpec,
    `detailed report: reportSpec=${hasReportSpec}`,
  );

  return { start, finishRes, resultRes, reportRes };
}

async function scenario2() {
  log("\n=== Scenario 2 — Incomplete assessment ===");
  const start = await startAssessment("s2");
  const questions = await fetchQuestions(start.assessmentId);
  await saveAllAnswers(start.assessmentId, questions, 3);
  const finishRes = await finish(start.assessmentId);
  const rejected =
    finishRes.status === 400 && finishRes.json?.code === "assessment_not_complete";
  record(2, rejected, rejected ? "400 assessment_not_complete" : `unexpected ${finishRes.status}`);
}

async function scenario3() {
  log("\n=== Scenario 3 — Change answer before finish ===");
  const start = await startAssessment("s3");
  const questions = await fetchQuestions(start.assessmentId);
  const answers = await saveAllAnswers(start.assessmentId, questions);

  const firstDomain = questions.domains[0];
  const firstQuestion = firstDomain.questions[0];
  const altOption =
    firstQuestion.options.find((o) => o.id !== answers[0].selectedOptionId) ??
    firstQuestion.options[0];

  await api("POST", `/api/assessments/${start.assessmentId}/answers`, {
    answers: [{ questionId: firstQuestion.id, selectedOptionId: altOption.id }],
  });

  const finishRes = await finish(start.assessmentId);
  const ok = finishRes.status === 200 && finishRes.json?.reportId;
  record(3, ok, ok ? "finish after answer change succeeded" : `finish failed ${finishRes.status}`);

  const resultRes = await getResult(start.assessmentId, start.resultToken);
  const domainScores = resultRes.json?.domainScores ?? [];
  const changedDomain = domainScores.find((d) => d.domainSlug === firstDomain.slug);
  record(
    3,
    resultRes.status === 200 && changedDomain != null,
    changedDomain ? `domain ${firstDomain.slug} score=${changedDomain.score}` : "missing domain score",
  );
}

async function scenario4(ctx) {
  log("\n=== Scenario 4 — Revisit with token ===");
  const { start, resultRes: first } = ctx;
  const second = await getResult(start.assessmentId, start.resultToken);
  const sameScore =
    first.json?.overallScore?.score === second.json?.overallScore?.score &&
    first.json?.reportId === second.json?.reportId;
  record(
    4,
    second.status === 200 && sameScore,
    sameScore
      ? `same reportId and overall score on revisit`
      : `mismatch first=${first.json?.overallScore?.score} second=${second.json?.overallScore?.score}`,
  );
}

async function scenario5(ctx) {
  log("\n=== Scenario 5 — Idempotent finish ===");
  const { start, finishRes: firstFinish } = ctx;
  const secondFinish = await finish(start.assessmentId);
  const sameReport =
    secondFinish.status === 200 &&
    secondFinish.json?.reportId === firstFinish.json.reportId;
  record(
    5,
    sameReport,
    sameReport
      ? `reportId unchanged: ${firstFinish.json.reportId}`
      : `reportId changed ${firstFinish.json.reportId} -> ${secondFinish.json?.reportId}`,
  );
}

async function scenario6(ctx) {
  log("\n=== Scenario 6 — CTA lead form ===");
  const { start, finishRes } = ctx;
  const body = {
    assessmentSessionId: start.assessmentId,
    reportId: finishRes.json.reportId,
    token: start.resultToken,
    name: "QA Lead",
    phone: "09120000001",
    preferredContact: "phone",
  };
  const res = await api("POST", "/api/consultation-requests", body);
  const ok = res.status === 200 && res.json?.id;
  record(6, ok, ok ? `consultation id=${res.json.id}` : `submit failed ${res.status} ${JSON.stringify(res.json)}`);
}

async function main() {
  log(`MVP QA runner — ${BASE}`);
  log(`Date: ${new Date().toISOString()}`);

  const health = await fetch(`${BASE}/`).catch(() => null);
  if (!health?.ok) {
    console.error(`Server not reachable at ${BASE}`);
    process.exit(1);
  }

  const s1 = await scenario1();
  await scenario2();
  await scenario3();
  await scenario4(s1);
  await scenario5(s1);
  await scenario6(s1);

  const failed = results.filter((r) => !r.pass);
  log(`\n--- Summary: ${results.length - failed.length}/${results.length} checks passed ---`);
  if (failed.length) {
    failed.forEach((f) => log(`  FAIL scenario ${f.scenario}: ${f.notes}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
