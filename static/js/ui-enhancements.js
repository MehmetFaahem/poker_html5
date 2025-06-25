"use strict";

/**
 * Modern UI Enhancements for Poker Game
 * Adds smooth animations, loading states, and interactive feedback
 */

class UIEnhancementManager {
  constructor() {
    this.animationQueue = [];
    this.isAnimating = false;
    this.soundEnabled = false; // Can be enabled later
    this.particles = [];
    this.init();
  }

  init() {
    this.setupAnimationListeners();
    this.setupCardInteractions();
    this.setupButtonEnhancements();
    this.setupLoadingStates();
    this.setupParticleSystem();
    this.setupThemeToggle();
    this.setupAccessibilityFeatures();
  }

  // Modern card dealing animations
  animateCardDeal(cardElement, delay = 0) {
    return new Promise((resolve) => {
      setTimeout(() => {
        cardElement.classList.add("card-dealing");
        cardElement.style.transform = "translateX(-200px) rotateY(180deg)";
        cardElement.style.opacity = "0";

        // Animate to final position
        setTimeout(() => {
          cardElement.style.transition =
            "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
          cardElement.style.transform = "translateX(0) rotateY(0deg)";
          cardElement.style.opacity = "1";

          setTimeout(() => {
            cardElement.classList.remove("card-dealing");
            resolve();
          }, 600);
        }, 50);
      }, delay);
    });
  }

  // Animate multiple cards in sequence
  async animateCardSequence(cardElements, delayBetween = 200) {
    for (let i = 0; i < cardElements.length; i++) {
      await this.animateCardDeal(cardElements[i], i * delayBetween);
    }
  }

  // Chip animation when betting
  animateChipBet(fromElement, toElement, amount) {
    const chip = this.createFloatingChip(amount);
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    chip.style.left = fromRect.left + "px";
    chip.style.top = fromRect.top + "px";

    document.body.appendChild(chip);

    // Animate to pot
    requestAnimationFrame(() => {
      chip.style.transition = "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
      chip.style.left = toRect.left + toRect.width / 2 + "px";
      chip.style.top = toRect.top + toRect.height / 2 + "px";
      chip.style.transform = "scale(0.8) rotate(720deg)";
      chip.style.opacity = "0.8";

      setTimeout(() => {
        if (chip.parentNode) {
          chip.parentNode.removeChild(chip);
        }
      }, 800);
    });
  }

  createFloatingChip(amount) {
    const chip = document.createElement("div");
    chip.className = "floating-chip";
    chip.innerHTML = `$${amount}`;
    chip.style.cssText = `
      position: fixed;
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--warning-color), #d97706);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      box-shadow: var(--shadow-lg);
    `;
    return chip;
  }

  // Winner celebration animation
  celebrateWinner(playerElement, amount) {
    // Add winner highlight
    playerElement.classList.add("winner-celebration");

    // Create confetti effect
    this.createConfetti(playerElement);

    // Pulse animation
    this.addPulseEffect(playerElement);

    // Show floating win amount
    this.showFloatingWinAmount(playerElement, amount);

    // Remove effects after celebration
    setTimeout(() => {
      playerElement.classList.remove("winner-celebration");
    }, 3000);
  }

