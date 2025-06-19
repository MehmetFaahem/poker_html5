const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

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
  constructor(id) {
    this.id = id;
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
    };
    this.deck = [];
    this.maxPlayers = 10;
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
      bankroll: 500,
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

    // Reset game state
    this.gameState.communityCards = [];
    this.gameState.pot = 0;
    this.gameState.currentBet = 0;
    this.gameState.round = "preflop";
    this.gameState.isGameActive = true;

    // Create and shuffle deck
    this.createDeck();
    this.shuffleDeck();

    // Deal hole cards
    this.dealHoleCards();

    // Set blinds
    this.postBlinds();

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

    const smallBlind = 5;
    const bigBlind = 10;

    // Find small blind and big blind positions
    const sbIndex = (this.gameState.button + 1) % activePlayers.length;
    const bbIndex = (this.gameState.button + 2) % activePlayers.length;

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
    this.gameState.currentBettor = (bbIndex + 1) % activePlayers.length;
  }

  processPlayerAction(playerId, action) {
    const player = this.players.get(playerId);
    if (!player || !this.gameState.isGameActive) return false;

    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );
    const currentPlayerIndex = activePlayers.findIndex((p) => p === player);

    if (currentPlayerIndex !== this.gameState.currentBettor) return false;

    switch (action.type) {
      case "fold":
        player.isFolded = true;
        break;

      case "call":
        const callAmount = Math.min(
          this.gameState.currentBet - player.currentBet,
          player.bankroll
        );
        player.currentBet += callAmount;
        player.bankroll -= callAmount;
        if (player.bankroll === 0) player.isAllIn = true;
        break;

      case "raise":
        const raiseAmount = Math.min(
          action.amount,
          player.bankroll + player.currentBet
        );
        const additionalBet = raiseAmount - player.currentBet;
        player.currentBet = raiseAmount;
        player.bankroll -= additionalBet;
        this.gameState.currentBet = raiseAmount;
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
      const winMessage = this.advanceToNextRound();
      return { success: true, winMessage };
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

    // Check if all players have matched the current bet or are all-in
    return activePlayers.every(
      (player) =>
        player.currentBet === this.gameState.currentBet || player.isAllIn
    );
  }

  advanceToNextRound() {
    // Collect bets to pot
    this.players.forEach((player) => {
      this.gameState.pot += player.currentBet;
      player.currentBet = 0;
    });

    switch (this.gameState.round) {
      case "preflop":
        this.dealFlop();
        this.gameState.round = "flop";
        break;
      case "flop":
        this.dealTurn();
        this.gameState.round = "turn";
        break;
      case "turn":
        this.dealRiver();
        this.gameState.round = "river";
        break;
      case "river":
        const winMessage = this.showdown();
        this.endHand();
        return winMessage; // Return win message to be broadcast
    }

    this.gameState.currentBet = 0;
    this.gameState.currentBettor = this.gameState.button;
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
      // Multiple players - need hand evaluation
      // For now, just give pot to first player (simplified)
      const winner = activePlayers[0];
      const winAmount = this.gameState.pot;
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

      return winMessage;
    }
  }

  endHand() {
    this.gameState.isGameActive = false;
    this.gameState.button = (this.gameState.button + 1) % this.players.size;

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
  }

  getGameStateForPlayer(playerId) {
    const player = this.players.get(playerId);
    return {
      gameState: this.gameState,
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        seat: p.seat,
        bankroll: p.bankroll,
        currentBet: p.currentBet,
        isActive: p.isActive,
        isFolded: p.isFolded,
        isAllIn: p.isAllIn,
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

function createRoom() {
  const roomId = Math.random().toString(36).substring(2, 8);
  gameRooms.set(roomId, new GameRoom(roomId));
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
        connection.ws.send(JSON.stringify(message));
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
            // Create new room
            roomId = createRoom();
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
                gameState: room.getGameStateForPlayer(null),
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
                gameState: room.getGameStateForPlayer(null),
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
                gameState: room.getGameStateForPlayer(null),
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
          gameState: room.getGameStateForPlayer(null),
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
