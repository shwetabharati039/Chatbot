

const API_URL = "/api/chat";
const STATUS_URL = "/api/status";
const CHATS_API_URL = "/api/chats";

let currentChatId = null;

const parseJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    throw new Error("Empty response from server.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid response from server.");
  }
};

const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const chatForm = document.querySelector(".chat-form");
const fileInput = document.querySelector("#file-input");
const filePreview = document.querySelector("#file-preview");
const previewImage = document.querySelector("#preview-image");
const fileCancel = document.querySelector("#file-cancel");

const closeChatbot = document.querySelector("#close-chatbot");
const statusDot = document.querySelector(".status-dot");
const statusLabel = document.querySelector("#status-label");

const conversationHistory = [];
const initialInputHeight = messageInput.scrollHeight;

const userData = {
  message: null,
  file: { data: null, mime_type: null },
};

const BOT_AVATAR = `<div class="bot-avatar-wrap">
  <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true">
    <path d="M160-360q-50 0-85-35t-35-85q0-50 35-85t85-35v-80q0-33 23.5-56.5T240-760h120q0-50 35-85t85-35q50 0 85 35t35 85h120q33 0 56.5 23.5T800-680v80q50 0 85 35t35 85q0 50-35 85t-85 35v160q0 33-23.5 56.5T720-120H240q-33 0-56.5-23.5T160-200v-160Zm200-80q25 0 42.5-17.5T420-500q0-25-17.5-42.5T360-560q-25 0-42.5 17.5T300-500q0 25 17.5 42.5T360-440Zm240 0q25 0 42.5-17.5T660-500q0-25-17.5-42.5T600-560q-25 0-42.5 17.5T540-500q0 25 17.5 42.5T600-440ZM320-280h320v-80H320v80Zm-80 80h480v-480H240v480Zm240-240Z"/>
  </svg>
</div>`;

const THINKING_HTML = `<div class="message-text">
  <div class="thinking-indicator">
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>
</div>`;

const WELCOME_HTML = `${BOT_AVATAR}<div class="message-content">
  <div class="message-text">Hello! I'm Nova. Ask me anything — I'm here to help.</div>
  <div class="quick-prompts">
    <button type="button" class="quick-prompt" data-prompt="Summarize this topic in simple terms">Explain simply</button>
    <button type="button" class="quick-prompt" data-prompt="Help me write a professional email">Draft an email</button>
    <button type="button" class="quick-prompt" data-prompt="Give me 5 creative project ideas">Get ideas</button>
  </div>
</div>`;

const createMessageElement = (content, classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes.split(" "));
  div.innerHTML = content;
  return div;
};

const scrollToBottom = () => {
  chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
};

const updateSendButton = () => {
  const hasContent = messageInput.value.trim() || userData.file.data;
  chatForm.classList.toggle("can-send", Boolean(hasContent));
};

const clearFileAttachment = () => {
  userData.file = { data: null, mime_type: null };
  fileInput.value = "";
  filePreview.classList.add("hidden");
  previewImage.src = "";
  updateSendButton();
};

const escapeHtml = (text) => {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
};

const formatReply = (text) => {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
};

const getChatTitle = (messages) => {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const content = typeof firstUser.content === "string" ? firstUser.content : "Sent an image";
  return content.length > 40 ? content.slice(0, 40) + "…" : content;
};

const clearChatBody = () => {
  chatBody.innerHTML = "";
};

const renderChatList = (chats) => {
  const list = document.querySelector("#chat-history-list");
  if (!chats.length) {
    list.innerHTML = '<div class="history-empty">No chat history yet.</div>';
    return;
  }
  list.innerHTML = chats
    .map(
      (c) => `
        <div class="history-item${c.id === currentChatId ? " active" : ""}" data-id="${c.id}">
          <span class="material-symbols-rounded" style="font-size:1rem;flex-shrink:0;">chat</span>
          <span class="history-title">${escapeHtml(c.title)}</span>
          <button class="delete-chat-btn material-symbols-rounded" data-id="${c.id}" aria-label="Delete chat">delete</button>
        </div>`
    )
    .join("");

  list.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".delete-chat-btn")) return;
      switchChat(item.dataset.id);
    });
  });

  list.querySelectorAll(".delete-chat-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(btn.dataset.id);
    });
  });
};

const loadChatList = async () => {
  try {
    const res = await fetch(CHATS_API_URL);
    const chats = await res.json();
    renderChatList(chats);
  } catch {
    const list = document.querySelector("#chat-history-list");
    list.innerHTML = '<div class="history-empty">Failed to load history.</div>';
  }
};

