"use strict";

class PokerWebSocketClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.roomId = null;
    this.playerName = null;
    this.isConnected = false;
    this.gameState = null;
    this.singlePlayerMode = false; // Flag to prevent reconnection in single player mode

    // Event callbacks
    this.onConnected = null;
    this.onGameUpdate = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onError = null;

    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 2000; // 2 seconds
    this.lastCurrentPlayer = null;
    this.roomSettingsShown = false;
    // Add timer-related properties
    this.timerInterval = null;
    this.timerStartTime = null;
    this.timerDuration = null;
  }

  connect(serverUrl = null) {
    try {
      const wsUrl = serverUrl || `ws://${window.location.host}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("Connected to poker server");
        this.isConnected = true;
        this.reconnectAttempts = 0;

        if (this.onConnected) {
          this.onConnected();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("Disconnected from poker server");
        this.isConnected = false;
        if (!this.singlePlayerMode) {
          this.attemptReconnect();
        } else {
          console.log(
            "Single player mode active - not attempting to reconnect"
          );
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (this.onError) {
          this.onError(error);
        }
      };
    } catch (error) {
      console.error("Failed to connect to WebSocket:", error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect();
      }, 2000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.log("Max reconnection attempts reached");
      if (this.onError) {
        this.onError(new Error("Failed to reconnect to server"));
      }
    }
  }

  handleMessage(message) {
    console.log("Received message:", message);

    switch (message.type) {
      case "connected":
        console.log("Server confirmed connection");
        break;

      case "joined_room":
        if (message.success) {
          this.playerId = message.playerId;
          this.roomId = message.roomId;
          this.gameState = message.gameState;

          console.log(
            `Joined room ${message.roomId} as player ${message.playerId}`
          );

          // Dispatch custom event for room creation success
          const roomCreatedEvent = new CustomEvent("room_created_success", {
            detail: { roomId: message.roomId, playerId: message.playerId },
          });
          document.dispatchEvent(roomCreatedEvent);

          // Update the game UI with the initial state
          this.updateGameUI(message.gameState);

          // Show room info
          gui_write_game_response(`Joined room: ${this.roomId}`);
          gui_set_game_response_font_color("green");

          // Update room code display and hide initial buttons
          this.updateUIAfterJoining(this.roomId);

          // Enable chat and set player info
          if (window.chatManager) {
            window.chatManager.setPlayerInfo(this.playerId, this.playerName);
            window.chatManager.setWebSocketClient(this); // Ensure WebSocket is set
            window.chatManager.setEnabled(true);
          }
        } else {
          console.error("Failed to join room:", message.error);
          gui_write_game_response(`Failed to join room: ${message.error}`);
          gui_set_game_response_font_color("red");
        }
        break;

      case "player_joined":
        console.log(`Player ${message.playerName} joined the game`);
        gui_log_to_history(`${message.playerName} joined the game`);

        // Show join toast
        showPlayerJoinToast(message.playerName);

        // Notify chat
        if (window.chatManager) {
          window.chatManager.onPlayerJoined(message.playerName);
        }

        if (message.gameState) {
          this.updateGameUI(message.gameState);
        }

        // Handle start game UI when a new player joins
        if (message.gameState) {
          this.handleStartGameUI(message.gameState);
        }

        if (this.onPlayerJoined) {
          this.onPlayerJoined(message);
        }
        break;

      case "player_left":
        console.log(`Player ${message.playerId} left the game`);
        gui_log_to_history(`Player left the game`);

        // Show leave toast
        const leftPlayerName = this.getPlayerName(message.playerId) || "Player";
        showPlayerLeaveToast(leftPlayerName);

        // Notify chat
        if (window.chatManager) {
          window.chatManager.onPlayerLeft(leftPlayerName);
        }

        if (message.gameState) {
          this.updateGameUI(message.gameState);
        }

        if (this.onPlayerLeft) {
          this.onPlayerLeft(message);
        }
        break;

      case "game_started":
        console.log("Game started!");
        gui_log_to_history("New hand started!");

        // Hide start game modal for all players
        this.hideStartGameModal();

        // Show new hand toast
        showNewHandToast();

        // Notify chat
        if (window.chatManager) {
          window.chatManager.onGameStarted();
        }

        // Clear community cards at start of new hand
        gui_clear_all_board_cards();

        this.gameState = message.gameState;
        this.updateGameUI(message.gameState);

        if (this.onGameUpdate) {
          this.onGameUpdate(message);
        }
        break;

      case "game_update":
        console.log("Game state updated:", message.action);

        this.gameState = message.gameState;

        // Clear pending action state since the action was successful
        this.actionButtonsHidden = false;
        this.lastActionSent = null;

        this.updateGameUI(message.gameState);

        // Log the action and show toast
        if (message.action) {
          const actionText = this.formatAction(
            message.action,
            message.playerId
          );
          gui_log_to_history(actionText);

          // Show action toast
          const playerName =
            this.getPlayerName(message.playerId) ||
            `Player ${message.playerId}`;
          this.showActionToast(playerName, message.action);
        }

        if (this.onGameUpdate) {
          this.onGameUpdate(message);
        }
        break;

      case "chat_message":
        console.log("Chat message received:", message);
        if (window.chatManager) {
          window.chatManager.receiveMessage({
            playerId: message.playerId,
            playerName: message.playerName,
            message: message.message,
            timestamp: message.timestamp,
          });
        }
        break;

      case "game_state":
        this.gameState = message.gameState;
        this.updateGameUI(message.gameState);
        break;

      case "action_rejected":
        console.log("✋ ACTION REJECTED RECEIVED:", message);
        console.log("Error message:", message.error);
        console.log("Rejected action:", message.action);

        // Show error message to user
        gui_write_game_response(`Action rejected: ${message.error}`);
        gui_set_game_response_font_color("red");

        // Update game state and restore action buttons
        if (message.gameState) {
          console.log("Updating game state after rejection");
          this.gameState = message.gameState;
          this.updateGameUI(message.gameState);
        }

        // Clear the action sent state so buttons can be shown again
        console.log("Clearing action state and restoring buttons");
        this.actionButtonsHidden = false;
        this.lastActionSent = null;

        // Force update action buttons after rejection
        console.log("Force updating action buttons after rejection");
        this.updateActionButtons(message.gameState.gameState);

        // Show specific invalid action toast
        if (typeof showInvalidActionToast === "function") {
          const actionType = message.action.type || "action";
          showInvalidActionToast(actionType, message.error);
        } else if (typeof showErrorToast === "function") {
          showErrorToast(message.error);
        } else {
          console.log("Toast functions not available");
        }
        break;

      case "player_win":
        console.log("Player win:", message);

        // Show win toast
        const handInfo = message.handType ? ` with ${message.handType}` : "";
        showPlayerWinToast(message.winnerName, message.amount, handInfo);

        // Show win modal
        if (typeof showWinModal === "function") {
          showWinModal(message.winnerName, message.amount, message.handType);
        }

        // Log to history
        gui_log_to_history(
          `${message.winnerName} wins $${message.amount}${handInfo}!`
        );
        break;

      case "multiple_winners":
        console.log("Multiple winners:", message);

        // Show multiple winners toast
        const winnerNames = message.winners.map((w) => w.winnerName).join(", ");
        const handTypeInfo = message.handType
          ? ` with ${message.handType}`
          : "";
        showPlayerWinToast(`${winnerNames}`, "split pot", handTypeInfo);

        // Show win modal for multiple winners
        if (typeof showWinModal === "function") {
          const totalAmount = message.winners.reduce(
            (sum, w) => sum + w.amount,
            0
          );
          showWinModal(`${winnerNames}`, totalAmount, message.handType);
        }

        // Log each winner
        message.winners.forEach((winner) => {
          gui_log_to_history(
            `${winner.winnerName} wins $${winner.amount}${handTypeInfo}!`
          );
        });
        break;

      case "player_timeout":
        console.log("Player timeout:", message);

        const timeoutPlayerName =
          this.getPlayerName(message.playerId) || `Player ${message.playerId}`;

        // Show timeout toast
        showPlayerTimeoutToast(timeoutPlayerName);

        // Log timeout
        gui_log_to_history(`${timeoutPlayerName} timed out and folded`);

        if (message.gameState) {
          this.updateGameUI(message.gameState);
        }

        if (this.onGameUpdate) {
          this.onGameUpdate(message);
        }

        // Update game state
        if (message.gameState) {
          this.gameState = message.gameState;
          this.updateGameUI(message.gameState);
        }

        // Log to history
        gui_log_to_history(`🏆 ${message.winnerName} wins $${message.amount}!`);
        break;

      case "error":
        console.error("Server error:", message.message);
        gui_write_game_response(`Error: ${message.message}`);
        gui_set_game_response_font_color("red");

        if (this.onError) {
          this.onError(new Error(message.message));
        }
        break;
    }
  }

  formatAction(action, playerId) {
    const playerName = this.getPlayerName(playerId) || `Player ${playerId}`;

    switch (action.type) {
      case "fold":
        return `${playerName} folds`;
      case "call":
        return `${playerName} calls`;
      case "raise":
        return `${playerName} raises to $${action.amount}`;
      default:
        return `${playerName} ${action.type}`;
    }
  }

  getPlayerName(playerId) {
    if (!this.gameState || !this.gameState.players) return null;

    const player = this.gameState.players.find((p) => p.id === playerId);
    return player ? player.name : null;
  }

  showActionToast(playerName, action) {
    let actionType = action.type.toLowerCase();
    let amount = action.amount;

    // Handle different action types
    switch (actionType) {
      case "fold":
        showPlayerActionToast(playerName, "fold");
        break;
      case "call":
        // Determine if it's a call or check
        if (amount === 0) {
          showPlayerActionToast(playerName, "check");
        } else {
          showPlayerActionToast(playerName, "call", amount);
        }
        break;
      case "raise":
        showPlayerActionToast(playerName, "raise", amount);
        break;
      case "bet":
        showPlayerActionToast(playerName, "raise", amount);
        break;
      case "all-in":
        showPlayerActionToast(playerName, "all-in", amount);
        break;
      default:
        showPlayerActionToast(playerName, actionType, amount);
    }
  }

  updateGameUI(gameStateData) {
    if (!gameStateData) return;

    console.log("Updating game UI with:", gameStateData);

    // Update pot display
    if (gameStateData.gameState && gameStateData.gameState.pot !== undefined) {
      gui_write_basic_general(gameStateData.gameState.pot);
    }

    // Control bet visibility and pot display based on game state
    const pokerTable = document.getElementById("poker_table");
    if (pokerTable) {
      if (gameStateData.gameState && gameStateData.gameState.isGameActive) {
        pokerTable.classList.add("game-active");
        // Show pot when game is active
        if (typeof gui_show_pot === "function") {
          gui_show_pot();
        }
      } else {
        pokerTable.classList.remove("game-active");
        // Hide pot when game is not active
        if (typeof gui_hide_pot === "function") {
          gui_hide_pot();
        }
      }
    }

    // Initialize all seats (show "Seat X" for empty seats)
    for (let i = 0; i < 10; i++) {
      gui_set_player_name("", i); // This will show "Seat X" for empty seats
      gui_set_bankroll("", i);
      gui_set_bet("", i);
      gui_set_player_cards("", "", i, false);
      gui_hilite_player("", "", i);
    }

    // Update players and track current player
    let currentPlayerName = null;
    if (gameStateData.players) {
      gameStateData.players.forEach((player) => {
        const seat = player.seat;
        gui_set_player_name(player.name, seat);
        gui_set_bankroll(player.bankroll, seat);

        if (player.currentBet > 0) {
          gui_set_bet("$" + player.currentBet, seat);
        }

        // Show cards - display actual cards for current player, blinded for others
        if (player.cards && player.cards.length >= 2) {
          let card1, card2;

          // If this is the current player, show their actual cards
          if (player.id === this.playerId) {
            card1 = player.cards[0];
            card2 = player.cards[1];
          } else {
            // For other players, show blinded cards if they haven't folded
            card1 = player.isFolded ? "" : "blinded";
            card2 = player.isFolded ? "" : "blinded";
          }

          gui_set_player_cards(card1, card2, seat, player.isFolded);
        }

        // Highlight current player and track their name
        if (
          player.isCurrentPlayer &&
          gameStateData.gameState?.isGameActive &&
          !player.isFolded &&
          !player.isAllIn
        ) {
          gui_hilite_player("gold", "black", seat);
          currentPlayerName = player.name;
        }
      });

      // Control Start Game button visibility based on player count
      const startGameButton = document.getElementById("start-game-button");
      if (startGameButton) {
        const playerCount = gameStateData.players.length;
        if (
          playerCount >= 2 &&
          (!gameStateData.gameState || !gameStateData.gameState.isGameActive)
        ) {
          startGameButton.classList.add("show");
        } else {
          startGameButton.classList.remove("show");
        }
      }

      // Handle start game modal and prominent button
      this.handleStartGameUI(gameStateData);
    }

    // Show current player toast (only for other players, not yourself)
    if (currentPlayerName && currentPlayerName !== this.lastCurrentPlayer) {
      if (currentPlayerName !== this.playerName) {
        this.showCurrentPlayerToast(currentPlayerName);
      }
      this.lastCurrentPlayer = currentPlayerName;
    }

    // Update countdown timer display
    this.updateActionTimer(gameStateData.gameState);

    // Update community cards - only clear when starting a new hand
    if (
      gameStateData.gameState?.communityCards &&
      gameStateData.gameState.communityCards.length > 0
    ) {
      console.log(
        "Showing",
        gameStateData.gameState.communityCards.length,
        "community cards"
      );
      for (let i = 0; i < gameStateData.gameState.communityCards.length; i++) {
        gui_lay_board_card(i, gameStateData.gameState.communityCards[i]);
      }

      // Check for card matches after community cards are updated (with delay)
      setTimeout(() => {
        if (typeof gui_highlight_matching_cards === "function") {
          gui_highlight_matching_cards();
        }
      }, 500);
    }

    // Update dealer button
    if (gameStateData.gameState?.button !== undefined) {
      gui_place_dealer_button(gameStateData.gameState.button);
    }

    // Show room settings information (only once)
    if (gameStateData.roomSettings && !this.roomSettingsShown) {
      const settingsText = `Room Settings - Starting Chips: $${gameStateData.roomSettings.startingChips}, Min Call: $${gameStateData.roomSettings.minCall}, Max Call: $${gameStateData.roomSettings.maxCall}`;
      gui_log_to_history(settingsText);
      this.roomSettingsShown = true;
    }

    // Update action buttons for current player
    this.updateActionButtons(gameStateData.gameState);
  }

  isCurrentPlayer(player, gameState) {
    if (!gameState.isGameActive) return false;

    const activePlayers = this.gameState.players.filter(
      (p) => p.isActive && !p.isFolded
    );
    return (
      activePlayers[gameState.currentBettor] &&
      activePlayers[gameState.currentBettor].id === player.id
    );
  }

  updateActionButtons(gameState) {
    console.log("🎯 updateActionButtons called", {
      isGameActive: gameState.isGameActive,
      actionButtonsHidden: this.actionButtonsHidden,
      lastActionSent: this.lastActionSent,
      playerId: this.playerId,
    });

    if (!gameState.isGameActive) {
      console.log("Game not active - hiding buttons");
      gui_hide_fold_call_click();
      gui_hide_bet_range();
      return;
    }

    const myPlayer = this.gameState.players.find((p) => p.id === this.playerId);
    if (!myPlayer || !this.isCurrentPlayer(myPlayer, gameState)) {
      console.log("Not my turn - hiding buttons", {
        myPlayer: !!myPlayer,
        isCurrentPlayer: myPlayer
          ? this.isCurrentPlayer(myPlayer, gameState)
          : false,
      });
      gui_hide_fold_call_click();
      gui_hide_bet_range();
      return;
    }

    // Don't show action buttons if we have a pending action (unless it was rejected)
    if (this.actionButtonsHidden && this.lastActionSent) {
      console.log("Action pending - not showing buttons");
      return;
    }

    console.log("✅ Showing action buttons for current player");

    // Calculate call amount
    const callAmount = gameState.currentBet - myPlayer.currentBet;
    const canCall = callAmount > 0 && myPlayer.bankroll >= callAmount;
    const canCheck = callAmount === 0;

    // Setup fold/call buttons
    const callText = canCheck ? "Check" : `Call $${callAmount}`;

    gui_setup_fold_call_click(
      "Fold",
      callText,
      () => this.sendPlayerAction({ type: "fold" }),
      () => this.sendPlayerAction({ type: canCheck ? "check" : "call" })
    );

    // Setup bet range for raising
    if (myPlayer.bankroll > callAmount) {
      // Calculate the minimum raise increment (not total bet amount)
      const minRaiseIncrement = gameState.minRaise || 10;

      // Calculate minimum total bet amount needed to make a valid raise
      const minTotalBet = gameState.currentBet + minRaiseIncrement;

      // Calculate maximum total bet amount based on room settings and player bankroll
      let maxTotalBet;
      if (this.gameState && this.gameState.roomSettings) {
        // Use the room's maxCall limit as the absolute maximum
        maxTotalBet = Math.min(
          this.gameState.roomSettings.maxCall,
          myPlayer.bankroll + myPlayer.currentBet
        );
      } else {
        // Fallback: allow player to bet up to their total chips
        maxTotalBet = myPlayer.bankroll + myPlayer.currentBet;
      }

      // Ensure maxTotalBet is at least the minimum total bet amount
      maxTotalBet = Math.max(maxTotalBet, minTotalBet);

      // For the range picker, show raise increments, not total bet amounts
      const minRaiseDisplay = minRaiseIncrement;
      const maxRaiseDisplay = maxTotalBet - gameState.currentBet;
      const currentRaiseDisplay = minRaiseDisplay;

      console.log(
        `Setting up bet range: minRaise=${minRaiseDisplay}, maxRaise=${maxRaiseDisplay}, current=${currentRaiseDisplay}`
      );
      console.log(
        `Minimum total bet: ${minTotalBet}, Maximum total bet: ${maxTotalBet}`
      );
      console.log(
        `Player bankroll: ${myPlayer.bankroll}, current bet: ${myPlayer.currentBet}`
      );
      console.log(
        `Game current bet: ${gameState.currentBet}, room maxCall: ${this.gameState?.roomSettings?.maxCall}`
      );

      gui_setup_bet_range(
        minRaiseDisplay,
        maxRaiseDisplay,
        currentRaiseDisplay,
        (value) => {
          // Show preview of total bet amount when user moves slider
          const totalBetPreview = gameState.currentBet + parseInt(value);
          // Could add preview display here if needed
        }
      );
    } else {
      gui_hide_bet_range();
    }
  }

  // Show toast indicating whose turn it is
  showCurrentPlayerToast(playerName) {
    if (typeof showPlayerTurnToast === "function") {
      showPlayerTurnToast(playerName);
    } else {
      // Fallback to console log if toast function not available
      console.log(`It's ${playerName}'s turn`);
      gui_log_to_history(`It's ${playerName}'s turn`);
    }
  }

  // Update action timer display
  updateActionTimer(gameState) {
    if (!gameState || !gameState.isGameActive) {
      this.clearTimerDisplay();
      this.stopClientTimer();
      return;
    }

    // If there's time remaining, show countdown
    if (
      gameState.timeRemaining !== null &&
      gameState.timeRemaining !== undefined
    ) {
      const seconds = Math.ceil(gameState.timeRemaining / 1000);

      if (seconds > 0) {
        // Start client-side countdown
        this.startClientTimer(seconds);

        // If it's the current player's turn and time is running low, show warning
        const myPlayer = this.gameState?.players?.find(
          (p) => p.id === this.playerId
        );
        if (myPlayer && myPlayer.isCurrentPlayer && seconds <= 10) {
          this.showTimeWarning(seconds);
        }
      } else {
        this.clearTimerDisplay();
        this.stopClientTimer();
      }
    } else {
      this.clearTimerDisplay();
      this.stopClientTimer();
    }
  }

  // Start client-side countdown timer
  startClientTimer(initialSeconds) {
    this.stopClientTimer(); // Clear any existing timer

    this.timerStartTime = Date.now();
    this.timerDuration = initialSeconds;

    // Update display immediately
    this.showTimerDisplay(initialSeconds);

    // Start interval to update every second
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.timerStartTime;
      const remainingSeconds = Math.max(
        0,
        this.timerDuration - Math.floor(elapsed / 1000)
      );

      if (remainingSeconds > 0) {
        this.showTimerDisplay(remainingSeconds);

        // Show warnings for current player
        const myPlayer = this.gameState?.players?.find(
          (p) => p.id === this.playerId
        );
        if (myPlayer && myPlayer.isCurrentPlayer) {
          if (remainingSeconds === 10) {
            this.showTimeWarning(remainingSeconds);
          } else if (remainingSeconds === 5) {
            this.showTimeWarning(remainingSeconds);
          }
        }
      } else {
        this.clearTimerDisplay();
        this.stopClientTimer();
      }
    }, 1000);
  }

  // Stop client-side timer
  stopClientTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerStartTime = null;
    this.timerDuration = null;
  }

  // Show timer display in UI
  showTimerDisplay(seconds) {
    let timerElement = document.getElementById("action-timer");
    if (!timerElement) {
      // Create timer element if it doesn't exist
      timerElement = document.createElement("div");
      timerElement.id = "action-timer";
      timerElement.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-weight: bold;
        z-index: 1000;
        font-family: Arial, sans-serif;
      `;
      document.body.appendChild(timerElement);
    }

    timerElement.textContent = `Time: ${seconds}s`;

    // Change color when time is running low
    if (seconds <= 5) {
      timerElement.style.background = "rgba(255, 0, 0, 0.8)";
      timerElement.style.animation = "pulse 1s infinite";
    } else if (seconds <= 10) {
      timerElement.style.background = "rgba(255, 165, 0, 0.8)";
      timerElement.style.animation = "none";
    } else {
      timerElement.style.background = "rgba(0, 0, 0, 0.8)";
      timerElement.style.animation = "none";
    }
  }

  // Clear timer display
  clearTimerDisplay() {
    const timerElement = document.getElementById("action-timer");
    if (timerElement) {
      timerElement.remove();
    }
    this.stopClientTimer();
  }

  // Show time warning for current player
  showTimeWarning(seconds) {
    if (seconds === 10) {
      if (typeof showTimeWarningToast === "function") {
        showTimeWarningToast(`10 seconds remaining!`);
      }
    } else if (seconds === 5) {
      if (typeof showTimeWarningToast === "function") {
        showTimeWarningToast(`5 seconds left!`);
      }
    }
  }

  // Public API methods
  joinRoom(roomId = null, playerName = "Player") {
    if (!this.isConnected) {
      console.error("Cannot join room: not connected to server");
      return false;
    }

    this.playerName = playerName;

    this.send({
      type: "join_room",
      roomId: roomId,
      playerName: playerName,
    });

    return true;
  }

  createRoomWithSettings(playerName, roomSettings) {
    if (!this.isConnected) {
      console.error("Cannot create room: not connected to server");
      gui_write_game_response(
        "Not connected to server. Please refresh the page."
      );
      gui_set_game_response_font_color("red");
      return false;
    }

    this.playerName = playerName;

    this.send({
      type: "join_room",
      roomId: null, // null means create new room
      playerName: playerName,
      startingChips: roomSettings.startingChips,
      minCall: roomSettings.minCall,
      maxCall: roomSettings.maxCall,
    });

    gui_write_game_response("Creating room with custom settings...");
    gui_set_game_response_font_color("blue");

    return true;
  }

  startGame() {
    if (!this.isConnected) {
      console.error("Not connected to server");
      return false;
    }

    this.send({
      type: "start_game",
    });

    return true;
  }

  sendPlayerAction(action) {
    if (!this.isConnected) {
      console.error("Not connected to server");
      return false;
    }

    // Store the current action buttons state before hiding them
    this.lastActionSent = action;
    this.actionButtonsHidden = true;

    this.send({
      type: "player_action",
      action: action,
    });

    // Hide action buttons immediately to prevent double-clicking
    gui_hide_fold_call_click();
    gui_hide_bet_range();

    // Community card animations are now handled when cards are actually revealed, not on every action

    return true;
  }

  requestGameState() {
    if (!this.isConnected) {
      console.error("Not connected to server");
      return false;
    }

    this.send({
      type: "get_game_state",
    });

    return true;
  }

  sendChatMessage(message) {
    console.log("WebSocket: sendChatMessage called with:", message);
    console.log("WebSocket: Connected status:", this.isConnected);
    console.log("WebSocket: Room ID:", this.roomId);
    console.log("WebSocket: Player ID:", this.playerId);

    if (!this.isConnected) {
      console.error("WebSocket: Not connected to server");
      return false;
    }

    if (!message || !message.trim()) {
      console.error("WebSocket: Cannot send empty chat message");
      return false;
    }

    console.log("WebSocket: Sending chat message to server");
    this.send({
      type: "chat_message",
      message: message.trim(),
    });

    return true;
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not connected");
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;

    // Hide chat when disconnecting
    if (window.chatManager) {
      window.chatManager.setEnabled(false);
    }
  }

  // Method to enable single player mode and prevent reconnection
  enableSinglePlayerMode() {
    console.log("Enabling single player mode - disabling auto-reconnect");
    this.singlePlayerMode = true;

    // Hide chat when switching to single player
    if (window.chatManager) {
      window.chatManager.setEnabled(false);
    }

    this.disconnect();
  }

  // Getters
  getPlayerId() {
    return this.playerId;
  }

  getRoomId() {
    return this.roomId;
  }

  getGameState() {
    return this.gameState;
  }

  isInGame() {
    return this.isConnected && this.roomId && this.playerId;
  }

  updateUIAfterJoining(roomId) {
    // Hide the initial multiplayer buttons (with null checks)
    const enterNameBtn = document.getElementById("enter-name-button");
    if (enterNameBtn) enterNameBtn.style.display = "none";

    const joinRoomBtn = document.getElementById("join-room-button");
    if (joinRoomBtn) joinRoomBtn.style.display = "none";

    const createRoomBtn = document.getElementById("create-room-button");
    if (createRoomBtn) createRoomBtn.style.display = "none";

    const singlePlayerBtn = document.getElementById("singleplayer-button");
    if (singlePlayerBtn) singlePlayerBtn.style.display = "none";

    // Show and update the room code display
    const roomCodeDisplay = document.getElementById("room-code-display");
    if (roomCodeDisplay) {
      roomCodeDisplay.style.visibility = "visible";
      roomCodeDisplay.style.display = "flex";

      // Create room code display with copy button if it doesn't exist
      roomCodeDisplay.innerHTML = `
        <span>Room ID: ${roomId}</span>
        <button onclick="copyRoomId('${roomId}')" class="copy-button">
          <i class="fas fa-copy"></i>
        </button>
      `;
    }

    // Initialize start game modal handlers
    this.initializeStartGameHandlers();
  }

  handleStartGameUI(gameStateData) {
    if (!gameStateData || !gameStateData.players) return;

    const playerCount = gameStateData.players.length;
    const isGameActive =
      gameStateData.gameState && gameStateData.gameState.isGameActive;

    // Show/hide prominent start game button
    const prominentStartGame = document.getElementById("prominent-start-game");
    if (prominentStartGame) {
      if (playerCount >= 2 && !isGameActive) {
        prominentStartGame.style.display = "flex";

        // Update player count text
        const readyPlayersText = document.getElementById("ready-players-text");
        if (readyPlayersText) {
          readyPlayersText.textContent = `${playerCount} Player${
            playerCount > 1 ? "s" : ""
          } Ready`;
        }
      } else {
        prominentStartGame.style.display = "none";
      }
    }

    // Show start game modal when exactly 2 players join (only once)
    if (playerCount === 2 && !isGameActive && !this.startGameModalShown) {
      this.showStartGameModal(playerCount);
      this.startGameModalShown = true;
    }

    // Reset modal flag and hide modal when game becomes active or player count drops
    if (isGameActive || playerCount < 2) {
      this.startGameModalShown = false;
      this.hideStartGameModal(); // Hide modal immediately for all scenarios
    }
  }

  showStartGameModal(playerCount) {
    const modal = document.getElementById("start-game-modal");
    const playerCountText = document.getElementById("player-count-text");

    if (modal && playerCountText) {
      playerCountText.textContent = `${playerCount} player${
        playerCount > 1 ? "s are" : " is"
      } in the room`;
      modal.style.display = "block";
    }
  }

  hideStartGameModal() {
    const modal = document.getElementById("start-game-modal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  initializeStartGameHandlers() {
    // Prevent multiple initializations
    if (this.startGameHandlersInitialized) return;
    this.startGameHandlersInitialized = true;

    const startGameNowBtn = document.getElementById("start-game-now");
    const waitForPlayersBtn = document.getElementById("wait-for-players");
    const prominentStartBtn = document.getElementById("prominent-start-button");

    // Start game now button
    if (startGameNowBtn) {
      startGameNowBtn.onclick = () => {
        this.startGame();
        this.hideStartGameModal();
      };
    }

    // Wait for more players button
    if (waitForPlayersBtn) {
      waitForPlayersBtn.onclick = () => {
        this.hideStartGameModal();
        gui_write_game_response("Waiting for more players to join...");
        gui_set_game_response_font_color("blue");
      };
    }

    // Prominent start game button
    if (prominentStartBtn) {
      prominentStartBtn.onclick = () => {
        this.startGame();
        // Hide the prominent button immediately for better UX
        const prominentStartGame = document.getElementById(
          "prominent-start-game"
        );
        if (prominentStartGame) {
          prominentStartGame.style.display = "none";
        }
      };
    }

    // Close modal when clicking outside
    const modal = document.getElementById("start-game-modal");
    if (modal) {
      window.addEventListener("click", (event) => {
        if (event.target === modal) {
          this.hideStartGameModal();
        }
      });
    }
  }
}

