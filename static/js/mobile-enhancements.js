class MobileGameEnhancer {
  constructor() {
    this.isMobile = this.detectMobile();
    this.isGameStarted = false;
    this.orientationLocked = false;
    this.fullscreenEnabled = false;

    // Initialize mobile enhancements
    if (this.isMobile) {
      this.init();
    }
  }

  detectMobile() {
    // Check for mobile user agents
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileRegex =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

    // Also check for touch capability and screen size
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const isSmallScreen =
      window.innerWidth <= 1024 || window.innerHeight <= 768;

    return mobileRegex.test(userAgent) || (isTouchDevice && isSmallScreen);
  }

  init() {
    console.log("Mobile enhancements initialized");

    // Add mobile-specific CSS class to body
    document.body.classList.add("mobile-device");

    // Force landscape mode immediately
    this.forceLandscapeMode();

    // Setup orientation change handlers
    this.setupOrientationHandlers();

    // Setup fullscreen handlers
    this.setupFullscreenHandlers();

    // Add mobile optimization meta tags if not present
    this.addMobileMetaTags();

    // Setup user interaction handler for fullscreen (requires user gesture)
    this.setupInitialUserInteractionHandler();

    // Remove unnecessary game start listeners since we force landscape immediately
    // this.setupGameStartListeners(); // No longer needed
  }

  setupGameStartListeners() {
    // Listen for various game start indicators

    // Single player game start
    const originalNewGame = window.new_game;
    if (typeof originalNewGame === "function") {
      window.new_game = () => {
        this.onGameStart();
        return originalNewGame.apply(this, arguments);
      };
    }

    // Multiplayer game start
    document.addEventListener("gameStarted", () => {
      this.onGameStart();
    });

    // Listen for any action button clicks as game activity
    document.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("action-button") ||
        e.target.id === "start-game-button" ||
        e.target.id === "singleplayer-button"
      ) {
        setTimeout(() => this.onGameStart(), 1000);
      }
    });

    // Auto-detect game activity
    this.setupGameActivityDetection();
  }

  setupGameActivityDetection() {
    // Monitor for poker table changes that indicate game activity
    const pokerTable = document.getElementById("poker_table");
    if (pokerTable) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "childList" || mutation.type === "attributes") {
            // Check if cards are being dealt or players are active
            const hasActiveCards =
              pokerTable.querySelectorAll('.card[style*="background-image"]')
                .length > 0;
            const hasActivePlayers =
              pokerTable.querySelectorAll(".seat .player-name").length > 0;

            if ((hasActiveCards || hasActivePlayers) && !this.isGameStarted) {
              this.onGameStart();
            }
          }
        });
      });

      observer.observe(pokerTable, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }
  }

  onGameStart() {
    if (this.isGameStarted) return;

    console.log("Game started - applying mobile optimizations");
    this.isGameStarted = true;

    // Enable landscape and fullscreen with user interaction
    this.requestLandscapeAndFullscreen();
  }

  async requestLandscapeAndFullscreen() {
    try {
      // Request fullscreen first
      await this.requestFullscreen();

      // Then request landscape orientation
      await this.requestLandscapeOrientation();

      // Show success message
      this.showMobileGameToast("Game optimized for mobile!", "success");
    } catch (error) {
      console.log("Mobile optimization failed:", error);
      this.showMobileGameToast(
        "Tap to enable fullscreen and landscape mode",
        "info"
      );

      // Setup click handler for user interaction
      this.setupUserInteractionHandler();
    }
  }

  async requestFullscreen() {
    if (!document.fullscreenElement && this.supportsFullscreen()) {
      try {
        const element = document.documentElement;

        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        }

        this.fullscreenEnabled = true;
        console.log("Fullscreen enabled");
      } catch (error) {
        console.log("Fullscreen request failed:", error);
        throw error;
      }
    }
  }

  async requestLandscapeOrientation() {
    if (this.supportsOrientationLock()) {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock("landscape");
          this.orientationLocked = true;
          console.log("Orientation locked to landscape");
        }
      } catch (error) {
        console.log("Orientation lock failed:", error);
        throw error;
      }
    }
  }

  forceLandscapeMode() {
    // Apply landscape orientation and layout immediately
    this.applyLandscapeCSS();

    // Try to lock orientation programmatically
    this.requestLandscapeOrientation().catch(() => {
      console.log("Orientation lock not available, using CSS-only solution");
    });

    // Set initial layout orientation
    this.optimizeLayoutForOrientation("landscape");
  }

  applyLandscapeCSS() {
    // Prevent duplicate styles
    const existing = document.getElementById("force-landscape-mode");
    if (existing) return;

    // Force landscape layout regardless of device orientation
    const style = document.createElement("style");
    style.id = "force-landscape-mode";
    style.textContent = `
      /* Force landscape layout on mobile devices */
      .mobile-device {
        width: 100vh !important;
        height: 100vw !important;
        transform-origin: 0 0;
        position: fixed;
        top: 0;
        left: 0;
        overflow: hidden;
        touch-action: pan-x pan-y;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      
      @media screen and (orientation: portrait) and (max-width: 1024px) {
        .mobile-device {
          transform: rotate(90deg) translateY(-100vh) !important;
          width: 100vh !important;
          height: 100vw !important;
        }
        
        .mobile-device .poker-table {
          width: 90vh !important;
          height: 80vw !important;
          margin: 5vw auto !important;
        }
        
        .mobile-device #setup-options {
          top: 2vw !important;
          right: 2vw !important;
        }
        
        .mobile-device #action-options {
          bottom: 2vw !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
        }
        
        .mobile-device #multiplayer-options {
          top: 2vw !important;
          left: 2vw !important;
        }
      }
      
      @media screen and (orientation: landscape) and (max-width: 1024px) {
        .mobile-device {
          transform: none !important;
          width: 100vw !important;
          height: 100vh !important;
        }
        
        .mobile-device .poker-table {
          width: 95vw !important;
          height: 80vh !important;
          margin: 2vh auto !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  setupUserInteractionHandler() {
    const handleUserInteraction = async () => {
      try {
        await this.requestFullscreen();
        await this.requestLandscapeOrientation();

        // Remove event listeners after successful activation
        document.removeEventListener("touchstart", handleUserInteraction);
        document.removeEventListener("click", handleUserInteraction);

        this.showMobileGameToast("Mobile mode activated!", "success");
      } catch (error) {
        console.log("User interaction handler failed:", error);
      }
    };

    document.addEventListener("touchstart", handleUserInteraction, {
      once: true,
    });
    document.addEventListener("click", handleUserInteraction, { once: true });
  }

  setupOrientationHandlers() {
    // Listen for orientation changes
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        this.handleOrientationChange();
      }, 100);
    });

    // Also listen for resize events
    window.addEventListener("resize", () => {
      this.handleOrientationChange();
    });
  }

  handleOrientationChange() {
    const orientation = this.getCurrentOrientation();
    console.log("Orientation changed to:", orientation);

    // Always optimize for landscape since we force it
    this.optimizeLayoutForOrientation("landscape");

    // Ensure landscape CSS is still applied
    this.applyLandscapeCSS();
  }

  getCurrentOrientation() {
    if (screen.orientation) {
      return screen.orientation.angle === 0 || screen.orientation.angle === 180
        ? "portrait"
        : "landscape";
    } else {
      return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
    }
  }

  optimizeLayoutForOrientation(orientation) {
    const body = document.body;
    body.classList.remove("landscape-mode", "portrait-mode");
    body.classList.add(orientation + "-mode");

    if (orientation === "landscape") {
      // Optimize for landscape
      this.optimizeForLandscape();
    } else {
      // Handle portrait mode
      this.optimizeForPortrait();
    }
  }

  optimizeForLandscape() {
    // Add landscape-specific optimizations
    const style = document.createElement("style");
    style.id = "landscape-optimizations";
    style.textContent = `
      .landscape-mode .poker-table {
        width: 95vw;
        height: 80vh;
        max-width: none;
        margin: 2vh auto;
      }
      
      .landscape-mode #setup-options {
        top: 10px;
        right: 10px;
        bottom: auto;
      }
      
      .landscape-mode #action-options {
        bottom: 10px;
        right: 50%;
        transform: translateX(50%);
      }
      
      .landscape-mode #history {
        left: 10px;
        bottom: 10px;
        width: 250px;
        height: 100px;
      }
    `;

    // Remove existing optimization styles
    const existing = document.getElementById("landscape-optimizations");
    if (existing) existing.remove();

    document.head.appendChild(style);
  }

  optimizeForPortrait() {
    // Remove landscape optimizations
    const existing = document.getElementById("landscape-optimizations");
    if (existing) existing.remove();
  }

  setupFullscreenHandlers() {
    // Handle fullscreen change events
    document.addEventListener("fullscreenchange", () => {
      this.handleFullscreenChange();
    });

    document.addEventListener("webkitfullscreenchange", () => {
      this.handleFullscreenChange();
    });

    document.addEventListener("msfullscreenchange", () => {
      this.handleFullscreenChange();
    });
  }

  handleFullscreenChange() {
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );

    if (isFullscreen) {
      console.log("Entered fullscreen mode");
      document.body.classList.add("fullscreen-mode");
    } else {
      console.log("Exited fullscreen mode");
      document.body.classList.remove("fullscreen-mode");

      if (this.isGameStarted) {
        this.showMobileGameToast(
          "Fullscreen disabled. Tap to re-enable.",
          "info"
        );
        this.setupUserInteractionHandler();
      }
    }
  }

  addMobileMetaTags() {
    // Add or update mobile-specific meta tags
    const metaTags = [
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "theme-color", content: "#1a1a1a" },
    ];

    metaTags.forEach((tag) => {
      let existing = document.querySelector(`meta[name="${tag.name}"]`);
      if (!existing) {
        existing = document.createElement("meta");
        existing.name = tag.name;
        document.head.appendChild(existing);
      }
      existing.content = tag.content;
    });
  }

  setupInitialUserInteractionHandler() {
    // Setup handler for initial fullscreen activation (requires user gesture)
    const handleUserInteraction = async () => {
      try {
        await this.requestFullscreen();
        this.showMobileGameToast("Fullscreen activated!", "success");

        // Remove event listeners after successful activation
        document.removeEventListener("touchstart", handleUserInteraction);
        document.removeEventListener("click", handleUserInteraction);
      } catch (error) {
        console.log("Fullscreen activation failed:", error);
      }
    };

    // Show instruction and setup handlers
    setTimeout(() => {
      this.showMobileGameToast("Tap anywhere to enable fullscreen", "info");
      document.addEventListener("touchstart", handleUserInteraction, {
        once: true,
      });
      document.addEventListener("click", handleUserInteraction, { once: true });
    }, 1000);
  }

  showMobileGameToast(message, type = "info") {
    // Use existing toast system if available
    if (typeof showToast === "function") {
      showToast(message, type, 3000);
    } else {
      // Fallback toast implementation
      this.createMobileToast(message, type);
    }
  }

  createMobileToast(message, type) {
    const toast = document.createElement("div");
    toast.className = `mobile-toast mobile-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${
        type === "success"
          ? "#10b981"
          : type === "warning"
          ? "#f59e0b"
          : "#3b82f6"
      };
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      max-width: 90%;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  hideOrientationWarning() {
    const warnings = document.querySelectorAll(".mobile-toast");
    warnings.forEach((warning) => {
      if (warning.textContent.includes("rotate")) {
        warning.remove();
      }
    });
  }

  supportsFullscreen() {
    return !!(
      document.documentElement.requestFullscreen ||
      document.documentElement.webkitRequestFullscreen ||
      document.documentElement.msRequestFullscreen
    );
  }

  supportsOrientationLock() {
    return !!(screen.orientation && screen.orientation.lock);
  }

  // Public method to manually trigger mobile optimizations
  enableMobileMode() {
    if (this.isMobile) {
      this.onGameStart();
    }
  }

  // Public method to exit fullscreen
  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }

  // Public method to check if mobile enhancements are active
  isMobileEnhanced() {
    return this.isMobile && this.isGameStarted;
  }
}

// Initialize mobile enhancer when DOM is ready
let mobileEnhancer;

function initializeMobileEnhancements() {
  mobileEnhancer = new MobileGameEnhancer();

  // Make it globally accessible
  window.mobileEnhancer = mobileEnhancer;
}

// Initialize when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMobileEnhancements);
} else {
  initializeMobileEnhancements();
}

// Export for external use
window.MobileGameEnhancer = MobileGameEnhancer;
