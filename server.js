require("dotenv").config();
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
      stakeLevel: roomSettings.stakeLevel || null,
      creatorId: roomSettings.creatorId || null,
      actionTimeout: roomSettings.actionTimeout || 10000, // 10 seconds default
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

    // If game is not active, deal hole cards to the new player immediately
    // so they can see their cards while waiting for the game to start
    if (!this.gameState.isGameActive) {
      this.dealHoleCardsToPlayer(playerId);
    }

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

    // Reset player states and clear all cards for fresh dealing
    this.players.forEach((player) => {
      player.cards = []; // Always clear cards when starting a new hand
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

    // Create and shuffle new deck for the hand
    this.createDeck();
    this.shuffleDeck();

    // Deal hole cards to all players for the new hand
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

  // Deal hole cards only to players who don't already have them
  dealHoleCardsIfNeeded() {
    const activePlayers = [...this.players.values()].filter((p) => p.isActive);

    // Deal two cards to each player who doesn't have cards yet
    activePlayers.forEach((player) => {
      if (player.cards.length < 2) {
        // Clear any existing cards and deal fresh ones
        player.cards = [];
        if (this.deck.length >= 2) {
          player.cards.push(this.deck.pop());
          player.cards.push(this.deck.pop());
        }
      }
    });
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
    if (!player || !this.gameState.isGameActive) {
      return {
        success: false,
        error: "Game is not active or player not found",
      };
    }

    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );
    const currentPlayerIndex = activePlayers.findIndex((p) => p === player);

    if (currentPlayerIndex !== this.gameState.currentBettor) {
      return { success: false, error: "Not your turn to act" };
    }

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
          return {
            success: false,
            error: "Cannot check - you must call or fold",
          };
        }
        break;

      case "call":
        // Only allow call if player needs to match the current bet
        if (player.currentBet === this.gameState.currentBet) {
          // Already matched, should be a check, not a call
          return {
            success: false,
            error: "Already matched the bet - should check instead",
          };
        }
        if (player.currentBet > this.gameState.currentBet) {
          // Overcalling is not allowed
          return {
            success: false,
            error: "Cannot call when you've already bet more",
          };
        }
        const callAmount = Math.min(
          this.gameState.currentBet - player.currentBet,
          player.bankroll
        );
        if (callAmount <= 0) {
          // Nothing to call, invalid action
          return { success: false, error: "Nothing to call" };
        }
        // Player must call the EXACT amount to match current bet
        player.currentBet += callAmount;
        player.bankroll -= callAmount;
        if (player.bankroll === 0) player.isAllIn = true;
        break;

      case "raise":
        // Calculate the amount needed to call first
        const amountToCall = this.gameState.currentBet - player.currentBet;
        const totalRaiseAmount = action.amount;

        console.log(`DEBUG: Raise action - Player: ${player.name}`);
        console.log(`  Current bet: ${this.gameState.currentBet}`);
        console.log(`  Player current bet: ${player.currentBet}`);
        console.log(`  Player bankroll: ${player.bankroll}`);
        console.log(`  Raise amount: ${totalRaiseAmount}`);
        console.log(`  Amount to call: ${amountToCall}`);
        console.log(`  Room maxCall: ${this.roomSettings.maxCall}`);

        // Validate raise amount - must be higher than current bet
        if (totalRaiseAmount <= this.gameState.currentBet) {
          console.log(
            `  REJECTED: Raise amount too low (${totalRaiseAmount} <= ${this.gameState.currentBet})`
          );
          return {
            success: false,
            error: `Raise amount must be higher than current bet of $${this.gameState.currentBet}`,
          };
        }

        // Calculate minimum raise amount
        const minimumRaise =
          this.gameState.minRaise || this.roomSettings.minCall * 2;
        const raiseIncrease = totalRaiseAmount - this.gameState.currentBet;

        console.log(`  Minimum raise: ${minimumRaise}`);
        console.log(`  Raise increase: ${raiseIncrease}`);

        // Validate minimum raise (unless player is going all-in)
        const maxPlayerCanBet = player.bankroll + player.currentBet;
        if (
          maxPlayerCanBet > totalRaiseAmount &&
          raiseIncrease < minimumRaise
        ) {
          console.log(
            `  REJECTED: Raise too small (${raiseIncrease} < ${minimumRaise})`
          );
          return {
            success: false,
            error: `Minimum raise is $${minimumRaise}, but you're only raising by $${raiseIncrease}`,
          };
        }

        // Enforce maximum bet limit
        const maxAllowedBet = Math.min(
          this.roomSettings.maxCall,
          maxPlayerCanBet
        );
        const finalRaiseAmount = Math.min(totalRaiseAmount, maxAllowedBet);

        console.log(`  Max allowed bet: ${maxAllowedBet}`);
        console.log(`  Final raise amount: ${finalRaiseAmount}`);

        // If the final raise amount is not higher than current bet, this is not a valid raise
        if (finalRaiseAmount <= this.gameState.currentBet) {
          console.log(
            `  REJECTED: Final raise amount ${finalRaiseAmount} is not higher than current bet ${this.gameState.currentBet}`
          );
          return {
            success: false,
            error: `Cannot raise - you're already at the maximum bet limit of $${this.gameState.currentBet}`,
          };
        }

        // Calculate how much player needs to bet
        const additionalBet = finalRaiseAmount - player.currentBet;

        if (additionalBet > player.bankroll) {
          console.log(
            `  REJECTED: Not enough money (${additionalBet} > ${player.bankroll})`
          );
          return {
            success: false,
            error: `Not enough chips - need $${additionalBet}, but only have $${player.bankroll}`,
          };
        }

        // Check if this is actually a raise or just a call/check
        if (
          additionalBet === 0 &&
          player.currentBet === this.gameState.currentBet
        ) {
          console.log(`  This is actually a check - no additional bet needed`);
          // This should be treated as a check, not a raise
          break; // Go to check logic
        }

        console.log(`  Additional bet needed: ${additionalBet}`);
        console.log(`  ACCEPTED: Processing raise`);

        // Update player's bet and bankroll
        player.currentBet = finalRaiseAmount;
        player.bankroll -= additionalBet;

        // Only reset acted status and update game state if this is a real raise
        const isActualRaise = finalRaiseAmount > this.gameState.currentBet;

        if (isActualRaise) {
          // Update game state
          this.gameState.currentBet = finalRaiseAmount;
          this.gameState.minRaise = Math.max(minimumRaise, raiseIncrease);

          // Reset all other players' acted status since there's a new raise
          // All players (except the raiser) need to act again
          this.gameState.playersActedThisRound.clear();
          this.gameState.playersActedThisRound.set(playerId, true);
        } else {
          console.log(
            `  No actual raise occurred - finalRaiseAmount ${finalRaiseAmount} not > currentBet ${this.gameState.currentBet}`
          );
          // Just mark this player as having acted
          this.gameState.playersActedThisRound.set(playerId, true);
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
    const nextPlayerIndex = this.getNextActivePlayer(currentPlayerIndex);
    console.log(
      `  Moving from player ${currentPlayerIndex} to player ${nextPlayerIndex}`
    );
    this.gameState.currentBettor = nextPlayerIndex;

    // Check if betting round is complete
    const isBettingComplete = this.isBettingRoundComplete();
    console.log(`  Is betting round complete? ${isBettingComplete}`);

    if (isBettingComplete) {
      console.log(`  Advancing to next round`);
      this.clearActionTimer();
      const winMessage = this.advanceToNextRound();
      return { success: true, winMessage };
    }

    // Start timer for next player
    const nextActivePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );

    console.log(
      `  Active players count: ${nextActivePlayers.length}, currentBettor: ${this.gameState.currentBettor}`
    );

    if (nextActivePlayers.length > 0) {
      // Ensure currentBettor index is valid
      if (this.gameState.currentBettor >= nextActivePlayers.length) {
        console.log(
          `  FIXING: currentBettor index ${this.gameState.currentBettor} >= ${nextActivePlayers.length}, resetting to 0`
        );
        this.gameState.currentBettor = 0;
      }

      const nextPlayer = nextActivePlayers[this.gameState.currentBettor];
      const nextPlayerId = [...this.players.entries()].find(
        ([id, player]) => player === nextPlayer
      )?.[0];

      if (nextPlayer && nextPlayerId) {
        if (!nextPlayer.isAllIn) {
          console.log(
            `  Starting timer for player ${nextPlayerId} (${nextPlayer.name}) - currentBettor index: ${this.gameState.currentBettor}`
          );
          this.startActionTimer(nextPlayerId);
        } else {
          console.log(
            `  Next player ${nextPlayer.name} is all-in, checking if betting round should complete`
          );
          // If next player is all-in, recursively check if we need to advance to another player
          // or if the betting round should complete
          const recursiveCheck = () => {
            if (this.isBettingRoundComplete()) {
              console.log(
                `  All players have acted or are all-in - completing betting round`
              );
              this.clearActionTimer();
              const winMessage = this.advanceToNextRound();
              return { success: true, winMessage };
            } else {
              // Move to next player and check again
              this.gameState.currentBettor = this.getNextActivePlayer(
                this.gameState.currentBettor
              );
              console.log(
                `  Moving to next player: ${this.gameState.currentBettor}`
              );

              if (this.gameState.currentBettor < nextActivePlayers.length) {
                const nextNextPlayer =
                  nextActivePlayers[this.gameState.currentBettor];
                if (!nextNextPlayer.isAllIn) {
                  const nextNextPlayerId = [...this.players.entries()].find(
                    ([id, player]) => player === nextNextPlayer
                  )?.[0];
                  this.startActionTimer(nextNextPlayerId);
                } else {
                  // Recursively check again
                  return recursiveCheck();
                }
              }
            }
            return { success: true };
          };

          const result = recursiveCheck();
          if (result.winMessage) {
            return result;
          }
        }
      } else {
        console.log(`  ERROR: Could not find next player or player ID`);
      }
    } else {
      console.log(`  No active players remaining`);
    }

    return { success: true };
  }

  getNextActivePlayer(currentIndex) {
    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );

    // If there's only one active player, they're the current bettor
    if (activePlayers.length <= 1) {
      return 0;
    }

    let nextIndex = (currentIndex + 1) % activePlayers.length;
    let attempts = 0;

    // Skip players who are all-in (folded players already filtered out)
    while (
      activePlayers[nextIndex].isAllIn &&
      attempts < activePlayers.length
    ) {
      nextIndex = (nextIndex + 1) % activePlayers.length;
      attempts++;
    }

    // If all players are all-in, return the original next index
    if (attempts >= activePlayers.length) {
      return (currentIndex + 1) % activePlayers.length;
    }

    return nextIndex;
  }

  isBettingRoundComplete() {
    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );

    console.log(`    Checking betting round completion:`);
    console.log(`      Active players: ${activePlayers.length}`);

    // If only one player remains, betting round is complete
    if (activePlayers.length <= 1) {
      console.log(
        `      Only ${activePlayers.length} active player(s) - round complete`
      );
      return true;
    }

    // Check if all players have acted this round AND all bets are matched
    let allPlayersActed = true;
    let allBetsMatched = true;

    for (const player of activePlayers) {
      const playerId = [...this.players.entries()].find(
        ([id, p]) => p === player
      )?.[0];

      console.log(`      Player ${player.name} (${playerId}):`);
      console.log(`        All-in: ${player.isAllIn}`);
      console.log(
        `        Current bet: ${player.currentBet}, Game current bet: ${this.gameState.currentBet}`
      );
      console.log(
        `        Has acted: ${this.gameState.playersActedThisRound.get(
          playerId
        )}`
      );

      // Skip all-in players - they don't need to act further
      if (player.isAllIn) {
        console.log(`        Skipping all-in player`);
        continue;
      }

      // Check if player has acted this round
      if (!this.gameState.playersActedThisRound.get(playerId)) {
        console.log(`        Player has NOT acted this round`);
        allPlayersActed = false;
        break;
      }

      // Check if player's bet matches current bet (or they're all-in)
      if (player.currentBet < this.gameState.currentBet && !player.isAllIn) {
        console.log(`        Player's bet doesn't match current bet`);
        allBetsMatched = false;
        break;
      }
    }

    console.log(
      `      All players acted: ${allPlayersActed}, All bets matched: ${allBetsMatched}`
    );
    const result = allPlayersActed && allBetsMatched;
    console.log(`      Betting round complete: ${result}`);
    return result;
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

    // Set post-flop betting order - always start with first player after dealer
    const activePlayers = [...this.players.values()].filter(
      (p) => p.isActive && !p.isFolded
    );

    // Find the first active player after the dealer
    this.gameState.currentBettor = 0; // Start with first active player after dealer

    // In post-flop rounds, action starts with the player immediately after the dealer
    // Find the dealer's position in the active players array
    const dealerPlayer = [...this.players.values()].find(
      (p) => p.seat === this.gameState.button
    );
    if (dealerPlayer) {
      const dealerIndex = activePlayers.findIndex((p) => p === dealerPlayer);
      if (dealerIndex !== -1) {
        this.gameState.currentBettor = (dealerIndex + 1) % activePlayers.length;
      }
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

  // New method to deal hole cards to a specific player
  dealHoleCardsToPlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    // Create deck if it doesn't exist
    if (this.deck.length === 0) {
      this.createDeck();
      this.shuffleDeck();
    }

    // Deal two cards to this player
    if (this.deck.length >= 2) {
      player.cards = [];
      player.cards.push(this.deck.pop());
      player.cards.push(this.deck.pop());
    }
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
              stakeLevel: message.stakeLevel || null,
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
            } else {
              // Action was rejected - send error response to the player
              console.log(
                `ACTION REJECTED for player ${playerId}: ${
                  result ? result.error : "Unknown error"
                }`
              );
              const connection = playerConnections.get(playerId);
              if (connection) {
                const errorMessage =
                  result && result.error
                    ? result.error
                    : "Invalid action - check bet amount and game state";
                const rejectionMessage = {
                  type: "action_rejected",
                  action: message.action,
                  error: errorMessage,
                  gameState: room.getGameStateForPlayer(playerId),
                };
                console.log(
                  `Sending action_rejected message to player ${playerId}:`,
                  rejectionMessage
                );
                connection.ws.send(JSON.stringify(rejectionMessage));
              } else {
                console.log(
                  `No connection found for player ${playerId} to send rejection`
                );
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

        case "chat_message":
          if (roomId && playerId && gameRooms.has(roomId)) {
            const room = gameRooms.get(roomId);
            const player = room.players.get(playerId);

            if (player && message.message && message.message.trim()) {
              // Sanitize the message
              const sanitizedMessage = message.message.trim().substring(0, 200);

              // Broadcast chat message to all players in the room
              broadcastToRoom(roomId, {
                type: "chat_message",
                playerId: playerId,
                playerName: player.name,
                message: sanitizedMessage,
                timestamp: Date.now(),
              });
            }
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