const switchChat = async (id) => {
  await saveCurrentChat();
  currentChatId = id;
  try {
    const res = await fetch(`${CHATS_API_URL}/${id}`);
    if (!res.ok) throw new Error("Failed to load chat");
    const chat = await res.json();
    if (!chat || !Array.isArray(chat.messages)) throw new Error("Invalid chat data");
    conversationHistory.length = 0;
    conversationHistory.push(...chat.messages);
    clearChatBody();
    chat.messages.forEach((msg) => {
      if (msg.role === "user") {
        const div = createMessageElement(
          `<div class="message-content"><div class="message-text">${escapeHtml(msg.content)}</div></div>`,
          "user-message"
        );
        chatBody.appendChild(div);
      } else {
        const div = createMessageElement(
          `${BOT_AVATAR}<div class="message-content"><div class="message-text">${formatReply(msg.content)}</div></div>`,
          "bot-message"
        );
        chatBody.appendChild(div);
      }
    });
    scrollToBottom();
  } catch {
    clearChatBody();
    const errDiv = createMessageElement(
      `<div class="message-content"><div class="message-text error-text">Failed to load chat.</div></div>`,
      "bot-message"
    );
    chatBody.appendChild(errDiv);
  }
  document.body.classList.remove("show-sidebar");
  loadChatList();
};

const saveCurrentChat = async () => {
  if (!currentChatId || !conversationHistory.length) return;
  const title = getChatTitle(conversationHistory);
  try {
    await fetch(`${CHATS_API_URL}/${currentChatId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationHistory, title }),
    });
  } catch {
    /* silently fail - chat remains in memory */
  }
};

const deleteChat = async (id) => {
  try {
    await fetch(`${CHATS_API_URL}/${id}`, { method: "DELETE" });
    if (currentChatId === id) {
      currentChatId = null;
      conversationHistory.length = 0;
      clearChatBody();
    }
  } catch {
    /* silently fail */
  }
  loadChatList();
};

const renderWelcome = () => {
  const div = createMessageElement(WELCOME_HTML, "bot-message");
  chatBody.appendChild(div);
  div.querySelectorAll(".quick-prompt").forEach((button) => {
    button.addEventListener("click", () => {
      messageInput.value = button.dataset.prompt;
      messageInput.dispatchEvent(new Event("input"));
      sendMessage();
    });
  });
};

const createNewChat = async () => {
  await saveCurrentChat();
  conversationHistory.length = 0;
  clearChatBody();
  renderWelcome();
  currentChatId = null;
  document.body.classList.remove("show-sidebar");
  loadChatList();
};

let scrollPos = 0;

const openChat = () => {
  scrollPos = window.scrollY;
  document.body.classList.add("show-chatbot");
  messageInput.focus();
  adjustMobileViewport();
};

const closeChat = () => {
  document.body.classList.remove("show-chatbot");
  document.body.classList.remove("show-sidebar");
  window.scrollTo(0, scrollPos);
  adjustMobileViewport();
};

const generateBotResponse = async (incomingMessageDiv, attachment = null) => {
  const messageElement = incomingMessageDiv.querySelector(".message-text");
  const chatIdAtSend = currentChatId;
  const payload = {
    message: userData.message,
    history: conversationHistory.slice(0, -1),
  };

  if (attachment?.data) {
    payload.image = {
      data: attachment.data,
      mime_type: attachment.mime_type,
    };
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    if (chatIdAtSend !== currentChatId) return;

    conversationHistory.push({ role: "assistant", content: data.reply });
    messageElement.innerHTML = formatReply(data.reply);
  } catch (error) {
    messageElement.textContent = error.message || "Something went wrong.";
    messageElement.classList.add("error-text");
  } finally {
    incomingMessageDiv.classList.remove("thinking");
    scrollToBottom();
    if (chatIdAtSend === currentChatId) {
      await saveCurrentChat();
    }
    loadChatList();
  }
};

const sendMessage = async (text = messageInput.value.trim(), attachmentOverride = null) => {
  const attachment =
    attachmentOverride ||
    (userData.file.data
      ? { data: userData.file.data, mime_type: userData.file.mime_type }
      : null);

  if (!text && !attachment) return;

  if (!currentChatId) {
    try {
      const res = await fetch(CHATS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat" }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const chat = await res.json();
      currentChatId = chat.id;
      loadChatList();
    } catch {
      /* failed to create chat */
    }
  }

  userData.message = text || "Please analyze this image.";
  messageInput.value = "";
  messageInput.style.height = `${initialInputHeight}px`;
  chatForm.style.borderRadius = "28px";
  updateSendButton();

  document.querySelectorAll(".quick-prompts").forEach((el) => el.remove());

  const imageHtml = attachment
    ? `<img class="message-image" src="data:${attachment.mime_type};base64,${attachment.data}" alt="Uploaded image">`
    : "";

  const outgoingMessageDiv = createMessageElement(
    `<div class="message-content"><div class="message-text"></div>${imageHtml}</div>`,
    "user-message"
  );

  outgoingMessageDiv.querySelector(".message-text").textContent =
    text || "Please analyze this image.";
  chatBody.appendChild(outgoingMessageDiv);
  scrollToBottom();

  conversationHistory.push({
    role: "user",
    content: text || "Please analyze this image.",
  });

  const incomingMessageDiv = createMessageElement(
    `${BOT_AVATAR}<div class="message-content">${THINKING_HTML}</div>`,
    "bot-message thinking"
  );

  chatBody.appendChild(incomingMessageDiv);
  scrollToBottom();

  if (!attachmentOverride) {
    clearFileAttachment();
  }

  generateBotResponse(incomingMessageDiv, attachment);
};

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && (messageInput.value.trim() || userData.file.data)) {
    e.preventDefault();
    sendMessage();
  }
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = `${initialInputHeight}px`;
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 160)}px`;
  chatForm.style.borderRadius =
    messageInput.scrollHeight > initialInputHeight ? "20px" : "28px";
  updateSendButton();
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select an image file.");
    fileInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64String = event.target.result.split(",")[1];
    userData.file = { data: base64String, mime_type: file.type };
    previewImage.src = event.target.result;
    filePreview.classList.remove("hidden");
    openChat();
    updateSendButton();
    messageInput.focus();
  };
  reader.readAsDataURL(file);
});

