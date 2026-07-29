/**
 * Full assessment load test (ADR 0017 Phase 9).
 *
 * Flow per VU: OTP login → start → questions → save answers → finish → poll → result
 *
 * Target must expose OTP `devCode` (non-production without Kavenegar), OR pass
 * SESSION_COOKIE to skip auth. Spoofs X-Forwarded-For per VU so IP rate limits
 * do not collapse all traffic into one bucket.
 *
 * See docs/ops/load-test.md
 */
import http from "k6/http";
import { check, fail, group, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SCENARIO = __ENV.SCENARIO || "smoke";
const POLL_INTERVAL_SEC = Number(__ENV.POLL_INTERVAL_SEC || 2);
const POLL_TIMEOUT_SEC = Number(__ENV.POLL_TIMEOUT_SEC || 90);
const SESSION_COOKIE = __ENV.SESSION_COOKIE || "";

const browseDuration = new Trend("browse_duration", true);
const saveDuration = new Trend("save_duration", true);
const finishCompleteDuration = new Trend("finish_complete_duration", true);
const errorRate = new Rate("errors");
const finishFailed = new Counter("finish_failed");

function scenarioOptions() {
  switch (SCENARIO) {
    case "browse":
      // 100 VU save/browse — acceptance: p95 < 2s
      return {
        executor: "constant-vus",
        vus: Number(__ENV.VUS || 100),
        duration: __ENV.DURATION || "2m",
      };
    case "finish":
      // 20 concurrent finish — acceptance: p95 complete < 30s
      return {
        executor: "constant-vus",
        vus: Number(__ENV.VUS || 20),
        duration: __ENV.DURATION || "3m",
      };
    case "full":
      return {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
          { duration: "30s", target: 20 },
          { duration: "2m", target: 100 },
          { duration: "1m", target: 100 },
          { duration: "30s", target: 0 },
        ],
      };
    case "smoke":
    default:
      return {
        executor: "constant-vus",
        vus: Number(__ENV.VUS || 2),
        duration: __ENV.DURATION || "30s",
      };
  }
}

export const options = {
  scenarios: {
    assessment: scenarioOptions(),
  },
  thresholds: {
    errors: ["rate<0.01"],
    browse_duration: ["p(95)<2000"],
    save_duration: ["p(95)<2000"],
    ...(SCENARIO === "finish" || SCENARIO === "full"
      ? { finish_complete_duration: ["p(95)<30000"] }
      : {}),
    http_req_failed: ["rate<0.01"],
  },
};

function vuIp() {
  // Distinct /24-ish addresses so start/OTP IP limiters do not trip.
  const a = 10;
  const b = (__VU % 250) + 1;
  const c = (__ITER % 250) + 1;
  const d = (__VU % 200) + 20;
  return `${a}.${b}.${c}.${d}`;
}

function headers(extra) {
  return Object.assign(
    {
      "Content-Type": "application/json",
      "X-Forwarded-For": vuIp(),
    },
    extra || {},
  );
}

function assessmentHeaders(token) {
  return headers({ "X-Assessment-Token": token });
}

function uniquePhone() {
  // 09xxxxxxxxx — unique per VU/iteration within Iranian mobile shape
  const suffix = String((__VU * 100000 + (__ITER % 100000)) % 1000000000).padStart(
    9,
    "0",
  );
  return `09${suffix}`;
}

