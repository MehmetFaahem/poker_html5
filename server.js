const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const HandEvaluator = require("./hand-evaluator");

// Create HTTP server to serve static files
const server = http.createServer((req, res) => {
  let filePath = "." + req.url;
  if (filePath === "./") {
    filePath = "./index.html";
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".gif": "image/gif",
  };

  const contentType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        res.writeHead(404);
        res.end("File not found");
      } else {
        res.writeHead(500);
        res.end("Server error: " + error.code);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Game state management
class GameRoom {
  constructor(id, roomSettings = {}) {
    this.id = id;
    this.roomSettings = {
      startingChips: roomSettings.startingChips || 500,
      minCall: roomSettings.minCall || 5,
      maxCall: roomSettings.maxCall || 50,
      creatorId: roomSettings.creatorId || null,
      actionTimeout: roomSettings.actionTimeout || 30000, // 30 seconds default
    };
    this.players = new Map(); // playerId -> player data
    this.gameState = {
      isGameActive: false,
      currentDealer: 0,
      currentBettor: -1,
      pot: 0,
      communityCards: [],
      currentBet: 0,
      minRaise: 0,
      round: "preflop", // preflop, flop, turn, river
      button: 0,
      actionStartTime: null,
      currentPlayerId: null,
      playersActedThisRound: new Map(), // Track which players have acted this round
    };
    this.deck = [];
    this.maxPlayers = 10;
    this.handEvaluator = new HandEvaluator();
    this.timeoutTimer = null;
  }

  addPlayer(playerId, playerData) {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }

    const seat = this.findEmptySeat();
    if (seat === -1) return false;

    this.players.set(playerId, {
      ...playerData,
      seat,
      cards: [],
      bankroll: this.roomSettings.startingChips,
      currentBet: 0,
      isActive: true,
      isFolded: false,
      isAllIn: false,
    });

    return true;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (this.players.size < 2 && this.gameState.isGameActive) {
      this.endGame();
    }
  }

  findEmptySeat() {
    const occupiedSeats = new Set(
      [...this.players.values()].map((p) => p.seat)
    );
    for (let i = 0; i < this.maxPlayers; i++) {
      if (!occupiedSeats.has(i)) {
        return i;
      }
    }
    return -1;
  }

  startNewHand() {
    if (this.players.size < 2) return false;

    // Reset player states
    this.players.forEach((player) => {
      player.cards = [];
      player.currentBet = 0;
      player.isFolded = false;
      player.isAllIn = false;
    });

    // Reset game state - ensure no community cards are shown initially
    this.gameState.communityCards = [];
    this.gameState.pot = 0;
    this.gameState.currentBet = 0;
    this.gameState.round = "preflop";
    this.gameState.isGameActive = true;
    this.gameState.playersActedThisRound = new Map();

    // Create and shuffle deck
    this.createDeck();
    this.shuffleDeck();

    // Deal hole cards only - no community cards yet
    this.dealHoleCards();

    // Set blinds
    this.postBlinds();

    // Set the first player to act (after big blind)
    const activePlayers = [...this.players.values()].filter((p) => p.isActive);
    if (activePlayers.length >= 2) {
      const bbIndex = (this.gameState.button + 2) % activePlayers.length;
      this.gameState.currentBettor = (bbIndex + 1) % activePlayers.length;
    }

    return true;
  }

  createDeck() {
    this.deck = [];
    const suits = ["h", "d", "c", "s"];
    for (let rank = 2; rank <= 14; rank++) {
      for (let suit of suits) {
        this.deck.push(suit + rank);
      }
    }
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  dealHoleCards() {
    const activePlayers = [...this.players.values()].filter((p) => p.isActive);

    // Deal two cards to each player
    for (let round = 0; round < 2; round++) {
      for (let player of activePlayers) {
        if (this.deck.length > 0) {
          player.cards.push(this.deck.pop());
        }
      }
    }
  }

  postBlinds() {
    const activePlayers = [...this.players.values()].filter((p) => p.isActive);
    if (activePlayers.length < 2) return;

    const smallBlind = this.roomSettings.minCall;
    const bigBlind = this.roomSettings.minCall * 2;

    let sbIndex, bbIndex;

    if (activePlayers.length === 2) {
      // Heads-up poker: Dealer (button) is small blind, opponent is big blind
      sbIndex = this.gameState.button; // Dealer = Small Blind
      bbIndex = (this.gameState.button + 1) % activePlayers.length; // Opponent = Big Blind
    } else {
      // Multi-player poker: Standard blind positions
      sbIndex = (this.gameState.button + 1) % activePlayers.length;
      bbIndex = (this.gameState.button + 2) % activePlayers.length;
    }

    // Post blinds
    activePlayers[sbIndex].currentBet = Math.min(
      smallBlind,
      activePlayers[sbIndex].bankroll
    );
    activePlayers[sbIndex].bankroll -= activePlayers[sbIndex].currentBet;

    activePlayers[bbIndex].currentBet = Math.min(
      bigBlind,
      activePlayers[bbIndex].bankroll
    );
    activePlayers[bbIndex].bankroll -= activePlayers[bbIndex].currentBet;

    this.gameState.currentBet = bigBlind;

    if (activePlayers.length === 2) {
      // Heads-up: Pre-flop betting starts with dealer (small blind)
      this.gameState.currentBettor = sbIndex;
    } else {
      // Multi-player: Pre-flop betting starts after big blind
      this.gameState.currentBettor = (bbIndex + 1) % activePlayers.length;
    }

    // Initialize player action tracking for preflop betting
    this.gameState.playersActedThisRound = new Map();

    // Start timer for first player to act
    const firstPlayer = activePlayers[this.gameState.currentBettor];
    const firstPlayerId = [...this.players.entries()].find(
      ([id, player]) => player === firstPlayer
    )?.[0];

    if (firstPlayerId && !firstPlayer.isAllIn) {
      this.startActionTimer(firstPlayerId);
    }
  }

  processPlayerAction(playerId, action) {
    const player = this.players.get(playerId);
    if (!player || !this.gameState.isGameActive) return false;

    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );
    const currentPlayerIndex = activePlayers.findIndex((p) => p === player);

    if (currentPlayerIndex !== this.gameState.currentBettor) return false;

    // Clear the action timer since player acted
    this.clearActionTimer();

    // Mark this player as having acted in this round
    this.gameState.playersActedThisRound.set(playerId, true);

    switch (action.type) {
      case "fold":
        player.isFolded = true;
        break;

      case "check":
        // Check is only valid when current bet equals player's bet
        if (this.gameState.currentBet !== player.currentBet) {
          return false; // Invalid check - must call or fold
        }
        break;

      case "call":
        // Only allow call if player needs to match the current bet
        if (player.currentBet === this.gameState.currentBet) {
          // Already matched, should be a check, not a call
          return false;
        }
        if (player.currentBet > this.gameState.currentBet) {
          // Overcalling is not allowed
          return false;
        }
        const callAmount = Math.min(
          this.gameState.currentBet - player.currentBet,
          player.bankroll
        );
        if (callAmount <= 0) {
          // Nothing to call, invalid action
          return false;
        }
        player.currentBet += callAmount;
        player.bankroll -= callAmount;
        if (player.bankroll === 0) player.isAllIn = true;
        break;

      case "raise":
        // Enforce maximum call limit
        const maxAllowedBet = Math.min(
          this.roomSettings.maxCall,
          player.bankroll + player.currentBet
        );
        const raiseAmount = Math.min(action.amount, maxAllowedBet);
        const additionalBet = raiseAmount - player.currentBet;

        if (raiseAmount <= this.gameState.currentBet) {
          // If raise amount is not higher than current bet, treat as call
          const callAmount = Math.min(
            this.gameState.currentBet - player.currentBet,
            player.bankroll
          );
          player.currentBet += callAmount;
          player.bankroll -= callAmount;
        } else {
          player.currentBet = raiseAmount;
          player.bankroll -= additionalBet;
          this.gameState.currentBet = raiseAmount;
        }

        if (player.bankroll === 0) player.isAllIn = true;
        break;
    }

    // Check if only one player remains active (others folded)
    const remainingPlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );
    if (remainingPlayers.length === 1) {
      // Immediate win - only one player left
      const winner = remainingPlayers[0];
      let winAmount = this.gameState.pot;

      // Add current bets to pot
      this.players.forEach((player) => {
        winAmount += player.currentBet;
        player.currentBet = 0;
      });

      winner.bankroll += winAmount;

      const winMessage = {
        type: "player_win",
        winnerId: [...this.players.entries()].find(
          ([id, player]) => player === winner
        )?.[0],
        winnerName: winner.name,
        amount: winAmount,
        gameState: this.getGameStateForPlayer(null),
      };

      this.gameState.pot = 0;
      this.endHand();

      return { success: true, winMessage };
    }

    // Move to next player
    this.gameState.currentBettor = this.getNextActivePlayer(currentPlayerIndex);

    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      this.clearActionTimer();
      const winMessage = this.advanceToNextRound();
      return { success: true, winMessage };
    }

    // Start timer for next player
    const nextActivePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );
    if (nextActivePlayers.length > this.gameState.currentBettor) {
      const nextPlayer = nextActivePlayers[this.gameState.currentBettor];
      const nextPlayerId = [...this.players.entries()].find(
        ([id, player]) => player === nextPlayer
      )?.[0];

      if (nextPlayerId && !nextPlayer.isAllIn) {
        this.startActionTimer(nextPlayerId);
      }
    }

    return { success: true };
  }

  getNextActivePlayer(currentIndex) {
    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );
    let nextIndex = (currentIndex + 1) % activePlayers.length;

    // Skip players who are all-in or folded
    while (
      activePlayers[nextIndex].isAllIn ||
      activePlayers[nextIndex].isFolded
    ) {
      nextIndex = (nextIndex + 1) % activePlayers.length;
      if (nextIndex === currentIndex) break; // All players are all-in or folded
    }

    return nextIndex;
  }

  isBettingRoundComplete() {
    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );

    // If only one player remains, betting round is complete
    if (activePlayers.length <= 1) {
      return true;
    }

    // Check if all players have acted this round AND all bets are matched
    let allPlayersActed = true;
    let allBetsMatched = true;

    for (const player of activePlayers) {
      const playerId = [...this.players.entries()].find(
        ([id, p]) => p === player
      )?.[0];

      // Skip all-in players - they don't need to act further
      if (player.isAllIn) {
        continue;
      }

      // Check if player has acted this round
      if (!this.gameState.playersActedThisRound.get(playerId)) {
        allPlayersActed = false;
        break;
      }

      // Check if player's bet matches current bet (or they're all-in)
      if (player.currentBet < this.gameState.currentBet && !player.isAllIn) {
        allBetsMatched = false;
        break;
      }
    }

    return allPlayersActed && allBetsMatched;
  }

  advanceToNextRound() {
    // Collect bets to pot
    this.players.forEach((player) => {
      this.gameState.pot += player.currentBet;
      player.currentBet = 0;
    });

    // Progress to next round and deal appropriate community cards
    switch (this.gameState.round) {
      case "preflop":
        this.dealFlop(); // Deal 3 cards
        this.gameState.round = "flop";
        console.log("Advanced to flop - dealt 3 community cards");
        break;
      case "flop":
        this.dealTurn(); // Deal 1 card
        this.gameState.round = "turn";
        console.log("Advanced to turn - dealt 1 community card");
        break;
      case "turn":
        this.dealRiver(); // Deal 1 card
        this.gameState.round = "river";
        console.log("Advanced to river - dealt 1 community card");
        break;
      case "river":
        const winMessage = this.showdown();
        this.endHand();
        return winMessage; // Return win message to be broadcast
    }

    this.gameState.currentBet = 0;

    // Set post-flop betting order
    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );

    if (activePlayers.length === 2) {
      // Heads-up: Post-flop betting starts with opponent (non-dealer), dealer acts last
      this.gameState.currentBettor =
        (this.gameState.button + 1) % activePlayers.length;
    } else {
      // Multi-player: Post-flop betting starts with first player after dealer
      this.gameState.currentBettor = this.gameState.button;
    }

    // Reset player action tracking for new betting round - no one has acted yet
    this.gameState.playersActedThisRound = new Map();
    console.log(
      "Reset player action tracking for new betting round:",
      this.gameState.round
    );

    // Start timer for first player in new betting round
    if (activePlayers.length > this.gameState.currentBettor) {
      const currentPlayer = activePlayers[this.gameState.currentBettor];
      const currentPlayerId = [...this.players.entries()].find(
        ([id, player]) => player === currentPlayer
      )?.[0];

      if (currentPlayerId && !currentPlayer.isAllIn) {
        this.startActionTimer(currentPlayerId);
      }
    }
  }

  dealFlop() {
    // Burn one card
    this.deck.pop();
    // Deal three community cards
    for (let i = 0; i < 3; i++) {
      if (this.deck.length > 0) {
        this.gameState.communityCards.push(this.deck.pop());
      }
    }
  }

  dealTurn() {
    // Burn one card
    this.deck.pop();
    // Deal one community card
    if (this.deck.length > 0) {
      this.gameState.communityCards.push(this.deck.pop());
    }
  }

  dealRiver() {
    // Burn one card
    this.deck.pop();
    // Deal one community card
    if (this.deck.length > 0) {
      this.gameState.communityCards.push(this.deck.pop());
    }
  }

  showdown() {
    // Determine winners and distribute pot
    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );

    if (activePlayers.length === 1) {
      // Only one player left - they win
      const winner = activePlayers[0];
      const winAmount = this.gameState.pot;
      winner.bankroll += winAmount;

      // Send win notification
      const winMessage = {
        type: "player_win",
        winnerId: [...this.players.entries()].find(
          ([id, player]) => player === winner
        )?.[0],
        winnerName: winner.name,
        amount: winAmount,
        gameState: this.getGameStateForPlayer(null),
      };

      return winMessage;
    } else {
      // Multiple players - use proper hand evaluation
      const evaluationResult = this.handEvaluator.getWinners(
        activePlayers,
        this.gameState.communityCards
      );

      if (!evaluationResult) {
        // Fallback to high card
        const winner = activePlayers[0];
        const winAmount = this.gameState.pot;
        winner.bankroll += winAmount;

        return {
          type: "player_win",
          winnerId: [...this.players.entries()].find(
            ([id, player]) => player === winner
          )?.[0],
          winnerName: winner.name,
          amount: winAmount,
          handType: "High Card",
          gameState: this.getGameStateForPlayer(null),
        };
      }

      // Count the winners
      const winnerIndices = [];
      for (let i = 0; i < evaluationResult.winners.length; i++) {
        if (evaluationResult.winners[i]) {
          winnerIndices.push(i);
        }
      }

      const numWinners = winnerIndices.length;
      const winAmountPerPlayer = Math.floor(this.gameState.pot / numWinners);
      const remainder = this.gameState.pot % numWinners;

      // Distribute winnings
      const winnerMessages = [];
      for (let i = 0; i < winnerIndices.length; i++) {
        const winnerIndex = winnerIndices[i];
        const winner = activePlayers[winnerIndex];
        let winAmount = winAmountPerPlayer;

        // Give remainder to first winner (dealer's left)
        if (i === 0) {
          winAmount += remainder;
        }

        winner.bankroll += winAmount;

        const winnerId = [...this.players.entries()].find(
          ([id, player]) => player === winner
        )?.[0];

        winnerMessages.push({
          winnerId,
          winnerName: winner.name,
          amount: winAmount,
          handType: evaluationResult.handType,
        });
      }

      // Return appropriate message format
      if (winnerMessages.length === 1) {
        return {
          type: "player_win",
          winnerId: winnerMessages[0].winnerId,
          winnerName: winnerMessages[0].winnerName,
          amount: winnerMessages[0].amount,
          handType: winnerMessages[0].handType,
          gameState: this.getGameStateForPlayer(null),
        };
      } else {
        return {
          type: "multiple_winners",
          winners: winnerMessages,
          handType: evaluationResult.handType,
          gameState: this.getGameStateForPlayer(null),
        };
      }
    }
  }

  endHand() {
    this.gameState.isGameActive = false;
    this.gameState.button = (this.gameState.button + 1) % this.players.size;

    // Clear community cards and reset round
    this.gameState.communityCards = [];
    this.gameState.round = "preflop";
    this.gameState.pot = 0;
    this.gameState.currentBet = 0;
    this.gameState.playersActedThisRound = new Map();

    console.log("Hand ended - cleared community cards and reset game state");

    // Remove players with no money
    const playersToRemove = [];
    this.players.forEach((player, playerId) => {
      if (player.bankroll <= 0) {
        playersToRemove.push(playerId);
      }
    });

    playersToRemove.forEach((playerId) => {
      this.players.delete(playerId);
    });
  }

  endGame() {
    this.gameState.isGameActive = false;
    this.clearActionTimer();
  }

  // Timeout management
  startActionTimer(playerId) {
    this.clearActionTimer();
    this.gameState.actionStartTime = Date.now();
    this.gameState.currentPlayerId = playerId;

    this.timeoutTimer = setTimeout(() => {
      this.handlePlayerTimeout(playerId);
    }, this.roomSettings.actionTimeout);
  }

  clearActionTimer() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.gameState.actionStartTime = null;
    this.gameState.currentPlayerId = null;
  }

  handlePlayerTimeout(playerId) {
    console.log(`Player ${playerId} timed out, auto-folding`);

    // Auto-fold the player
    const result = this.processPlayerAction(playerId, { type: "fold" });

    if (result && result.success) {
      // Broadcast the timeout action
      const timeoutMessage = {
        type: "player_timeout",
        playerId: playerId,
        action: { type: "fold" },
        gameState: {}, // Will be filled by broadcastToRoom
      };

      // Use the existing broadcast system
      const broadcastFunction = this.broadcastFunction;
      if (broadcastFunction) {
        broadcastFunction(this.id, timeoutMessage);
      }

      // If there's a win message from the auto-fold, broadcast it too
      if (result.winMessage) {
        setTimeout(() => {
          if (broadcastFunction) {
            broadcastFunction(this.id, result.winMessage);
          }
        }, 1000);
      }
    }
  }

  // Store broadcast function reference for timeout callbacks
  setBroadcastFunction(broadcastFn) {
    this.broadcastFunction = broadcastFn;
  }

  getGameStateForPlayer(playerId) {
    const player = this.players.get(playerId);

    // Calculate real-time pot including current bets
    let currentPot = this.gameState.pot;
    this.players.forEach((p) => {
      currentPot += p.currentBet;
    });

    // Calculate remaining time for current player
    let timeRemaining = null;
    if (this.gameState.actionStartTime && this.gameState.currentPlayerId) {
      const elapsed = Date.now() - this.gameState.actionStartTime;
      timeRemaining = Math.max(0, this.roomSettings.actionTimeout - elapsed);
    }

    return {
      gameState: {
        ...this.gameState,
        pot: currentPot, // Use calculated real-time pot
        timeRemaining: timeRemaining,
        currentPlayerId: this.gameState.currentPlayerId,
      },
      roomSettings: this.roomSettings,
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        seat: p.seat,
        bankroll: p.bankroll,
        currentBet: p.currentBet,
        isActive: p.isActive,
        isFolded: p.isFolded,
        isAllIn: p.isAllIn,
        isCurrentPlayer: id === this.gameState.currentPlayerId,
        cards:
          id === playerId ? p.cards : p.isFolded ? [] : ["blinded", "blinded"],
      })),
      myCards: player ? player.cards : [],
    };
  }
}

