"use strict";

// Toast Notification System
class ToastManager {
  constructor() {
    this.container = null;
    this.toastQueue = [];
    this.maxToasts = 5;
    this.toastDuration = 4000; // 4 seconds
    this.init();
  }

  init() {
    this.container = document.getElementById("toast-container");
    if (!this.container) {
      console.error("Toast container not found");
    }
  }

  showToast(message, type = "action", duration = null) {
    if (!this.container) {
      console.error("Toast container not available");
      return;
    }

    // Remove excess toasts if we have too many
    this.removeExcessToasts();

    // Create toast element
    const toast = this.createToastElement(message, type);

    // Add to container
    this.container.appendChild(toast);

    // Trigger show animation
    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    // Auto-remove after duration
    const toastDuration = duration || this.toastDuration;
    setTimeout(() => {
      this.removeToast(toast);
    }, toastDuration);

    return toast;
  }

  createToastElement(message, type) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    // Get icon and format message based on type
    const { icon, formattedMessage } = this.formatToastContent(message, type);

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-message">${formattedMessage}</div>
    `;

    return toast;
  }

  formatToastContent(message, type) {
    let icon = "";
    let formattedMessage = message;

    switch (type) {
      case "win":
        icon = "🏆";
        break;
      case "fold":
        icon = "🃏";
        break;
      case "call":
        icon = "✅";
        break;
      case "check":
        icon = "✋";
        break;
      case "raise":
        icon = "📈";
        break;
      case "action":
      default:
        icon = "🎯";
        break;
    }

    return { icon, formattedMessage };
  }

  removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    toast.classList.remove("show");
    toast.classList.add("hide");

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  removeExcessToasts() {
    const toasts = this.container.querySelectorAll(".toast");
    while (toasts.length >= this.maxToasts) {
      this.removeToast(toasts[0]);
      break;
    }
  }

  // Specific toast methods for different actions
  showPlayerAction(playerName, action, amount = null) {
    let message = "";
    let type = action.toLowerCase();

    switch (action.toLowerCase()) {
      case "fold":
        message = `<span class="toast-player">${playerName}</span> folded`;
        break;
      case "call":
        message = `<span class="toast-player">${playerName}</span> called`;
        if (amount && amount > 0) {
          message += ` $${amount}`;
        }
        break;
      case "check":
        message = `<span class="toast-player">${playerName}</span> checked`;
        break;
      case "raise":
        message = `<span class="toast-player">${playerName}</span> raised`;
        if (amount) {
          message += ` to $${amount}`;
        }
        break;
      case "bet":
        message = `<span class="toast-player">${playerName}</span> bet $${
          amount || 0
        }`;
        type = "raise";
        break;
      case "all-in":
        message = `<span class="toast-player">${playerName}</span> went all-in!`;
        type = "raise";
        break;
      default:
        message = `<span class="toast-player">${playerName}</span> ${action}`;
        type = "action";
    }

    this.showToast(message, type);
  }

  showPlayerWin(playerName, amount = null) {
    let message = `🎉 <span class="toast-player">${playerName}</span> wins!`;
    if (amount && amount > 0) {
      message += ` (+$${amount})`;
    }
    this.showToast(message, "win", 6000); // Show win toasts longer
  }

  showGameEvent(message, type = "action") {
    this.showToast(message, type);
  }

  showJoinEvent(playerName) {
    const message = `<span class="toast-player">${playerName}</span> joined the game`;
    this.showToast(message, "action", 3000);
  }

  showLeaveEvent(playerName) {
    const message = `<span class="toast-player">${playerName}</span> left the game`;
    this.showToast(message, "action", 3000);
  }

  showNewHand() {
    this.showToast("🎴 New hand started!", "action", 2500);
  }

  showRoundTransition(round) {
    let message = "";
    switch (round.toLowerCase()) {
      case "flop":
        message = "🎴 Flop revealed!";
        break;
      case "turn":
        message = "🎴 Turn card revealed!";
        break;
      case "river":
        message = "🎴 River card revealed!";
        break;
      case "showdown":
        message = "🃏 Showdown time!";
        break;
      default:
        message = `🎲 ${round} phase`;
    }
    this.showToast(message, "action", 2500);
  }

  // Clear all toasts
  clearAll() {
    const toasts = this.container.querySelectorAll(".toast");
    toasts.forEach((toast) => this.removeToast(toast));
  }
}

// Global toast manager instance
let toastManager = null;

// Initialize toast manager
function initToastManager() {
  if (!toastManager) {
    toastManager = new ToastManager();
  }
  return toastManager;
}

// Convenience functions for global access
function showPlayerActionToast(playerName, action, amount = null) {
  if (!toastManager) initToastManager();
  toastManager.showPlayerAction(playerName, action, amount);
}

function showPlayerWinToast(playerName, amount = null) {
  if (!toastManager) initToastManager();
  toastManager.showPlayerWin(playerName, amount);
}

function showGameEventToast(message, type = "action") {
  if (!toastManager) initToastManager();
  toastManager.showGameEvent(message, type);
}

function showPlayerJoinToast(playerName) {
  if (!toastManager) initToastManager();
  toastManager.showJoinEvent(playerName);
}

function showPlayerLeaveToast(playerName) {
  if (!toastManager) initToastManager();
  toastManager.showLeaveEvent(playerName);
}

function showNewHandToast() {
  if (!toastManager) initToastManager();
  toastManager.showNewHand();
}

function showRoundTransitionToast(round) {
  if (!toastManager) initToastManager();
  toastManager.showRoundTransition(round);
}