function extractSessionCookie(res) {
  const jar = http.cookieJar();
  const cookies = jar.cookiesForURL(BASE_URL);
  if (cookies.shc_user_session && cookies.shc_user_session.length > 0) {
    return cookies.shc_user_session[0];
  }

  const raw = res.headers["Set-Cookie"] || res.headers["set-cookie"];
  if (!raw) return null;
  const parts = Array.isArray(raw) ? raw : [raw];
  for (const part of parts) {
    const match = String(part).match(/shc_user_session=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

function loginWithOtp() {
  const phone = uniquePhone();
  const sendRes = http.post(
    `${BASE_URL}/api/auth/otp/send`,
    JSON.stringify({ phone }),
    { headers: headers() },
  );

  if (
    !check(sendRes, {
      "otp send 200": (r) => r.status === 200,
    })
  ) {
    errorRate.add(1);
    fail(`otp send failed: ${sendRes.status} ${sendRes.body}`);
  }

  let body;
  try {
    body = sendRes.json();
  } catch (e) {
    errorRate.add(1);
    fail(`otp send invalid json: ${sendRes.body}`);
  }

  const code = body.devCode;
  if (!code) {
    errorRate.add(1);
    fail(
      "otp send did not return devCode — use non-production without Kavenegar, or set SESSION_COOKIE",
    );
  }

  const verifyRes = http.post(
    `${BASE_URL}/api/auth/otp/verify`,
    JSON.stringify({ phone, code }),
    { headers: headers() },
  );

  if (
    !check(verifyRes, {
      "otp verify 200": (r) => r.status === 200,
    })
  ) {
    errorRate.add(1);
    fail(`otp verify failed: ${verifyRes.status} ${verifyRes.body}`);
  }

  const cookie = extractSessionCookie(verifyRes);
  if (!cookie) {
    errorRate.add(1);
    fail("missing shc_user_session after otp verify");
  }
  return cookie;
}

function cookieHeader(sessionCookie) {
  return { Cookie: `shc_user_session=${sessionCookie}` };
}

function buildAnswers(questionsBody) {
  const answers = [];
  const domains = questionsBody.domains || [];
  for (let d = 0; d < domains.length; d++) {
    const questions = domains[d].questions || [];
    for (let q = 0; q < questions.length; q++) {
      const question = questions[q];
      const options = question.options || [];
      if (options.length === 0) continue;
      const option = options[2] || options[0];
      answers.push({
        questionId: question.id,
        selectedOptionId: option.id,
      });
    }
  }
  return answers;
}

function pollFinish(assessmentId, token) {
  const deadline = Date.now() + POLL_TIMEOUT_SEC * 1000;
  while (Date.now() < deadline) {
    const res = http.get(`${BASE_URL}/api/assessments/${assessmentId}/finish`, {
      headers: assessmentHeaders(token),
    });

    if (res.status !== 200) {
      errorRate.add(1);
      return { ok: false, status: "http_error", body: res.body };
    }

    const body = res.json();
    if (body.status === "completed") {
      return { ok: true, status: "completed", body };
    }
    if (body.status === "failed") {
      finishFailed.add(1);
      errorRate.add(1);
      return { ok: false, status: "failed", body };
    }

    sleep(POLL_INTERVAL_SEC);
  }

  errorRate.add(1);
  return { ok: false, status: "timeout" };
}

export default function () {
  const sessionCookie = SESSION_COOKIE || loginWithOtp();
  const authHeaders = headers(cookieHeader(sessionCookie));

  let assessmentId;
  let resultToken;

  group("start", () => {
    const startRes = http.post(
      `${BASE_URL}/api/assessments/start`,
      JSON.stringify({
        user: {
          name: `Load VU ${__VU}`,
          email: `load-vu${__VU}-i${__ITER}@example.com`,
        },
        organization: {
          businessName: `Load Co ${__VU}`,
          industry: "technology",
          teamSize: "1-5",
          salesModel: "online",
        },
      }),
      { headers: authHeaders },
    );

    const ok = check(startRes, {
      "start 200": (r) => r.status === 200,
    });
    if (!ok) {
      errorRate.add(1);
      fail(`start failed: ${startRes.status} ${startRes.body}`);
    }

    const body = startRes.json();
    assessmentId = body.assessmentId;
    resultToken = body.resultToken;
    if (!assessmentId || !resultToken) {
      errorRate.add(1);
      fail("start missing assessmentId/resultToken");
    }
  });

  let answers = [];

  group("browse_questions", () => {
    const t0 = Date.now();
    const qRes = http.get(
      `${BASE_URL}/api/assessments/${assessmentId}/questions`,
      { headers: assessmentHeaders(resultToken) },
    );
    browseDuration.add(Date.now() - t0);

    const ok = check(qRes, {
      "questions 200": (r) => r.status === 200,
    });
    if (!ok) {
      errorRate.add(1);
      fail(`questions failed: ${qRes.status} ${qRes.body}`);
    }
    answers = buildAnswers(qRes.json());
    if (answers.length === 0) {
      errorRate.add(1);
      fail("no answers built from questions");
    }
  });

  // browse scenario stops after questions (+ light save); finish/full continue
  group("save_answers", () => {
    const t0 = Date.now();
    const saveRes = http.post(
      `${BASE_URL}/api/assessments/${assessmentId}/answers`,
      JSON.stringify({ answers }),
      { headers: assessmentHeaders(resultToken) },
    );
    saveDuration.add(Date.now() - t0);

    const ok = check(saveRes, {
      "save 200": (r) => r.status === 200,
    });
    if (!ok) {
      errorRate.add(1);
      fail(`save failed: ${saveRes.status} ${saveRes.body}`);
    }
  });

  if (SCENARIO === "browse") {
    sleep(0.5);
    return;
  }

  group("finish", () => {
    const t0 = Date.now();
    const finishRes = http.post(
      `${BASE_URL}/api/assessments/${assessmentId}/finish`,
      JSON.stringify({}),
      { headers: assessmentHeaders(resultToken) },
    );

    const accepted = check(finishRes, {
      "finish 200 or 202": (r) => r.status === 200 || r.status === 202,
    });
    if (!accepted) {
      errorRate.add(1);
      fail(`finish failed: ${finishRes.status} ${finishRes.body}`);
    }

    if (finishRes.status === 200) {
      const body = finishRes.json();
      check(body, {
        "sync finish completed": (b) => b.status === "completed" && !!b.reportId,
      });
      finishCompleteDuration.add(Date.now() - t0);
      return;
    }

    // 202 queued — poll until completed
    const poll = pollFinish(assessmentId, resultToken);
    finishCompleteDuration.add(Date.now() - t0);
    if (!poll.ok) {
      fail(`finish poll ${poll.status}: ${JSON.stringify(poll.body || {})}`);
    }
  });

  group("result", () => {
    const res = http.get(
      `${BASE_URL}/api/assessments/${assessmentId}/result`,
      { headers: assessmentHeaders(resultToken) },
    );
    const ok = check(res, {
      "result 200": (r) => r.status === 200,
    });
    if (!ok) {
      errorRate.add(1);
      fail(`result failed: ${res.status} ${res.body}`);
    }
  });

  sleep(0.3);
}