  createConfetti(element) {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    const rect = element.getBoundingClientRect();

    for (let i = 0; i < 20; i++) {
      const confetti = document.createElement("div");
      confetti.style.cssText = `
        position: fixed;
        width: 8px;
        height: 8px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${rect.left + rect.width / 2}px;
        top: ${rect.top + rect.height / 2}px;
        border-radius: 50%;
        pointer-events: none;
        z-index: 1000;
      `;

      document.body.appendChild(confetti);

      // Animate confetti
      const angle = (Math.PI * 2 * i) / 20;
      const velocity = 150 + Math.random() * 100;
      const x = Math.cos(angle) * velocity;
      const y = Math.sin(angle) * velocity - 200;

      confetti.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${x}px, ${y}px) scale(0)`, opacity: 0 },
        ],
        {
          duration: 1500,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        }
      ).onfinish = () => {
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti);
        }
      };
    }
  }

  addPulseEffect(element) {
    element.style.animation = "pulse-win 2s ease-in-out 3";
  }

  showFloatingWinAmount(element, amount) {
    const floatingAmount = document.createElement("div");
    floatingAmount.innerHTML = `+$${amount}`;
    floatingAmount.style.cssText = `
      position: fixed;
      color: var(--success-color);
      font-size: 24px;
      font-weight: 700;
      pointer-events: none;
      z-index: 1000;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    `;

    const rect = element.getBoundingClientRect();
    floatingAmount.style.left = rect.left + rect.width / 2 + "px";
    floatingAmount.style.top = rect.top + "px";

    document.body.appendChild(floatingAmount);

    floatingAmount.animate(
      [
        { transform: "translateY(0) scale(1)", opacity: 1 },
        { transform: "translateY(-60px) scale(1.2)", opacity: 0 },
      ],
      {
        duration: 2000,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      }
    ).onfinish = () => {
      if (floatingAmount.parentNode) {
        floatingAmount.parentNode.removeChild(floatingAmount);
      }
    };
  }

  // Loading states for actions
  showLoadingState(element, text = "Loading...") {
    element.classList.add("loading");
    const originalText = element.textContent;
    element.setAttribute("data-original-text", originalText);
    element.innerHTML = `
      <span class="loading-spinner"></span>
      ${text}
    `;
    return originalText;
  }

  hideLoadingState(element) {
    element.classList.remove("loading");
    const originalText = element.getAttribute("data-original-text");
    if (originalText) {
      element.textContent = originalText;
      element.removeAttribute("data-original-text");
    }
  }

  // Smooth button press animations
  setupButtonEnhancements() {
    document.addEventListener("click", (e) => {
      if (e.target.matches(".action-button, .setup-button, button")) {
        this.addRippleEffect(e.target, e);
      }
    });
  }

  addRippleEffect(element, event) {
    const ripple = document.createElement("span");
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      transform: scale(0);
      pointer-events: none;
    `;

    element.style.position = "relative";
    element.style.overflow = "hidden";
    element.appendChild(ripple);

    ripple.animate(
      [
        { transform: "scale(0)", opacity: 1 },
        { transform: "scale(2)", opacity: 0 },
      ],
      {
        duration: 600,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      }
    ).onfinish = () => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    };
  }

  // Enhanced card interactions
  setupCardInteractions() {
    document.addEventListener("mouseover", (e) => {
      if (e.target.matches(".card")) {
        this.enhanceCardHover(e.target);
      }
    });

    document.addEventListener("mouseout", (e) => {
      if (e.target.matches(".card")) {
        this.removeCardHover(e.target);
      }
    });
  }

  enhanceCardHover(card) {
    card.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    card.style.filter =
      "brightness(1.1) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3))";
  }

  removeCardHover(card) {
    card.style.filter = "";
  }

  // Particle system for ambiance
  setupParticleSystem() {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: -1;
      opacity: 0.1;
    `;
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();

    window.addEventListener("resize", () => this.resizeCanvas());

    // Start particle animation
    this.animateParticles();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  animateParticles() {
    // Create floating poker-themed particles
    if (this.particles.length < 20) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: this.canvas.height + 10,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((particle, index) => {
      particle.y -= particle.speed;

      this.ctx.globalAlpha = particle.opacity;
      this.ctx.fillStyle = "#3b82f6";
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();

      if (particle.y < -10) {
        this.particles.splice(index, 1);
      }
    });

    requestAnimationFrame(() => this.animateParticles());
  }

  // Setup animation listeners
  setupAnimationListeners() {
    // Listen for game events to trigger animations
    document.addEventListener("cardDealt", (e) => {
      this.animateCardDeal(e.detail.cardElement);
    });

    document.addEventListener("chipsBet", (e) => {
      this.animateChipBet(e.detail.from, e.detail.to, e.detail.amount);
    });

    document.addEventListener("playerWin", (e) => {
      this.celebrateWinner(e.detail.playerElement, e.detail.amount);
    });
  }

  // Loading states
  setupLoadingStates() {
    const style = document.createElement("style");
    style.textContent = `
      .loading {
        pointer-events: none;
        opacity: 0.7;
      }
      
      .loading-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: rgba(255, 255, 255, 0.8);
        animation: spin 1s linear infinite;
        margin-right: 8px;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .winner-celebration {
        animation: celebrate 3s ease-in-out;
      }
      
      @keyframes celebrate {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
  }

  // Theme toggle enhancement
  setupThemeToggle() {
    const themeButton = document.getElementById("mode-button");
    if (themeButton) {
      themeButton.addEventListener("click", () => {
        this.animateThemeTransition();
      });
    }
  }

  animateThemeTransition() {
    document.body.style.transition = "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)";

    setTimeout(() => {
      document.body.style.transition = "";
    }, 500);
  }

  // Accessibility features
  setupAccessibilityFeatures() {
    // Add focus indicators
    const style = document.createElement("style");
    style.textContent = `
      .action-button:focus,
      .setup-button:focus,
      button:focus,
      select:focus,
      input:focus {
        outline: 3px solid var(--accent-color);
        outline-offset: 2px;
      }
      
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Add keyboard navigation
    document.addEventListener("keydown", (e) => {
      this.handleKeyboardNavigation(e);
    });
  }

  handleKeyboardNavigation(event) {
    // Add keyboard shortcuts for common actions
    if (event.ctrlKey || event.metaKey) return;

    // Don't trigger shortcuts if user is typing in an input field
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.isContentEditable ||
        activeElement.id === "chat-input")
    ) {
      return;
    }

    switch (event.key) {
      case "f":
      case "F":
        const foldButton = document.getElementById("fold-button");
        if (foldButton && foldButton.style.visibility !== "hidden") {
          foldButton.click();
          event.preventDefault();
        }
        break;
      case "c":
      case "C":
        const callButton = document.getElementById("call-button");
        if (callButton && callButton.style.visibility !== "hidden") {
          callButton.click();
          event.preventDefault();
        }
        break;
      case "r":
      case "R":
        const raiseButton = document.getElementById("bet-button");
        if (raiseButton && raiseButton.style.visibility !== "hidden") {
          raiseButton.click();
          event.preventDefault();
        }
        break;
    }
  }

  // Public methods for external use
  triggerCardDeal(cardElement, delay = 0) {
    return this.animateCardDeal(cardElement, delay);
  }

  triggerChipAnimation(fromElement, toElement, amount) {
    this.animateChipBet(fromElement, toElement, amount);
  }

  triggerWinCelebration(playerElement, amount) {
    this.celebrateWinner(playerElement, amount);
  }

  showButtonLoading(button, text) {
    return this.showLoadingState(button, text);
  }

  hideButtonLoading(button) {
    this.hideLoadingState(button);
  }
}

// Initialize the UI enhancement manager
let uiEnhancementManager;

function initUIEnhancements() {
  uiEnhancementManager = new UIEnhancementManager();
  console.log("UI enhancements initialized");
}

// Helper functions for external use
function enhanceCardDeal(cardElement, delay = 0) {
  if (uiEnhancementManager) {
    return uiEnhancementManager.triggerCardDeal(cardElement, delay);
  }
  return Promise.resolve();
}

function enhanceChipBet(fromElement, toElement, amount) {
  if (uiEnhancementManager) {
    uiEnhancementManager.triggerChipAnimation(fromElement, toElement, amount);
  }
}

function enhanceWinCelebration(playerElement, amount) {
  if (uiEnhancementManager) {
    uiEnhancementManager.triggerWinCelebration(playerElement, amount);
  }
}

function enhanceButtonLoading(button, text = "Loading...") {
  if (uiEnhancementManager) {
    return uiEnhancementManager.showButtonLoading(button, text);
  }
  return button.textContent;
}

function enhanceButtonLoadingHide(button) {
  if (uiEnhancementManager) {
    uiEnhancementManager.hideButtonLoading(button);
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUIEnhancements);
} else {
  initUIEnhancements();
}
