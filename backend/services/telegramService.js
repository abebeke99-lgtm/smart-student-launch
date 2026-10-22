const TELEGRAM_MESSAGE_LIMIT = 4096;
const DEFAULT_PORTAL_URL = "http://localhost:3000/login";

const escapeHTML = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getStudentName = (item) => {
  if (item && typeof item === "object") {
    return item.studentName || item.student || item.name || "";
  }
  return item || "";
};

const getUniqueStudentNames = (pendingEvaluations = []) => {
  const uniqueNames = new Map();
  const evaluations = Array.isArray(pendingEvaluations)
    ? pendingEvaluations
    : [];
  evaluations.forEach((item) => {
    const name = String(getStudentName(item) || "").trim();
    const normalizedName = name.toLocaleLowerCase();
    if (normalizedName && !uniqueNames.has(normalizedName)) {
      uniqueNames.set(normalizedName, name);
    }
  });
  return [...uniqueNames.values()];
};

const getPortalLoginUrl = () => {
  const configuredUrl = String(
    process.env.FRONTEND_URL || DEFAULT_PORTAL_URL,
  ).trim();
  const portalUrl = new URL(configuredUrl);
  if (portalUrl.pathname === "/" || portalUrl.pathname === "") {
    portalUrl.pathname = "/login";
  }
  return portalUrl.toString();
};

const buildStrictTelegramMessage = (
  departmentName,
  pendingEvaluations = [],
) => {
  const department = departmentName || "Computer Science";
  const studentNames = getUniqueStudentNames(pendingEvaluations);
  const lines = [
    "⚠️ <b>ጥብቅ ማሳሰቢያ፡ የመምህራን ምዘና እና የፋይናል ፈተና</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    `🏛 <b>ዲፓርትመንት:</b> <code>${escapeHTML(department)}</code>`,
    "",
    "ውድ ተማሪዎች፣ ከዚህ በታች የተዘረዘሩት ተማሪዎች እስካሁን ድረስ የመምህራንን የኢፊሸንሲ (Efficiency) ምዘና <b>አላጠናቀቁም</b>።",
    "",
    "🔴 <b>ማሳሰቢያ:</b> ተማሪዎች እስከ ተጠቀሰው ቀን ድረስ ይህንን ምዘና ካላጠናቀቁ <b>የፋይናል ፈተና (Final Exam) መቀመጥ እንደማይችሉ</b> በጥብቅ እናሳስባለን!",
    "",
    "📋 <b>ያልተጠናቀቁ ምዘናዎች ዝርዝር:</b>",
    "────────────────────",
  ];

  if (studentNames.length) {
    studentNames.forEach((name, index) => {
      lines.push(`👤 <b>${index + 1}. Student:</b> ${escapeHTML(name)}`);
    });
  } else {
    lines.push("<i>ምንም ያልተጠናቀቀ ምዘና የለም።</i>");
  }

  lines.push(
    "────────────────────",
    "",
    "👉 <b>እባክዎን ወዲያውኑ ወደ IPES ፖርታል በመግባት ምዘናዎን ያጠናቅቁ!</b>",
    `<a href="${escapeHTML(getPortalLoginUrl())}">🔗https://ipes-1.onrender.com እዚህ በመጫን ወደ ፖርታል ይግቡ</a>`,
  );

  return lines.join("\n");
};

const sendTelegramNotice = async (
  chatId,
  departmentName,
  pendingList = [],
) => {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    console.warn(
      "Telegram reminder skipped: TELEGRAM_BOT_TOKEN is not configured.",
    );
    return { ok: false, skipped: true, reason: "not_configured" };
  }

  const resolvedChatId = String(
    chatId || process.env.TELEGRAM_CHAT_ID || "",
  ).trim();
  if (!resolvedChatId) {
    throw new Error("TELEGRAM_CHAT_ID is missing in environment variables.");
  }

  const text = buildStrictTelegramMessage(departmentName, pendingList);
  if (text.length > TELEGRAM_MESSAGE_LIMIT) {
    throw new Error(
      `Telegram warning message is ${text.length} characters; the maximum is ${TELEGRAM_MESSAGE_LIMIT}.`,
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: resolvedChatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );

  const responseBody = await response.text();
  let result = null;
  try {
    result = responseBody ? JSON.parse(responseBody) : null;
  } catch {
    result = null;
  }

  if (!response.ok || !result?.ok) {
    const error = new Error(
      result?.description ||
        responseBody ||
        `Telegram API returned status ${response.status}.`,
    );
    error.telegramDetails = {
      chat_id: resolvedChatId,
      status: response.status,
      error_code: result?.error_code,
      description: result?.description,
      parameters: result?.parameters,
      response_body: responseBody.slice(0, 1000) || undefined,
    };
    console.error("Telegram warning notification failed:", {
      ...error.telegramDetails,
      error: error.message,
    });
    throw error;
  }

  return result;
};

module.exports = { buildStrictTelegramMessage, sendTelegramNotice };
