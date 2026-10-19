const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const provider = process.env.NEED_PROVIDER || "openai";
const apiKey = process.env.OPENAI_API_KEY;
const model =
  process.env.OPENAI_MODEL ||
  (provider === "ollama" ? "qwen2.5:3b" : "gpt-4o-mini");
const baseUrl = (
  process.env.OPENAI_BASE_URL ||
  (provider === "ollama" ? "http://127.0.0.1:11434/v1" : "https://api.openai.com/v1")
).replace(/\/+$/, "");

function usesLocalProviderWithoutKey() {
  if (apiKey) return false;
  if (provider !== "ollama") return false;

  try {
    const providerUrl = new URL(baseUrl);
    return (
      providerUrl.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(providerUrl.hostname)
    );
  } catch {
    return false;
  }
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error("বার্তাটি অনেক বড়। সংক্ষিপ্ত করে আবার চেষ্টা করুন।"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("অনুরোধটি পড়া যায়নি। আবার চেষ্টা করুন।"));
      }
    });
    request.on("error", reject);
  });
}

async function handleChat(request, response) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    if (!response.headersSent && !response.destroyed) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  const { mode, messages } = body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    sendJson(response, 400, { error: "বার্তার তালিকাটি সঠিক নয়।" });
    return;
  }
  if (mode !== "daily" && mode !== "writing") {
    sendJson(response, 400, { error: "একটি বৈধ assistant mode বেছে নিন।" });
    return;
  }

  const validMessages = messages.every(
    (message) =>
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0 &&
      message.content.length <= 10_000,
  );
  if (!validMessages || messages[messages.length - 1].role !== "user") {
    sendJson(response, 400, { error: "বার্তার তথ্য সঠিক নয়।" });
    return;
  }
  const localProviderWithoutKey = usesLocalProviderWithoutKey();
  if (!apiKey && !localProviderWithoutKey) {
    sendJson(response, 503, {
      error:
        "AI চালু করতে OPENAI_API_KEY সেট করুন, অথবা billing ছাড়া local Ollama ব্যবহার করতে NEED_PROVIDER=ollama সেট করুন। README.md-তে সেটআপের নিয়ম আছে।",
    });
    return;
  }

  const modeInstruction =
    mode === "writing"
      ? "ব্যবহারকারীকে লেখা তৈরি, সম্পাদনা, সংক্ষিপ্ত বা অনুবাদে সাহায্য করুন। প্রয়োজন বুঝে ভাষা ও ভঙ্গি অনুসরণ করুন।"
      : "দৈনন্দিন কাজ, পরিকল্পনা ও সাধারণ প্রশ্নে ব্যবহারিক এবং পরিষ্কার সাহায্য দিন।";

  let upstream;
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              `তোমার নাম Need। তুমি একজন সহায়ক, ভদ্র বাংলা-প্রথম AI assistant। ` +
              `ব্যবহারকারী বাংলা বা ইংরেজিতে লিখলে সেই ভাষায় উত্তর দাও। ${modeInstruction} ` +
              "অজানা তথ্য নিশ্চিতভাবে বলো না; প্রয়োজন হলে স্পষ্টীকরণ চাও।",
          },
          ...messages.map(({ role, content }) => ({ role, content: content.trim() })),
        ],
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    console.error("AI provider request failed:", error.message);
    sendJson(response, 502, {
      error: "AI সেবার সঙ্গে যোগাযোগ করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
    });
    return;
  }

  if (!upstream.ok) {
    const details = await upstream.text();
    console.error(`AI provider returned ${upstream.status}:`, details.slice(0, 500));
    sendJson(response, 502, {
      error: "AI সেবা অনুরোধটি গ্রহণ করেনি। API key, model এবং provider settings পরীক্ষা করুন।",
    });
    return;
  }

  let result;
  try {
    result = await upstream.json();
  } catch {
    sendJson(response, 502, { error: "AI সেবা থেকে সঠিক উত্তর পাওয়া যায়নি।" });
    return;
  }

  const answer = result.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    sendJson(response, 502, { error: "AI সেবা খালি উত্তর দিয়েছে। আবার চেষ্টা করুন।" });
    return;
  }
  sendJson(response, 200, { answer: answer.trim() });
}

const server = http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'");

  const pathname = new URL(request.url, "http://localhost").pathname;
  if (request.method === "POST" && pathname === "/api/chat") {
    await handleChat(request, response);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "এই request method সমর্থিত নয়।" });
    return;
  }

  let requestedPath;
  try {
    requestedPath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  } catch {
    sendJson(response, 400, { error: "URL-এ ভুল অক্ষর আছে।" });
    return;
  }
  if (!["index.html", "styles.css", "app.js"].includes(requestedPath)) {
    sendJson(response, 404, { error: "ফাইলটি পাওয়া যায়নি।" });
    return;
  }
  const filePath = path.join(root, requestedPath);

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendJson(response, 404, { error: "ফাইলটি পাওয়া যায়নি।" });
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Content-Length": stats.size,
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, () => {
  console.log(`Need is ready at http://localhost:${port}`);
});
