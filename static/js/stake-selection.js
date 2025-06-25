// Poker Stakes Interface JavaScript with Swiper.js

// Data for the stakes cards (now 6 cards total)
const stakesData = [
  {
    stakes: "$25K/$75K",
    buyIn: "$2M - $10M",
    minCall: 25000,
    maxCall: 75000,
    startingChips: 2000000,
  },
  {
    stakes: "$50K/$100K",
    buyIn: "$2M - $10M",
    minCall: 50000,
    maxCall: 100000,
    startingChips: 2000000,
  },
  {
    stakes: "$10K/$50K",
    buyIn: "$2M - $10M",
    minCall: 10000,
    maxCall: 50000,
    startingChips: 2000000,
  },
  {
    stakes: "$5K/$25K",
    buyIn: "$1M - $5M",
    minCall: 5000,
    maxCall: 25000,
    startingChips: 1000000,
  },
  {
    stakes: "$100K/$200K",
    buyIn: "$5M - $20M",
    minCall: 100000,
    maxCall: 200000,
    startingChips: 5000000,
  },
  {
    stakes: "$1K/$5K",
    buyIn: "$500K - $2M",
    minCall: 1000,
    maxCall: 5000,
    startingChips: 500000,
  },
];

// Current active index (start with middle card)
let currentIndex = 2;
let playerName = "";
let swiper; // Swiper instance

// Store player name from the previous screen
function setPlayerName(name) {
  playerName = name;
  // Store in localStorage for persistence
  if (typeof setLocalStorage === "function") {
    setLocalStorage("playername", name);
  } else {
    localStorage.setItem("playername", name);
  }
}

// Get player name
function getPlayerName() {
  if (playerName) return playerName;

  // Try to get from localStorage
  if (typeof getLocalStorage === "function") {
    return getLocalStorage("playername") || "";
  } else {
    return localStorage.getItem("playername") || "";
  }
}

