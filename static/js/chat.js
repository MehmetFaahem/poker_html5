"use strict";

/**
 * Chat Manager for Poker Game
 * Handles chat UI, message display, and WebSocket communication
 */

class ChatManager {
  constructor() {
    this.isOpen = false;
    this.unreadCount = 0;
    this.messages = [];
    this.currentPlayerId = null;
    this.currentPlayerName = null;
    this.wsClient = null;

    this.init();
  }

  // Check if Phosphor Icons are loaded
  isPhosphorIconsLoaded() {
    // Check if any element with ph class exists in the DOM
    const testElement = document.createElement("i");
    testElement.className = "ph ph-user-circle";
    document.body.appendChild(testElement);
    const isLoaded =
      getComputedStyle(testElement).fontFamily.includes("Phosphor");
    document.body.removeChild(testElement);
    return isLoaded;
  }

  // Get appropriate user icon based on available libraries
  getUserIcon() {
    if (this.isPhosphorIconsLoaded()) {
      return '<i class="ph-fill ph-user-circle" style="color: white;"></i>';
    } else {
      // Fallback to Font Awesome
      return '<i class="fas fa-user-circle"></i>';
    }
  }

  init() {
    this.setupElements();
    this.setupEventListeners();
    this.hide(); // Initially hidden
    // Hide chat icon by default - only show when player joins a room
    this.chatIcon.style.display = "none";
    this.updateSendButton(); // Disable send button until WebSocket connected

    // Set chat icon based on available icon library
    this.setChatIcon();
  }

  setupElements() {
    this.chatIcon = document.getElementById("chat-icon");
    this.chatContainer = document.getElementById("chat-container");
    this.chatMessages = document.getElementById("chat-messages");
    this.chatInput = document.getElementById("chat-input");
    this.chatSend = document.getElementById("chat-send");
    this.chatClose = document.getElementById("chat-close");
    this.chatNotification = document.getElementById("chat-notification");
  }

