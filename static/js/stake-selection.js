// Poker Stakes Interface JavaScript

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

// Navigation functions
function goToPrevious() {
  currentIndex = currentIndex > 0 ? currentIndex - 1 : stakesData.length - 1;
  updateMobileCard();
  updateDots();
  updateDesktopCards();
}

function goToNext() {
  currentIndex = currentIndex < stakesData.length - 1 ? currentIndex + 1 : 0;
  updateMobileCard();
  updateDots();
  updateDesktopCards();
}

function goToCard(index) {
  currentIndex = index;
  updateMobileCard();
  updateDots();
  updateDesktopCards();
}

// Update mobile card content
function updateMobileCard() {
  const currentCard = stakesData[currentIndex];
  const mobileStakes = document.getElementById("mobileStakes");
  const mobileBuyIn = document.getElementById("mobileBuyIn");

  // Add fade effect
  const mobileCard = document.getElementById("mobileCard");
  if (mobileCard) {
    mobileCard.style.opacity = "0.7";

    setTimeout(() => {
      if (mobileStakes) mobileStakes.textContent = currentCard.stakes;
      if (mobileBuyIn) mobileBuyIn.textContent = currentCard.buyIn;
      mobileCard.style.opacity = "1";
    }, 150);
  }
}

// Update dots indicator
function updateDots() {
  const dots = document.querySelectorAll("#stake-selection-screen .dot");
  dots.forEach((dot, index) => {
    if (index === currentIndex) {
      dot.classList.add("active");
    } else {
      dot.classList.remove("active");
    }
  });
}

// Update desktop cards highlighting and scroll position
function updateDesktopCards() {
  const desktopCards = document.querySelectorAll(
    "#stake-selection-screen .desktop-layout .stake-card"
  );
  desktopCards.forEach((card, index) => {
    if (index === currentIndex) {
      card.classList.add("highlighted");
    } else {
      card.classList.remove("highlighted");
    }
  });

  // Scroll the cards container to show the current card
  const cardsContainer = document.querySelector(
    "#stake-selection-screen .cards-container"
  );
  const currentCard = desktopCards[currentIndex];
  if (currentCard && cardsContainer) {
    const cardRect = currentCard.getBoundingClientRect();
    const containerRect = cardsContainer.getBoundingClientRect();
    const scrollLeft =
      currentCard.offsetLeft -
      cardsContainer.offsetLeft -
      containerRect.width / 2 +
      cardRect.width / 2;
    cardsContainer.scrollTo({
      left: scrollLeft,
      behavior: "smooth",
    });
  }
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
            setTimeout(checkConnection, 500);
          }
        };

        setTimeout(checkConnection, 1000);
      } else {
        hideLoadingState();
        alert("Unable to create room. Please refresh the page and try again.");
      }
    }
  }
}

// Function to hide stake selection screen (called from poker.js)
function hideStakeSelectionScreen() {
  if (typeof window.hideStakeSelectionScreen === "function") {
    window.hideStakeSelectionScreen();
  } else {
    const stakeSelectionScreen = document.getElementById(
      "stake-selection-screen"
    );
    if (stakeSelectionScreen) {
      stakeSelectionScreen.style.display = "none";
    }
  }
}