// Initialize Swiper
function initializeSwiper() {
  swiper = new Swiper(".stakes-swiper", {
    effect: "",
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: "auto",

    initialSlide: currentIndex,
    spaceBetween: 10, // Increase gap between slides
    coverflowEffect: {
      rotate: 0,
      stretch: 0,
      depth: 50,
      modifier: 1,
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    keyboard: {
      enabled: true,
      onlyInViewport: true,
    },
    loop: true,
    loopedSlides: stakesData.length,
    on: {
      slideChange: function () {
        currentIndex = this.realIndex;
        announceCardChange();
      },
      click: function (swiper, event) {
        // Handle double-click on slides
        const clickedSlide = event.target.closest(".swiper-slide");
        if (clickedSlide && this.clickedIndex === this.activeIndex) {
          selectStakeAndCreateRoom(this.realIndex);
        }
      },
    },
  });

  // Add double-click handler for card selection
  const slides = document.querySelectorAll(".swiper-slide");
  slides.forEach((slide, index) => {
    let clickCount = 0;
    slide.addEventListener("click", () => {
      clickCount++;
      setTimeout(() => {
        if (clickCount === 2) {
          // Get the real index accounting for loop
          const realIndex = swiper.realIndex;
          selectStakeAndCreateRoom(realIndex);
        }
        clickCount = 0;
      }, 300);
    });
  });

  // Connect custom arrow buttons to Swiper
  const leftArrowDesktop = document.getElementById("leftArrowDesktop");
  const rightArrowDesktop = document.getElementById("rightArrowDesktop");
  const leftArrowMobile = document.getElementById("leftArrowMobile");
  const rightArrowMobile = document.getElementById("rightArrowMobile");

  if (leftArrowDesktop) {
    leftArrowDesktop.addEventListener("click", () => {
      swiper.slidePrev();
    });
  }

  if (rightArrowDesktop) {
    rightArrowDesktop.addEventListener("click", () => {
      swiper.slideNext();
    });
  }

  if (leftArrowMobile) {
    leftArrowMobile.addEventListener("click", () => {
      swiper.slidePrev();
    });
  }

  if (rightArrowMobile) {
    rightArrowMobile.addEventListener("click", () => {
      swiper.slideNext();
    });
  }
}

// Navigation functions for mobile
function goToPrevious() {
  if (swiper) {
    swiper.slidePrev();
  }
}

function goToNext() {
  if (swiper) {
    swiper.slideNext();
  }
}

function goToCard(index) {
  if (swiper) {
    swiper.slideToLoop(index);
  }
}

// Check if room creation was successful by looking at the DOM
function checkRoomCreationSuccess() {
  // Check if the room code is displayed (indicating successful room creation)
  const roomCodeDisplay = document.getElementById("room-code-display");
  if (roomCodeDisplay && roomCodeDisplay.style.visibility !== "hidden") {
    console.log("Room code is displayed, hiding loading state");
    hideLoadingState();
    return true;
  }

  // Check if game elements are visible (indicating successful room creation)
  const pokerTable = document.getElementById("poker_table");
  if (pokerTable && window.getComputedStyle(pokerTable).display !== "none") {
    console.log("Poker table is visible, hiding loading state");
    hideLoadingState();
    return true;
  }

  // Check if stake selection screen is hidden (indicating navigation away)
  const stakeScreen = document.getElementById("stake-selection-screen");
  if (stakeScreen && stakeScreen.style.display === "none") {
    console.log("Stake selection screen is hidden, hiding loading state");
    hideLoadingState();
    return true;
  }

  return false;
}

// Handle stake selection and room creation
function selectStakeAndCreateRoom(stakeIndex) {
  const selectedStake = stakesData[stakeIndex];
  const name = getPlayerName();

  if (!name) {
    alert("Player name is required. Please go back and enter your name.");
    return;
  }

  console.log("Creating room with stake:", selectedStake);
  console.log("Player name:", name);

  // Show loading state
  showLoadingState();

  // Set up periodic checks for room creation success
  const checkInterval = setInterval(() => {
    if (checkRoomCreationSuccess()) {
      clearInterval(checkInterval);
    }
  }, 1000);

  // Clear the interval after 15 seconds as a failsafe
  setTimeout(() => {
    clearInterval(checkInterval);
    hideLoadingState();
  }, 15000);

  // Create room with the selected stake settings
  if (typeof createRoomWithStakeSettings === "function") {
    createRoomWithStakeSettings(name, selectedStake);
  } else {
    // Fallback to WebSocket client if available
    if (typeof wsClient !== "undefined" && wsClient && wsClient.isConnected) {
      wsClient.createRoomWithSettings(name, {
        startingChips: selectedStake.startingChips,
        minCall: selectedStake.minCall,
        maxCall: selectedStake.maxCall,
        stakeLevel: selectedStake.stakes,
      });
    } else {
      // Initialize WebSocket and create room
      if (typeof initializeMultiplayer === "function") {
        initializeMultiplayer();

        // Wait for connection and then create room
        const checkConnection = () => {
          if (
            typeof wsClient !== "undefined" &&
            wsClient &&
            wsClient.isConnected
          ) {
            wsClient.createRoomWithSettings(name, {
              startingChips: selectedStake.startingChips,
              minCall: selectedStake.minCall,
              maxCall: selectedStake.maxCall,
              stakeLevel: selectedStake.stakes,
            });
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      } else {
        console.error("WebSocket initialization function not found");
        hideLoadingState();
      }
    }
  }
}

// Show/hide stake selection screen
function showStakeSelectionScreen() {
  const screen = document.getElementById("stake-selection-screen");
  if (screen) {
    screen.style.display = "block";
    document.body.style.overflow = "hidden";
  }
}

function hideStakeSelectionScreen() {
  const screen = document.getElementById("stake-selection-screen");
  if (screen) {
    screen.style.display = "none";
    document.body.style.overflow = "auto";

    // Make sure loading overlay is hidden when leaving the screen
    hideLoadingState();
  }
}

// Loading state management
function showLoadingState() {
  // Create loading overlay
  const existingOverlay = document.querySelector(".loading-overlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "loading-overlay";
  loadingOverlay.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <h2>Creating Room...</h2>
      <p>Setting up your poker room with the selected stakes</p>
    </div>
  `;

  // Add loading styles
  const style = document.createElement("style");
  style.textContent = `
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 15, 15, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(10px);
    }
    
    .loading-content {
      text-align: center;
      color: white;
    }
    
    .loading-spinner {
      width: 60px;
      height: 60px;
      border: 4px solid #576d67;
      border-top: 4px solid #20dca4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem auto;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .loading-content h2 {
      margin: 0 0 0.5rem 0;
      font-size: 24px;
      font-weight: 600;
    }
    
    .loading-content p {
      margin: 0;
      font-size: 16px;
      opacity: 0.8;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(loadingOverlay);

  // Disable all interactive elements
  const interactiveElements = document.querySelectorAll("button, .stake-card");
  interactiveElements.forEach((element) => {
    element.style.pointerEvents = "none";
    element.style.opacity = "0.5";
  });

  // Dispatch event to trigger the failsafe timer
  window.dispatchEvent(new Event("stake_selection_loading"));
}

function hideLoadingState() {
  const loadingOverlay = document.querySelector(".loading-overlay");
  if (loadingOverlay) {
    loadingOverlay.remove();
  }

  // Re-enable interactive elements
  const interactiveElements = document.querySelectorAll("button, .stake-card");
  interactiveElements.forEach((element) => {
    element.style.pointerEvents = "auto";
    element.style.opacity = "1";
  });
}

// Keyboard navigation
function setupKeyboardNavigation() {
  document.addEventListener("keydown", (event) => {
    if (
      event.target.tagName === "INPUT" ||
      event.target.tagName === "TEXTAREA"
    ) {
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        goToPrevious();
        break;
      case "ArrowRight":
        event.preventDefault();
        goToNext();
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectStakeAndCreateRoom(currentIndex);
        break;
    }
  });
}

// Mobile touch interactions
function setupMobileInteractions() {
  // Mobile dots navigation
  const dots = document.querySelectorAll(".dot");
  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => goToCard(index));
  });

  // Mobile select button
  const mobileSelectButton = document.getElementById("mobile-select-button");
  if (mobileSelectButton) {
    mobileSelectButton.addEventListener("click", () => {
      selectStakeAndCreateRoom(currentIndex);
    });

    // Update button text based on current selection
    const updateButtonText = () => {
      const currentStake = stakesData[currentIndex];
      mobileSelectButton.innerHTML = `
        Select ${currentStake.stakes} Stakes<br>
        <small>& Create Room</small>
      `;
    };

    updateButtonText();

    // Update button text when card changes
    if (swiper) {
      swiper.on("slideChange", function () {
        updateButtonText();
      });
    }
  }
}

// Announce card changes for accessibility
function announceCardChange() {
  const currentCard = stakesData[currentIndex];

  // Create or update the live region for screen readers
  let liveRegion = document.getElementById("card-live-region");
  if (!liveRegion) {
    liveRegion = document.createElement("div");
    liveRegion.id = "card-live-region";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    liveRegion.style.position = "absolute";
    liveRegion.style.left = "-10000px";
    liveRegion.style.width = "1px";
    liveRegion.style.height = "1px";
    liveRegion.style.overflow = "hidden";
    document.body.appendChild(liveRegion);
  }

  liveRegion.textContent = `Selected ${currentCard.stakes} stakes with buy-in range ${currentCard.buyIn}`;
}

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Main initialization
function initializeStakeSelection() {
  // Initialize Swiper for all devices
  initializeSwiper();

  // Setup interactions
  setupKeyboardNavigation();
  setupMobileInteractions();

  // Handle window resize
  const handleResize = debounce(() => {
    if (swiper) {
      swiper.update();
    }
  }, 250);

  window.addEventListener("resize", handleResize);

  // Announce initial card
  announceCardChange();

  console.log("Stake selection initialized");
}

// Listen for room creation success event
function setupRoomCreationListener() {
  // Listen for custom event from websocket-client.js
  document.addEventListener("room_created_success", function (e) {
    console.log("Room creation success event detected, hiding loading state");
    hideLoadingState();
  });

  // Add a failsafe timeout to hide loading state after 10 seconds
  // in case the event is never fired
  window.addEventListener("stake_selection_loading", function () {
    setTimeout(() => {
      console.log("Failsafe: Hiding loading state after timeout");
      hideLoadingState();
    }, 10000);
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    initializeStakeSelection();
    setupRoomCreationListener();
  });
} else {
  initializeStakeSelection();
  setupRoomCreationListener();
}

// Export functions for external use
window.stakeSelection = {
  setPlayerName,
  getPlayerName,
  showStakeSelectionScreen,
  hideStakeSelectionScreen,
  selectStakeAndCreateRoom,
  goToCard,
  stakesData,
};