// Game room management
const gameRooms = new Map();
const playerConnections = new Map(); // playerId -> { ws, roomId }

function createRoom(roomSettings = {}) {
  const roomId = Math.random().toString(36).substring(2, 8);
  const room = new GameRoom(roomId, roomSettings);
  room.setBroadcastFunction(broadcastToRoom);
  gameRooms.set(roomId, room);
  return roomId;
}

function joinRoom(playerId, roomId, playerData) {
  if (!gameRooms.has(roomId)) {
    return false;
  }

  const room = gameRooms.get(roomId);
  return room.addPlayer(playerId, playerData);
}

function broadcastToRoom(roomId, message, excludePlayerId = null) {
  const room = gameRooms.get(roomId);
  if (!room) return;

  room.players.forEach((player, playerId) => {
    if (playerId !== excludePlayerId && playerConnections.has(playerId)) {
      const connection = playerConnections.get(playerId);
      if (connection.ws.readyState === WebSocket.OPEN) {
        // Create personalized message with player-specific game state
        const personalizedMessage = { ...message };
        if (personalizedMessage.gameState) {
          personalizedMessage.gameState = room.getGameStateForPlayer(playerId);
        }
        connection.ws.send(JSON.stringify(personalizedMessage));
      }
    }
  });
}

// WebSocket connection handling
wss.on("connection", (ws) => {
  let playerId = null;
  let roomId = null;

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "join_room":
          playerId =
            message.playerId || Math.random().toString(36).substring(2, 10);
          roomId = message.roomId;

          if (!roomId) {
            // Create new room with settings
            const roomSettings = {
              startingChips: message.startingChips || 500,
              minCall: message.minCall || 5,
              maxCall: message.maxCall || 50,
              creatorId: playerId,
            };
            roomId = createRoom(roomSettings);
          }

          const joined = joinRoom(playerId, roomId, {
            name: message.playerName || "Player",
            avatar: message.avatar || null,
          });

          if (joined) {
            playerConnections.set(playerId, { ws, roomId });

            const room = gameRooms.get(roomId);
            const gameState = room.getGameStateForPlayer(playerId);

            ws.send(
              JSON.stringify({
                type: "joined_room",
                success: true,
                roomId,
                playerId,
                gameState,
              })
            );

            // Notify other players
            broadcastToRoom(
              roomId,
              {
                type: "player_joined",
                playerId,
                playerName: message.playerName,
                gameState: {}, // Will be filled by broadcastToRoom with personalized data
              },
              playerId
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "joined_room",
                success: false,
                error: "Room is full or does not exist",
              })
            );
          }
          break;

        case "start_game":
          if (roomId && gameRooms.has(roomId)) {
            const room = gameRooms.get(roomId);
            if (room.startNewHand()) {
              broadcastToRoom(roomId, {
                type: "game_started",
                gameState: {}, // Will be filled by broadcastToRoom with personalized data
              });
            }
          }
          break;

        case "player_action":
          if (roomId && playerId && gameRooms.has(roomId)) {
            const room = gameRooms.get(roomId);
            const result = room.processPlayerAction(playerId, message.action);

            if (result && result.success) {
              // Broadcast regular game update
              broadcastToRoom(roomId, {
                type: "game_update",
                action: message.action,
                playerId,
                gameState: {}, // Will be filled by broadcastToRoom with personalized data
              });

              // If there's a win message, broadcast it separately
              if (result.winMessage) {
                setTimeout(() => {
                  broadcastToRoom(roomId, result.winMessage);
                }, 1000); // Delay to show the win after the action
              }
            }
          }
          break;

        case "get_game_state":
          if (roomId && playerId && gameRooms.has(roomId)) {
            const room = gameRooms.get(roomId);
            const gameState = room.getGameStateForPlayer(playerId);

            ws.send(
              JSON.stringify({
                type: "game_state",
                gameState,
              })
            );
          }
          break;
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  });

  ws.on("close", () => {
    if (playerId && playerConnections.has(playerId)) {
      const connection = playerConnections.get(playerId);
      const roomId = connection.roomId;

      playerConnections.delete(playerId);

      if (gameRooms.has(roomId)) {
        const room = gameRooms.get(roomId);
        room.removePlayer(playerId);

        // Notify other players
        broadcastToRoom(roomId, {
          type: "player_left",
          playerId,
          gameState: {}, // Will be filled by broadcastToRoom with personalized data
        });

        // Clean up empty rooms
        if (room.players.size === 0) {
          gameRooms.delete(roomId);
        }
      }
    }
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      message: "Connected to poker server",
    })
  );
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Poker server running on port ${PORT}`);
});