  setupEventListeners() {
    // Chat icon click
    this.chatIcon.addEventListener("click", () => {
      this.toggle();
    });

    // Close button click
    this.chatClose.addEventListener("click", () => {
      this.hide();
    });

    // Send button click
    this.chatSend.addEventListener("click", () => {
      this.sendMessage();
    });

    // Enter key in input
    this.chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });

    // Click outside to close
    document.addEventListener("click", (e) => {
      if (
        this.isOpen &&
        !this.chatContainer.contains(e.target) &&
        !this.chatIcon.contains(e.target)
      ) {
        this.hide();
      }
    });

    // Handle input changes
    this.chatInput.addEventListener("input", () => {
      this.updateSendButton();
    });
  }

  setWebSocketClient(wsClient) {
    console.log("Chat: Setting WebSocket client:", !!wsClient);
    this.wsClient = wsClient;
    this.updateSendButton(); // Update send button state when WebSocket is set
  }

  setPlayerInfo(playerId, playerName) {
    this.currentPlayerId = playerId;
    this.currentPlayerName = playerName;
  }

  show() {
    this.isOpen = true;
    this.chatContainer.classList.remove("hidden");
    this.resetUnreadCount();
    this.scrollToBottom();
    this.chatInput.focus();
  }

  hide() {
    this.isOpen = false;
    this.chatContainer.classList.add("hidden");
  }

  toggle() {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  sendMessage() {
    const message = this.chatInput.value.trim();
    console.log("Chat: Attempting to send message:", message);
    console.log("Chat: WebSocket client available:", !!this.wsClient);

    if (!message) {
      console.log("Chat: Empty message, not sending");
      return;
    }

    if (!this.wsClient) {
      console.log("Chat: No WebSocket client available");
      this.displaySystemMessage(
        "Not connected to server. Please join a room first."
      );
      return;
    }

    // Send message via WebSocket
    console.log("Chat: Sending message via WebSocket");
    this.wsClient.sendChatMessage(message);

    // Clear input
    this.chatInput.value = "";
    this.updateSendButton();
  }

  receiveMessage(messageData) {
    const message = {
      id: Date.now() + Math.random(),
      playerId: messageData.playerId,
      playerName: messageData.playerName,
      message: messageData.message,
      timestamp: messageData.timestamp || Date.now(),
      type: messageData.type || "chat", // 'chat', 'system', 'join', 'leave'
    };

    this.messages.push(message);
    this.displayMessage(message);

    // Update unread count if chat is closed
    if (!this.isOpen && message.playerId !== this.currentPlayerId) {
      this.incrementUnreadCount();
    }

    // Limit message history
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100);
    }
  }

  displayMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.className = "chat-message";

    const isOwnMessage = message.playerId === this.currentPlayerId;
    const isSystemMessage =
      message.type === "system" ||
      message.type === "join" ||
      message.type === "leave";

    if (isOwnMessage) {
      messageElement.classList.add("own-message");
    } else if (isSystemMessage) {
      messageElement.classList.add("system-message");
    }

    let messageContent = "";

    if (!isSystemMessage) {
      // Add profile icon - different side based on own/other message
      const profileColor = this.getProfileColor(message.playerId);

      messageContent = `
        <div class="message-profile ${
          isOwnMessage ? "profile-right" : "profile-left"
        }" 
             style="color: ${profileColor};">
          ${this.getUserIcon()}
        </div>
        <div class="message-content">
          <div class="message-info">
            <span class="player-name">${this.escapeHtml(
              message.playerName
            )}</span>
            <span class="message-time">${this.formatTime(
              message.timestamp
            )}</span>
          </div>
          <div class="message-bubble">
            ${this.escapeHtml(message.message)}
          </div>
        </div>
      `;
    } else {
      // System messages don't have profile icons
      messageContent = `
        <div class="message-content system-content">
          <div class="message-bubble">
            ${this.escapeHtml(message.message)}
          </div>
        </div>
      `;
    }

    messageElement.innerHTML = messageContent;
    this.chatMessages.appendChild(messageElement);
    this.scrollToBottom();
  }

  // Generate a consistent color based on player ID
  getProfileColor(playerId) {
    if (!playerId || playerId === "system") {
      return "#888888"; // Default gray for system
    }

    // Generate a consistent color based on player ID
    const colors = [
      "#3b82f6", // Blue
      "#10b981", // Green
      "#f59e0b", // Orange
      "#ef4444", // Red
      "#8b5cf6", // Purple
      "#ec4899", // Pink
      "#14b8a6", // Teal
      "#f97316", // Dark orange
      "#06b6d4", // Cyan
      "#6366f1", // Indigo
    ];

    // Use a simple hash function to pick a color based on player ID
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Get a consistent index into the colors array
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  displaySystemMessage(message) {
    this.receiveMessage({
      playerId: "system",
      playerName: "System",
      message: message,
      type: "system",
      timestamp: Date.now(),
    });
  }

  incrementUnreadCount() {
    this.unreadCount++;
    this.updateNotificationBadge();
  }

  resetUnreadCount() {
    this.unreadCount = 0;
    this.updateNotificationBadge();
  }

  updateNotificationBadge() {
    if (this.unreadCount > 0) {
      this.chatNotification.textContent =
        this.unreadCount > 99 ? "99+" : this.unreadCount;
      this.chatNotification.classList.remove("hidden");
    } else {
      this.chatNotification.classList.add("hidden");
    }
  }

  updateSendButton() {
    const hasMessage = this.chatInput.value.trim().length > 0;
    this.chatSend.disabled = !hasMessage || !this.wsClient;
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  clearMessages() {
    this.messages = [];
    this.chatMessages.innerHTML = "";
    this.resetUnreadCount();
  }

  // Called when player joins a room
  onPlayerJoined(playerName) {
    this.displaySystemMessage(`${playerName} joined the room`);
  }

  // Called when player leaves a room
  onPlayerLeft(playerName) {
    this.displaySystemMessage(`${playerName} left the room`);
  }

  // Called when game starts
  onGameStarted() {
    this.displaySystemMessage("Game started! Good luck everyone!");
  }

  // Enable/disable chat based on room status
  setEnabled(enabled) {
    if (enabled) {
      this.chatIcon.style.display = "flex";
    } else {
      this.chatIcon.style.display = "none";
      this.hide();
    }
  }

  // Set the appropriate chat icon based on available libraries
  setChatIcon() {
    const chatIconElement = this.chatIcon.querySelector("i");
    if (chatIconElement) {
      if (!this.isPhosphorIconsLoaded()) {
        // Replace with Font Awesome icon if Phosphor is not available
        chatIconElement.className = "fas fa-comments";
      }
    }
  }
}

// Global chat manager instance
let chatManager = null;

// Initialize chat when page loads
function initializeChat() {
  if (!chatManager) {
    chatManager = new ChatManager();
    window.chatManager = chatManager; // Update the global reference
  }
  return chatManager;
}

// Export for use in other modules
window.chatManager = null; // Will be set in initializeChat
window.initializeChat = initializeChat;