// Show loading state
function showLoadingState() {
  // Add loading overlay to the stake selection
  const container = document.querySelector(
    "#stake-selection-screen .container"
  );
  if (container) {
    const loadingOverlay = document.createElement("div");
    loadingOverlay.id = "stake-loading-overlay";
    loadingOverlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p>Creating room...</p>
      </div>
    `;
    loadingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 15, 15, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      backdrop-filter: blur(5px);
    `;

    const loadingContent = loadingOverlay.querySelector(".loading-content");
    loadingContent.style.cssText = `
      text-align: center;
      color: white;
    `;

    const spinner = loadingOverlay.querySelector(".loading-spinner");
    spinner.style.cssText = `
      width: 40px;
      height: 40px;
      border: 3px solid rgba(32, 220, 164, 0.3);
      border-top: 3px solid #20dca4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    `;

    // Add spin animation if not already added
    if (!document.getElementById("stake-spinner-style")) {
      const style = document.createElement("style");
      style.id = "stake-spinner-style";
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    container.appendChild(loadingOverlay);
  }
}

// Hide loading state
function hideLoadingState() {
  const loadingOverlay = document.getElementById("stake-loading-overlay");
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
}

// Event listeners are now set up in initializeStakeSelection() function

// Keyboard navigation (only set up once globally)
let keyboardListenerAdded = false;

function setupKeyboardNavigation() {
  if (keyboardListenerAdded) return;

  document.addEventListener("keydown", (event) => {
    // Only handle keys if stake selection screen is visible
    const stakeScreen = document.getElementById("stake-selection-screen");
    if (!stakeScreen || stakeScreen.style.display === "none") return;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        goToPrevious();
        break;
      case "ArrowRight":
        event.preventDefault();
        goToNext();
        break;
      case "1":
        event.preventDefault();
        goToCard(0);
        break;
      case "2":
        event.preventDefault();
        goToCard(1);
        break;
      case "3":
        event.preventDefault();
        goToCard(2);
        break;
      case "4":
        event.preventDefault();
        goToCard(3);
        break;
      case "5":
        event.preventDefault();
        goToCard(4);
        break;
      case "6":
        event.preventDefault();
        goToCard(5);
        break;
      case "Enter":
        event.preventDefault();
        selectStakeAndCreateRoom(currentIndex);
        break;
    }
  });

  keyboardListenerAdded = true;
}

// Touch/Swipe support for mobile
let touchStartX = 0;
let touchEndX = 0;

function setupMobileSwipe() {
  const mobileCardContainer = document.querySelector(
    "#stake-selection-screen .mobile-card-container"
  );

  if (mobileCardContainer) {
    function handleSwipe() {
      const swipeThreshold = 50;
      const swipeDistance = touchEndX - touchStartX;

      if (Math.abs(swipeDistance) > swipeThreshold) {
        if (swipeDistance > 0) {
          // Swipe right - go to previous
          goToPrevious();
        } else {
          // Swipe left - go to next
          goToNext();
        }
      }
    }

    mobileCardContainer.addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0].screenX;
    });

    mobileCardContainer.addEventListener("touchend", (event) => {
      touchEndX = event.changedTouches[0].screenX;
      handleSwipe();
    });
  }
}

// Add click handlers for desktop cards to make them selectable
function addDesktopCardClickHandlers() {
  const desktopCards = document.querySelectorAll(
    "#stake-selection-screen .desktop-layout .stake-card"
  );
  desktopCards.forEach((card, index) => {
    card.addEventListener("click", () => {
      goToCard(index);
      // Double click to select
      card.addEventListener("dblclick", () => selectStakeAndCreateRoom(index));
    });
    card.style.cursor = "pointer";

    // Add visual feedback for selection
    card.title = `Click to view, double-click to select ${stakesData[index].stakes}`;
  });
}

// Add click handlers for mobile card selection
function addMobileCardClickHandler() {
  const mobileCard = document.getElementById("mobileCard");
  const mobileSelectBtn = document.getElementById("mobile-select-button");

  if (mobileCard) {
    // Remove the direct click handler for mobile card to avoid confusion
    mobileCard.style.cursor = "default";
    mobileCard.title = `Current selection: ${stakesData[currentIndex].stakes}`;
  }

  if (mobileSelectBtn) {
    mobileSelectBtn.addEventListener("click", () =>
      selectStakeAndCreateRoom(currentIndex)
    );

    // Update button text based on current selection
    const updateButtonText = () => {
      const currentStake = stakesData[currentIndex];
      mobileSelectBtn.textContent = `Select ${currentStake.stakes} & Create Room`;
    };

    updateButtonText();

    // Update button text when card changes
    const originalUpdateMobileCard = updateMobileCard;
    updateMobileCard = function () {
      originalUpdateMobileCard();
      updateButtonText();
    };
  }
}

