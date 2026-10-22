const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildStrictTelegramMessage,
  sendTelegramNotice,
} = require("../services/telegramService");

test("builds strict HTML warning with escaped department, unique students, and login link", () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://portal.example.test/";

  try {
    const message = buildStrictTelegramMessage(
      "Computer Science & <IT>",
      [
        { studentName: "Alemu Aleme" },
        { student: "Abebe" },
        { name: "alemu aleme" },
        "Student <3>",
        { instructorName: "Not a student name" },
      ],
    );

    assert.match(
      message,
      /⚠️ <b>ጥብቅ ማሳሰቢያ፡ የመምህራን ምዘና እና የፋይናል ፈተና<\/b>/,
    );
    assert.match(
      message,
      /🏛 <b>ዲፓርትመንት:<\/b> <code>Computer Science &amp; &lt;IT&gt;<\/code>/,
    );
    assert.match(
      message,
      /የፋይናል ፈተና \(Final Exam\) መቀመጥ እንደማይችሉ/,
    );
    assert.match(message, /👤 <b>1\. Student:<\/b> Alemu Aleme/);
    assert.match(message, /👤 <b>2\. Student:<\/b> Abebe/);
    assert.match(message, /👤 <b>3\. Student:<\/b> Student &lt;3&gt;/);
    assert.doesNotMatch(message, /Student:<\/b> alemu aleme/);
    assert.doesNotMatch(message, /Not a student name/);
    assert.match(
      message,
      /<a href="https:\/\/portal\.example\.test\/login">🔗 እዚህ በመጫን ወደ ፖርታል ይግቡ<\/a>/,
    );
    assert.doesNotMatch(message, /Department ID:|Batch:|Instructor:|Course:/);
  } finally {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  }
});

test("sends a single Telegram HTML message and surfaces API errors", async () => {
  const originalFetch = global.fetch;
  const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  const originalConsoleError = console.error;
  const requestBodies = [];
  const loggedErrors = [];
  let fetchCount = 0;

  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "test-chat";
  console.error = (...args) => loggedErrors.push(args);
  global.fetch = async (url, options) => {
    fetchCount += 1;
    requestBodies.push({ url, options, body: JSON.parse(options.body) });
    return {
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          ok: false,
          error_code: 400,
          description: "Bad Request: chat not found",
        }),
    };
  };

  try {
    await assert.rejects(
      sendTelegramNotice("test-chat", "Computer Science", [
        { studentName: "Alemu" },
      ]),
      /Bad Request: chat not found/,
    );

    assert.equal(fetchCount, 1);
    assert.equal(
      requestBodies[0].url,
      "https://api.telegram.org/bottest-token/sendMessage",
    );
    assert.equal(requestBodies[0].options.method, "POST");
    assert.equal(requestBodies[0].body.chat_id, "test-chat");
    assert.equal(requestBodies[0].body.parse_mode, "HTML");
    assert.equal(requestBodies[0].body.disable_web_page_preview, false);
    assert.match(requestBodies[0].body.text, /Alemu/);
    assert.equal(loggedErrors.length, 1);
    assert.equal(loggedErrors[0][1].error_code, 400);
    assert.equal(loggedErrors[0][1].chat_id, "test-chat");
  } finally {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalBotToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
    }
    if (originalChatId === undefined) {
      delete process.env.TELEGRAM_CHAT_ID;
    } else {
      process.env.TELEGRAM_CHAT_ID = originalChatId;
    }
  }
});

test("skips Telegram reminders with a warning when the bot token is missing", async () => {
  const originalFetch = global.fetch;
  const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  const originalConsoleWarn = console.warn;
  const warnings = [];
  let fetchCount = 0;

  delete process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_CHAT_ID = "test-chat";
  console.warn = (...args) => warnings.push(args);
  global.fetch = async () => {
    fetchCount += 1;
    throw new Error("Telegram must not be contacted without a bot token");
  };

  try {
    const result = await sendTelegramNotice("test-chat", "Computer Science", [
      { studentName: "Alemu" },
    ]);

    assert.deepEqual(result, {
      ok: false,
      skipped: true,
      reason: "not_configured",
    });
    assert.equal(fetchCount, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0][0], /TELEGRAM_BOT_TOKEN is not configured/);
  } finally {
    global.fetch = originalFetch;
    console.warn = originalConsoleWarn;
    if (originalBotToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
    }
    if (originalChatId === undefined) {
      delete process.env.TELEGRAM_CHAT_ID;
    } else {
      process.env.TELEGRAM_CHAT_ID = originalChatId;
    }
  }
});

test("rejects notices that exceed Telegram's message limit instead of sending partial lists", async () => {
  const originalFetch = global.fetch;
  const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  let fetchCount = 0;

  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "test-chat";
  global.fetch = async () => {
    fetchCount += 1;
    throw new Error("Oversized notice must not be sent");
  };

  try {
    await assert.rejects(
      sendTelegramNotice(
        "test-chat",
        "Computer Science",
        Array.from({ length: 100 }, (_, index) => ({
          studentName: `${index + 1}-${"x".repeat(100)}`,
        })),
      ),
      /maximum is 4096/,
    );
    assert.equal(fetchCount, 0);
  } finally {
    global.fetch = originalFetch;
    if (originalBotToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
    }
    if (originalChatId === undefined) {
      delete process.env.TELEGRAM_CHAT_ID;
    } else {
      process.env.TELEGRAM_CHAT_ID = originalChatId;
    }
  }
});