// Global instance and mode tracking
let wsClient = null;
let currentGameMode = "multiplayer"; // Track current mode

// Make wsClient and currentGameMode globally accessible
window.wsClient = null;
window.currentGameMode = currentGameMode;

// Initialize WebSocket client when the page loads
function initializeMultiplayer() {
  wsClient = new PokerWebSocketClient();
  window.wsClient = wsClient;
  window.currentGameMode = "multiplayer";
  currentGameMode = "multiplayer";

  wsClient.onConnected = () => {
    gui_write_game_response("Connected to server");
    gui_set_game_response_font_color("green");

    // Only override functions if we're still in multiplayer mode
    if (currentGameMode === "multiplayer") {
      setupMultiplayerFunctions();
    }

    // Initialize chat if available
    if (window.chatManager) {
      window.chatManager.setWebSocketClient(wsClient);
    } else {
      // Chat manager might not be initialized yet, try again after a short delay
      setTimeout(() => {
        if (window.chatManager) {
          window.chatManager.setWebSocketClient(wsClient);
        }
      }, 100);
    }
  };

  wsClient.onError = (error) => {
    gui_write_game_response(`Connection error: ${error.message}`);
    gui_set_game_response_font_color("red");
  };

  // Connect to server
  wsClient.connect();
}

// Function to set up multiplayer function overrides
function setupMultiplayerFunctions() {
  console.log("Setting up multiplayer function overrides");

  // Store original functions if they exist and aren't already multiplayer versions
  if (!window.originalHumanFold && typeof human_fold === "function") {
    window.originalHumanFold = human_fold;
  }
  if (!window.originalHumanCall && typeof human_call === "function") {
    window.originalHumanCall = human_call;
  }
  if (
    !window.originalHandleHumanBet &&
    typeof handle_human_bet === "function"
  ) {
    window.originalHandleHumanBet = handle_human_bet;
  }

  // Override with multiplayer functions
  window.human_fold = function () {
    console.log("Multiplayer human_fold called");
    if (wsClient && wsClient.isInGame()) {
      wsClient.sendPlayerAction({ type: "fold" });
    }
  };

  window.human_call = function () {
    console.log("Multiplayer human_call called");
    if (wsClient && wsClient.isInGame()) {
      wsClient.sendPlayerAction({ type: "call" });
    }
  };

  window.handle_human_bet = function (raiseIncrement) {
    console.log(
      "Multiplayer handle_human_bet called with raise increment:",
      raiseIncrement
    );
    if (wsClient && wsClient.isInGame()) {
      // Convert raise increment to total bet amount
      const gameState = wsClient.getGameState();
      const totalBetAmount = gameState.currentBet + parseInt(raiseIncrement);
      console.log(
        `Converting raise increment ${raiseIncrement} to total bet amount ${totalBetAmount} (current bet: ${gameState.currentBet})`
      );

      wsClient.sendPlayerAction({ type: "raise", amount: totalBetAmount });
    }
    gui_hide_bet_range();
  };
}