// Resize handler to ensure proper layout
window.addEventListener("resize", () => {
  // Force a repaint to ensure proper layout on resize
  document.body.style.display = "none";
  document.body.offsetHeight; // Trigger reflow
  document.body.style.display = "";

  // Update slider position after resize
  setTimeout(() => {
    updateDesktopCards();
  }, 100);
});

// Interface is now initialized via initializeStakeSelection() function when needed

// Accessibility improvements
function announceCardChange() {
  const currentCard = stakesData[currentIndex];
  const announcement = `Now showing stakes ${currentCard.stakes} with buy-in ${currentCard.buyIn}`;

  // Create or update screen reader announcement
  let announcer = document.getElementById("sr-announcer");
  if (!announcer) {
    announcer = document.createElement("div");
    announcer.id = "sr-announcer";
    announcer.setAttribute("aria-live", "polite");
    announcer.setAttribute("aria-atomic", "true");
    announcer.style.position = "absolute";
    announcer.style.left = "-10000px";
    announcer.style.width = "1px";
    announcer.style.height = "1px";
    announcer.style.overflow = "hidden";
    document.body.appendChild(announcer);
  }

  announcer.textContent = announcement;
}

// Performance optimization: Debounce resize events
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

window.addEventListener(
  "resize",
  debounce(() => {
    updateDesktopCards();
  }, 250)
);

// Export functions for external use
if (typeof window !== "undefined") {
  window.stakeSelection = {
    setPlayerName,
    getPlayerName,
    selectStakeAndCreateRoom,
    getCurrentStake: () => stakesData[currentIndex],
    hideLoadingState,
    showLoadingState,
  };
}

// Initialize the stake selection interface
function initializeStakeSelection() {
  // Set up event listeners for arrows
  const leftArrowDesktop = document.getElementById("leftArrowDesktop");
  const rightArrowDesktop = document.getElementById("rightArrowDesktop");
  const leftArrowMobile = document.getElementById("leftArrowMobile");
  const rightArrowMobile = document.getElementById("rightArrowMobile");

  if (leftArrowDesktop)
    leftArrowDesktop.addEventListener("click", goToPrevious);
  if (rightArrowDesktop) rightArrowDesktop.addEventListener("click", goToNext);
  if (leftArrowMobile) leftArrowMobile.addEventListener("click", goToPrevious);
  if (rightArrowMobile) rightArrowMobile.addEventListener("click", goToNext);

  // Set up event listeners for dots
  const dots = document.querySelectorAll("#stake-selection-screen .dot");
  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => goToCard(index));
  });

  // Initialize display
  updateMobileCard();
  updateDots();
  updateDesktopCards();
  addDesktopCardClickHandlers();
  addMobileCardClickHandler();
  setupMobileSwipe();

  // Add loading animation
  const cards = document.querySelectorAll(
    "#stake-selection-screen .stake-card"
  );
  cards.forEach((card, index) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";

    setTimeout(() => {
      card.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    }, index * 100);
  });
}

// Make initialization function available globally
if (typeof window !== "undefined") {
  window.initializeStakeSelection = initializeStakeSelection;
}

// Function to get DOM elements (called when stake selection is shown)
function getDOMElements() {
  return {
    leftArrowDesktop: document.getElementById("leftArrowDesktop"),
    rightArrowDesktop: document.getElementById("rightArrowDesktop"),
    leftArrowMobile: document.getElementById("leftArrowMobile"),
    rightArrowMobile: document.getElementById("rightArrowMobile"),
    mobileStakes: document.getElementById("mobileStakes"),
    mobileBuyIn: document.getElementById("mobileBuyIn"),
    dots: document.querySelectorAll("#stake-selection-screen .dot"),
  };
}
