const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messageList = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const modeHint = document.querySelector("#mode-hint");
const modeButtons = [...document.querySelectorAll(".mode-button")];

let mode = "daily";
let messages = [];
let sending = false;

function appendMessage(role, content, { error = false, typing = false } = {}) {
  const row = document.createElement("div");
  row.className = `message ${role}${error ? " error" : ""}`;

  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = role === "assistant" ? "N" : "ত";
  avatar.setAttribute("aria-hidden", "true");

  const bubble = document.createElement("div");
  bubble.className = "message-content";
  if (typing) {
    bubble.setAttribute("aria-label", "Need উত্তর লিখছে");
    const dots = document.createElement("span");
    dots.className = "typing";
    dots.innerHTML = "<span></span><span></span><span></span>";
    bubble.append(dots);
  } else {
    bubble.textContent = content;
  }

  row.append(avatar, bubble);
  messageList.append(row);
  row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return row;
}

function setMode(nextMode) {
  mode = nextMode;
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  modeHint.textContent =
    mode === "writing" ? "লেখালেখিতে সাহায্য করতে প্রস্তুত" : "রোজকার জীবনে সাহায্য করতে প্রস্তুত";
  input.placeholder =
    mode === "writing" ? "কী লিখতে বা সম্পাদনা করতে চান?" : "Need-কে কিছু জিজ্ঞেস করুন...";
}

function resetChat() {
  messages = [];
  messageList.replaceChildren();
  welcome.hidden = false;
  input.focus();
}

async function sendMessage(text = input.value) {
  const content = text.trim();
  if (!content || sending) return;

  welcome.hidden = true;
  input.value = "";
  input.style.height = "30px";
  const nextMessages = [...messages, { role: "user", content }];
  appendMessage("user", content);
  const pending = appendMessage("assistant", "", { typing: true });

  sending = true;
  sendButton.disabled = true;
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, messages: nextMessages }),
    });
    const result = await response.json();
    pending.remove();

    if (!response.ok) {
      appendMessage("assistant", result.error || "উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।", { error: true });
      return;
    }
    messages = [...nextMessages, { role: "assistant", content: result.answer }];
    appendMessage("assistant", result.answer);
  } catch {
    pending.remove();
    appendMessage("assistant", "সার্ভারের সঙ্গে যোগাযোগ করা যাচ্ছে না। সার্ভার চালু আছে কি না পরীক্ষা করুন।", { error: true });
  } finally {
    sending = false;
    sendButton.disabled = false;
    input.focus();
  }
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelector("#suggestions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-prompt]");
  if (button) sendMessage(button.dataset.prompt);
});

document.querySelector("#new-chat").addEventListener("click", resetChat);
document.querySelector("#clear-chat").addEventListener("click", resetChat);
sendButton.addEventListener("click", () => sendMessage());
input.addEventListener("input", () => {
  input.style.height = "30px";
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    resetChat();
  }
});

setMode(mode);