// Function to restore single player functions
function restoreSinglePlayerFunctions() {
  console.log("Restoring single player function overrides");
  currentGameMode = "singleplayer";
  window.currentGameMode = "singleplayer";

  // Hide chat when switching to single player mode
  if (window.chatManager) {
    window.chatManager.setEnabled(false);
  }

  if (window.originalHumanFold) {
    window.human_fold = window.originalHumanFold;
  }
  if (window.originalHumanCall) {
    window.human_call = window.originalHumanCall;
  }
  if (window.originalHandleHumanBet) {
    window.handle_human_bet = window.originalHandleHumanBet;
  }
}

// Room management functions
function joinPokerRoom(roomId = null, playerName = null) {
  if (!wsClient) {
    initializeMultiplayer();

    // Wait for connection before joining
    setTimeout(() => {
      if (wsClient.isConnected) {
        const name = playerName || getLocalStorage("playername") || "Player";
        wsClient.joinRoom(roomId, name);
      }
    }, 1000);
  } else if (wsClient.isConnected) {
    const name = playerName || getLocalStorage("playername") || "Player";
    wsClient.joinRoom(roomId, name);
  } else {
    gui_write_game_response("Connecting to server...");
    gui_set_game_response_font_color("orange");
  }
}

function startMultiplayerGame() {
  if (wsClient && wsClient.isInGame()) {
    wsClient.startGame();
  } else {
    gui_write_game_response("Not connected to a game room");
    gui_set_game_response_font_color("red");
  }
}

function getRoomCode() {
  return wsClient ? wsClient.getRoomId() : null;
}

// Function to copy room ID to clipboard
function copyRoomId(roomId) {
  navigator.clipboard
    .writeText(roomId)
    .then(() => {
      // Show a toast notification
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = "Room ID copied to clipboard!";
      document.body.appendChild(toast);

      // Remove the toast after 2 seconds
      setTimeout(() => {
        toast.remove();
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy room ID:", err);
    });
}