fileCancel.addEventListener("click", clearFileAttachment);

document.querySelector("#file-upload").addEventListener("click", () => fileInput.click());

document.querySelectorAll(".quick-prompt").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.dataset.prompt;
    messageInput.dispatchEvent(new Event("input"));
    sendMessage();
  });
});

document.querySelector("#start-chat").addEventListener("click", async () => {
  if (conversationHistory.length) {
    await createNewChat();
  }
  openChat();
});

let picker = null;
const ensurePicker = () => {
  if (picker) return true;
  if (typeof EmojiMart === "undefined") return false;
  try {
    picker = new EmojiMart.Picker({
      theme: "light",
      skinTonePosition: "none",
      previewPosition: "none",
      onEmojiSelect: (emoji) => {
        const { selectionStart: start, selectionEnd: end } = messageInput;
        messageInput.setRangeText(emoji.native, start, end, "end");
        messageInput.focus();
        updateSendButton();
      },
      onClickOutside: (e) => {
        if (!e.target.closest("#emoji-picker, em-emoji-picker")) {
          document.body.classList.remove("show-emoji-picker");
        }
      },
    });
    document.querySelector(".chat-footer").appendChild(picker);
    return true;
  } catch {
    return false;
  }
};

document.querySelector("#emoji-picker").addEventListener("click", () => {
  if (ensurePicker()) {
    document.body.classList.toggle("show-emoji-picker");
  }
});

document.querySelector("#send-message").addEventListener("click", () => sendMessage());

closeChatbot.addEventListener("click", closeChat);

document.querySelector("#sidebar-toggle").addEventListener("click", () => {
  document.body.classList.toggle("show-sidebar");
});

document.querySelector(".sidebar-backdrop").addEventListener("click", () => {
  document.body.classList.remove("show-sidebar");
});

document.querySelector("#new-chat-btn").addEventListener("click", async () => {
  await createNewChat();
  openChat();
});

const chatHeader = document.querySelector(".chat-header");

chatBody.addEventListener("scroll", () => {
  chatHeader.classList.toggle("scrolled", chatBody.scrollTop > 2);
});

const adjustMobileViewport = () => {
  const popup = document.querySelector(".chatbot-popup");
  if (!popup) return;
  const isOpen = document.body.classList.contains("show-chatbot");
  const isMobile = window.innerWidth <= 520;
  if (isOpen && isMobile) {
    const vv = window.visualViewport;
    if (vv) {
      popup.style.height = `${vv.height}px`;
    } else {
      popup.style.height = `${window.innerHeight}px`;
    }
  } else {
    popup.style.height = "";
  }
};

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", adjustMobileViewport);
  window.visualViewport.addEventListener("scroll", adjustMobileViewport);
}

messageInput.addEventListener("focus", () => {
  setTimeout(adjustMobileViewport, 350);
});

messageInput.addEventListener("blur", () => {
  setTimeout(adjustMobileViewport, 300);
});

window.addEventListener("scroll", () => {
  if (document.body.classList.contains("show-chatbot") && window.innerWidth <= 520) {
    window.scrollTo(0, 0);
  }
}, { passive: false });

updateSendButton();

statusDot.classList.remove("offline");
statusLabel.textContent = "Online";

loadChatList();
