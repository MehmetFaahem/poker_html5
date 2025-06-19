"use strict";

class PokerWebSocketClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.roomId = null;
    this.playerName = null;
    this.isConnected = false;
    this.gameState = null;

    // Event callbacks
    this.onConnected = null;
    this.onGameUpdate = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onError = null;

    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
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
        this.attemptReconnect();
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

          console.log(`Joined room ${this.roomId} as player ${this.playerId}`);

          // Update the game UI with the initial state
          this.updateGameUI(message.gameState);

          // Show room info
          gui_write_game_response(`Joined room: ${this.roomId}`);
          gui_set_game_response_font_color("green");

          // Update room code display
          updateRoomCodeDisplay(this.roomId);
        } else {
          console.error("Failed to join room:", message.error);
          gui_write_game_response(`Failed to join room: ${message.error}`);
          gui_set_game_response_font_color("red");
        }
        break;

      case "player_joined":
        console.log(`Player ${message.playerName} joined the game`);
        gui_log_to_history(`${message.playerName} joined the game`);

        if (message.gameState) {
          this.updateGameUI(message.gameState);
        }

        if (this.onPlayerJoined) {
          this.onPlayerJoined(message);
        }
        break;

      case "player_left":
        console.log(`Player ${message.playerId} left the game`);
        gui_log_to_history(`Player left the game`);

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

        this.gameState = message.gameState;
        this.updateGameUI(message.gameState);

        if (this.onGameUpdate) {
          this.onGameUpdate(message);
        }
        break;

      case "game_update":
        console.log("Game state updated:", message.action);

        this.gameState = message.gameState;
        this.updateGameUI(message.gameState);

        // Log the action
        if (message.action) {
          const actionText = this.formatAction(
            message.action,
            message.playerId
          );
          gui_log_to_history(actionText);
        }

        if (this.onGameUpdate) {
          this.onGameUpdate(message);
        }
        break;

      case "game_state":
        this.gameState = message.gameState;
        this.updateGameUI(message.gameState);
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

  updateGameUI(gameStateData) {
    if (!gameStateData) return;

    const { gameState, players, myCards } = gameStateData;

    // Clear all seats first
    for (let i = 0; i < 10; i++) {
      gui_set_player_name("", i);
      gui_set_bankroll("", i);
      gui_set_bet("", i);
      gui_set_player_cards("", "", i);
      gui_hilite_player("", "", i);
    }

    // Update players
    players.forEach((player) => {
      if (player.seat >= 0 && player.seat < 10) {
        gui_set_player_name(player.name, player.seat);
        gui_set_bankroll(player.bankroll, player.seat);
        gui_set_bet(
          player.currentBet > 0 ? `$${player.currentBet}` : "",
          player.seat
        );

        // Set player cards
        if (player.id === this.playerId && myCards && myCards.length >= 2) {
          // Show my cards
          gui_set_player_cards(
            myCards[0],
            myCards[1],
            player.seat,
            player.isFolded
          );
        } else if (player.cards && player.cards.length >= 2) {
          // Show other players' cards (blinded or revealed)
          gui_set_player_cards(
            player.cards[0],
            player.cards[1],
            player.seat,
            player.isFolded
          );
        }

        // Highlight current player
        if (gameState.isGameActive && this.isCurrentPlayer(player, gameState)) {
          const highlightColor = gui_get_theme_mode_highlite_color();
          gui_hilite_player(highlightColor, "black", player.seat);
        } else {
          gui_hilite_player("", "", player.seat);
        }
      }
    });

    // Update community cards
    if (gameState.communityCards) {
      for (let i = 0; i < 5; i++) {
        const card = gameState.communityCards[i] || "";
        gui_lay_board_card(i, card);
      }
    }

    // Update pot
    if (gameState.pot > 0) {
      gui_write_basic_general(gameState.pot);
    } else {
      gui_write_basic_general_text("Waiting for players...");
    }

    // Update dealer button
    if (gameState.isGameActive && players.length > 0) {
      const dealerPlayer = players.find((p) => p.seat === gameState.button);
      if (dealerPlayer) {
        gui_place_dealer_button(dealerPlayer.seat);
      }
    } else {
      gui_hide_dealer_button();
    }

    // Update action buttons for current player
    this.updateActionButtons(gameState);
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
    if (!gameState.isGameActive) {
      gui_hide_fold_call_click();
      gui_hide_bet_range();
      return;
    }

    const myPlayer = this.gameState.players.find((p) => p.id === this.playerId);
    if (!myPlayer || !this.isCurrentPlayer(myPlayer, gameState)) {
      gui_hide_fold_call_click();
      gui_hide_bet_range();
      return;
    }

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
      () => this.sendPlayerAction({ type: "call" })
    );

    // Setup bet range for raising
    if (myPlayer.bankroll > callAmount) {
      const minRaise = gameState.currentBet + (gameState.minRaise || 10);
      const maxRaise = myPlayer.bankroll + myPlayer.currentBet;
      const currentValue = Math.min(minRaise, maxRaise);

      gui_setup_bet_range(minRaise, maxRaise, currentValue, (value) => {
        // Optional: preview bet amount
      });
    } else {
      gui_hide_bet_range();
    }
  }

  // Public API methods
  joinRoom(roomId = null, playerName = "Player") {
    this.playerName = playerName;

    if (!this.isConnected) {
      console.error("Not connected to server");
      return false;
    }

    this.send({
      type: "join_room",
      roomId: roomId,
      playerName: playerName,
      playerId: this.playerId, // Rejoin with same ID if reconnecting
    });

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

    this.send({
      type: "player_action",
      action: action,
    });

    // Hide action buttons immediately to prevent double-clicking
    gui_hide_fold_call_click();
    gui_hide_bet_range();

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
}

// Global instance
let wsClient = null;

// Initialize WebSocket client when the page loads
function initializeMultiplayer() {
  wsClient = new PokerWebSocketClient();

  wsClient.onConnected = () => {
    gui_write_game_response("Connected to server");
    gui_set_game_response_font_color("green");
  };

  wsClient.onError = (error) => {
    gui_write_game_response(`Connection error: ${error.message}`);
    gui_set_game_response_font_color("red");
  };

  // Connect to server
  wsClient.connect();
}

// Override the existing functions to work with multiplayer
function human_fold() {
  if (wsClient && wsClient.isInGame()) {
    wsClient.sendPlayerAction({ type: "fold" });
  }
}

function human_call() {
  if (wsClient && wsClient.isInGame()) {
    wsClient.sendPlayerAction({ type: "call" });
  }
}

function handle_human_bet(betAmount) {
  if (wsClient && wsClient.isInGame()) {
    wsClient.sendPlayerAction({ type: "raise", amount: betAmount });
  }
  gui_hide_bet_range();
}

// Room management functions
function joinPokerRoom(roomId = null) {
  if (!wsClient) {
    initializeMultiplayer();

    // Wait for connection before joining
    setTimeout(() => {
      if (wsClient.isConnected) {
        const playerName = getLocalStorage("playername") || "Player";
        wsClient.joinRoom(roomId, playerName);
      }
    }, 1000);
  } else if (wsClient.isConnected) {
    const playerName = getLocalStorage("playername") || "Player";
    wsClient.joinRoom(roomId, playerName);
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
