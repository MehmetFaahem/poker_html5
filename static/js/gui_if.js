"use strict";

//  --- Not in the interface ---

function internal_get_a_class_named(curr, searched_name) {
  if (!curr) {
    gui_log_to_history(
      "internal_get_a_class_named, no curr for " + searched_name
    );
  }
  var notes = null;
  for (var i = 0; i < curr.childNodes.length; i++) {
    if (curr.childNodes[i].className === searched_name) {
      notes = curr.childNodes[i];
      break;
    }
  }
  return notes;
}

function internal_FixTheRanking(rank) {
  var ret_rank = "NoRank";
  if (rank === 14) {
    ret_rank = "ace";
  } else if (rank === 13) {
    ret_rank = "king";
  } else if (rank === 12) {
    ret_rank = "queen";
  } else if (rank === 11) {
    ret_rank = "jack";
  } else if (rank > 0 && rank < 11) {
    // Normal card 1 - 10
    ret_rank = rank;
  } else {
    console.log(typeof rank);
    alert("Unknown rank " + rank);
  }
  return ret_rank;
}

function internal_FixTheSuiting(suit) {
  if (suit === "c") {
    suit = "clubs";
  } else if (suit === "d") {
    suit = "diamonds";
  } else if (suit === "h") {
    suit = "hearts";
  } else if (suit === "s") {
    suit = "spades";
  } else {
    alert("Unknown suit " + suit);
    suit = "yourself";
  }
  return suit;
}

function internal_GetCardImageUrl(card) {
  var suit = card.substring(0, 1);
  var rank = parseInt(card.substring(1));
  rank = internal_FixTheRanking(rank); // 14 -> 'ace' etc
  suit = internal_FixTheSuiting(suit); // c  -> 'clubs' etc

  return "url('static/images/" + rank + "_of_" + suit + ".png')";
}

function internal_setBackground(diva, image, opacity) {
  var komage = diva.style;
  komage.opacity = opacity;
  komage["background-image"] = image;
}

function internal_setCard(diva, card, folded) {
  // card may be "" -> do not show card
  //             "blinded" -> show back
  //             "s14" -> show ace of spades
  var image = "url('static/images/cardback.png')";
  var opacity = 1.0;
  if (typeof card === "undefined") {
    alert("Undefined card " + card);
    opacity = 0.0;
  } else if (card === "") {
    opacity = 0.0;
  } else if (card === "blinded") {
  } else {
    if (folded) {
      opacity = 0.5;
    }
    image = internal_GetCardImageUrl(card);
  }
  internal_setBackground(diva, image, opacity);
}

function internal_clickin_helper(button, button_text, func_on_click) {
  if (button_text === 0) {
    button.style.display = "none";
  } else {
    button.style.display = "block";
    button.innerHTML = button_text;
    button.onclick = function () {
      console.log(
        "Button clicked:",
        button_text,
        "calling function:",
        func_on_click ? func_on_click.name || "anonymous" : "null"
      );
      if (func_on_click) {
        try {
          func_on_click();
        } catch (e) {
          console.error("Error calling button function:", e);
        }
      }
    };
  }
}

//  --- here is the GUI stuff ---

function gui_hide_poker_table() {
  var table = document.getElementById("poker_table");
  table.style.visibility = "hidden";
}

function gui_show_poker_table() {
  var table = document.getElementById("poker_table");
  table.style.visibility = "visible";
}

function gui_set_player_name(name, seat) {
  var table = document.getElementById("poker_table");
  var current = "seat" + seat;
  var seatloc = table.children[current];
  var chipsdiv = internal_get_a_class_named(seatloc, "name-chips");
  var namediv = internal_get_a_class_named(chipsdiv, "player-name");

  // Always show the seat, but with different styling for empty vs occupied
  seatloc.style.visibility = "visible";

  if (name === "" || name === null || name === undefined) {
    // Show seat label for empty seats
    namediv.textContent = "Seat " + (seat + 1);
    seatloc.classList.add("empty-seat");
    seatloc.classList.remove("occupied-seat");
  } else {
    // Show player name for occupied seats
    namediv.textContent = name;
    seatloc.classList.add("occupied-seat");
    seatloc.classList.remove("empty-seat");
  }
}

function gui_hilite_player(hilite_color, name_color, seat) {
  var table = document.getElementById("poker_table");
  var current = "seat" + seat;
  var seatloc = table.children[current];
  var chipsdiv = internal_get_a_class_named(seatloc, "name-chips");
  //  var chipsdiv = seatloc.getElementById('name-chips');
  var namediv = internal_get_a_class_named(chipsdiv, "player-name");
  if (name_color === "") {
    namediv.style.color = chipsdiv.style.color;
  } else {
    namediv.style.color = name_color;
  }
  if (hilite_color === "") {
    namediv.style.backgroundColor = chipsdiv.style.backgroundColor;
  } else {
    namediv.style.backgroundColor = hilite_color;
  }
}

function gui_set_bankroll(amount, seat) {
  var table = document.getElementById("poker_table");
  var current = "seat" + seat;
  var seatloc = table.children[current];
  var chipsdiv = internal_get_a_class_named(seatloc, "name-chips");
  //  var chipsdiv = seatloc.getElementById('name-chips');
  var namediv = internal_get_a_class_named(chipsdiv, "chips");
  if (!isNaN(amount) && amount != "") {
    amount = "$" + amount;
  }
  namediv.textContent = amount;
}

function gui_set_bet(bet, seat) {
  var table = document.getElementById("poker_table");
  var current = "seat" + seat;
  var seatloc = table.children[current];
  var betdiv = internal_get_a_class_named(seatloc, "bet");

  betdiv.textContent = bet;
}

function gui_set_player_cards(card_a, card_b, seat, folded) {
  var table = document.getElementById("poker_table");
  var current = "seat" + seat;
  var seatloc = table.children[current];
  var cardsdiv = internal_get_a_class_named(seatloc, "holecards");
  var card1 = internal_get_a_class_named(cardsdiv, "card holecard1");
  var card2 = internal_get_a_class_named(cardsdiv, "card holecard2");

  internal_setCard(card1, card_a, folded);
  internal_setCard(card2, card_b, folded);
}

function gui_lay_board_card(n, the_card) {
  // Write the card no 'n'
  // the_card = "c9";

  var current = "";

  if (n === 0) {
    current = "flop1";
  } else if (n === 1) {
    current = "flop2";
  } else if (n === 2) {
    current = "flop3";
  } else if (n === 3) {
    current = "turn";
  } else if (n === 4) {
    current = "river";
  }

  var table = document.getElementById("poker_table");
  var seatloc = table.children.board;

  var cardsdiv = seatloc.children[current];

  // Check if this is a new card being revealed (has content) and wasn't visible before
  var wasEmpty =
    cardsdiv.style.opacity === "0" ||
    cardsdiv.style.opacity === "" ||
    !cardsdiv.style.backgroundImage ||
    cardsdiv.style.backgroundImage.includes("cardback.png");

  internal_setCard(cardsdiv, the_card);

  // Add flip animation for newly revealed cards (not for clearing cards)
  if (the_card !== "" && wasEmpty) {
    cardsdiv.classList.add("boardcard-flip");
    // Remove animation class after animation completes
    setTimeout(() => {
      cardsdiv.classList.remove("boardcard-flip");
    }, 600);

    // Check for card matches after the card is revealed (delay to let animation start)
    setTimeout(() => {
      if (typeof gui_highlight_matching_cards === "function") {
        gui_highlight_matching_cards();
      }
    }, 300);
  }
}

function gui_burn_board_card(n, the_card) {
  // Write the card no 'n'
  // the_card = "c9";

  var current = "";

  if (n === 0) {
    current = "burn1";
  } else if (n === 1) {
    current = "burn2";
  } else if (n === 2) {
    current = "burn3";
  }

  var table = document.getElementById("poker_table");
  var seatloc = table.children.board;

  var cardsdiv = seatloc.children[current];
  internal_setCard(cardsdiv, the_card);
}

// Clear all community cards and burn cards completely
function gui_clear_all_board_cards() {
  console.log("Clearing all community cards from display");

  // Clear all 5 community card positions
  for (var i = 0; i < 5; i++) {
    gui_lay_board_card(i, "");
  }

  // Clear all 3 burn card positions
  for (var i = 0; i < 3; i++) {
    gui_burn_board_card(i, "");
  }

  console.log("All community cards cleared - board is now clean");
}

function gui_write_basic_general(pot_size) {
  var table = document.getElementById("poker_table");
  var pot_div = table.children.pot;
  var total_div = pot_div.children["total-pot"];

  // Show pot div when there's a meaningful pot size
  if (pot_size > 0 && pot_div.style.display === "none") {
    pot_div.style.display = "block";
  }

  var the_pot = "Total pot: " + pot_size;
  total_div.innerHTML = the_pot;
}

function gui_write_basic_general_text(text) {
  var table = document.getElementById("poker_table");
  var pot_div = table.children.pot;
  var total_div = pot_div.children["total-pot"];

  // Show pot div when displaying text
  if (text && pot_div.style.display === "none") {
    pot_div.style.display = "block";
  }

  total_div.style.visibility = "visible";
  total_div.innerHTML = text;
}

// Function to show pot div
function gui_show_pot() {
  var table = document.getElementById("poker_table");
  var pot_div = table.children.pot;
  pot_div.style.display = "block";
}

// Function to hide pot div
function gui_hide_pot() {
  var table = document.getElementById("poker_table");
  var pot_div = table.children.pot;
  pot_div.style.display = "none";
}

var log_text = [];
var log_index = 0;

function gui_log_to_history(text_to_write) {
  for (var idx = log_index; idx > 0; --idx) {
    log_text[idx] = log_text[idx - 1];
  }

  log_text[0] = text_to_write;
  if (log_index < 40) {
    log_index = log_index + 1;
  }
  var text_to_output = "<br><b>" + log_text[0] + "</b>";
  for (idx = 1; idx < log_index; ++idx) {
    text_to_output += "<br>" + log_text[idx];
  }
  var history = document.getElementById("history");
  history.innerHTML = text_to_output;
}

function gui_hide_log_window() {
  var history = document.getElementById("history");
  //  history.style.visibility = 'hidden';
  history.style.display = "none";
}

function gui_place_dealer_button(seat) {
  var table_seat = seat; // interface start at 1
  var button = document.getElementById("button");
  if (seat < 0) {
    button.style.visibility = "hidden";
  } else {
    button.style.visibility = "visible";
  }
  button.className = "seat" + table_seat + "-button";
}

function gui_hide_dealer_button() {
  gui_place_dealer_button(-3);
}

function gui_hide_fold_call_click() {
  var buttons = document.getElementById("action-options");
  var fold = buttons.children["fold-button"];
  internal_clickin_helper(fold, 0, 0);

  var call = buttons.children["call-button"];
  internal_clickin_helper(call, 0, 0);
  gui_disable_shortcut_keys();
}

function gui_setup_fold_call_click(
  show_fold,
  call_text,
  fold_func,
  call_func,
  key_ev
) {
  // Here we have a coupling of the functions 'human_fold' and 'human_call'
  var buttons = document.getElementById("action-options");
  var fold = buttons.children["fold-button"];
  internal_clickin_helper(fold, show_fold, fold_func);

  var call = buttons.children["call-button"];
  internal_clickin_helper(call, call_text, call_func);
}

function curry_in_speedfunction(speed_func) {
  var call_back = speed_func;

  var ret_func = function () {
    var buttons = document.getElementById("setup-options");
    var speed = buttons.children["speed-button"];
    var selector = speed.children["speed-selector"];
    var qqq = selector.children["speed-options"];
    var index = qqq.value;
    var value = qqq[index].text;

    call_back(value);
  };
  return ret_func;
}

function gui_set_selected_speed_option(index) {
  var buttons = document.getElementById("setup-options");
  var speed = buttons.children["speed-button"];
  var selector = speed.children["speed-selector"];
  var qqq = selector.children["speed-options"];
  qqq.value = index;
}

function internal_le_button(buttons, button_name, button_func) {
  var le_button = buttons.children[button_name];
  le_button.style.visibility = "visible";
  le_button.onclick = button_func;
}

function gui_setup_option_buttons(
  name_func,
  speed_func,
  help_func,
  check_func,
  mode_func
) {
  var buttons = document.getElementById("setup-options");

  internal_le_button(buttons, "name-button", name_func);

  var speed = buttons.children["speed-button"];
  speed.style.visibility = "visible";
  speed.onchange = curry_in_speedfunction(speed_func);

  internal_le_button(buttons, "mode-button", mode_func);
}

function internal_hide_le_button(buttons, button_name, button_func) {
  var le_button = buttons.children[button_name];
  le_button.style.visibility = "hidden";
}

function gui_hide_setup_option_buttons(
  name_func,
  speed_func,
  help_func,
  check_func
) {
  var buttons = document.getElementById("setup-options");

  internal_hide_le_button(buttons, "name-button");
  internal_hide_le_button(buttons, "speed-button");
  internal_hide_le_button(buttons, "mode-button");
}

function gui_hide_game_response() {
  var response = document.getElementById("game-response");
  response.style.visibility = "hidden";
}

function gui_show_game_response() {
  var response = document.getElementById("game-response");
  response.style.visibility = "visible";
}

function gui_write_game_response(text) {
  var response = document.getElementById("game-response");
  response.innerHTML = text;
}

function gui_set_game_response_font_color(color) {
  var response = document.getElementById("game-response");
  response.style.color = color;
}

function gui_setup_bet_range(min_value, max_value, current_value, callback) {
  var rangeContainer = document.getElementById("bet-range-container");
  var rangeInput = document.getElementById("bet-range");
  var rangeValue = document.getElementById("bet-range-value");
  var betButton = document.getElementById("bet-button");

  // Set range attributes
  rangeInput.min = min_value;
  rangeInput.max = max_value;
  rangeInput.value = current_value;
  rangeValue.innerHTML = current_value;

  // Show the range picker
  rangeContainer.style.visibility = "visible";

  // Update value display when slider is moved
  rangeInput.oninput = function () {
    rangeValue.innerHTML = this.value;
    if (callback) {
      callback(this.value);
    }
  };

  // Set up bet button
  betButton.onclick = function () {
    var betAmount = parseInt(rangeInput.value);
    // Try parent context first (for iframe), then global context (for single player)
    if (typeof parent.handle_human_bet === "function") {
      parent.handle_human_bet(betAmount);
    } else if (typeof handle_human_bet === "function") {
      handle_human_bet(betAmount);
    } else if (typeof window.handle_human_bet === "function") {
      window.handle_human_bet(betAmount);
    } else {
      console.error("handle_human_bet function not found in any context");
    }
  };
}

function gui_hide_bet_range() {
  var rangeContainer = document.getElementById("bet-range-container");
  rangeContainer.style.visibility = "hidden";
}

function gui_write_modal_box(text) {
  var modal = document.getElementById("modal-box");
  if (text === "") {
    modal.style.display = "none";
  } else {
    modal.innerHTML = text;
    modal.style.display = "block";
    modal.style.opacity = "0.90";
  }
}

function gui_initialize_css() {
  // Set all the backgrounds
  var image;
  var item;
  item = document.getElementById("poker_table");
  image = "url('static/images/poker_table.png')";
  internal_setBackground(item, image, 1.0);
}

function gui_enable_shortcut_keys(func) {
  document.addEventListener("keydown", func);
}

function gui_disable_shortcut_keys(func) {
  document.removeEventListener("keydown", func);
}

// Theme mode
function internal_get_theme_mode() {
  var mode = getLocalStorage("currentmode");
  if (mode === null) {
    // first time
    mode = "night";
    internal_set_theme_mode(mode);
  }
  return mode;
}

function internal_set_theme_mode(mode) {
  setLocalStorage("currentmode", mode);
}

function internal_get_into_the_mode(mode) {
  var buttons = document.getElementById("setup-options");
  var mode_button = buttons.children["mode-button"];

  var color;
  var button_text;
  if (mode == "dark") {
    color = "DimGray";
    button_text = "Darker";
  } else if (mode == "darker") {
    color = "#393939";
    button_text = "High contrast";
  } else if (mode == "night") {
    color = "#090909";
    button_text = "Light mode";
    gui_set_game_response_font_color("white");
  } else {
    color = "White";
    button_text = "Dark mode";
    gui_set_game_response_font_color("black");
  }
  document.body.style.backgroundColor = color;
  mode_button.innerHTML = button_text;
}

function gui_initialize_theme_mode() {
  var mode = internal_get_theme_mode();
  internal_get_into_the_mode(mode);
  internal_set_theme_mode(mode);
}

function gui_toggle_the_theme_mode() {
  var mode = internal_get_theme_mode();
  if (mode == "dark") {
    mode = "darker";
  } else if (mode == "darker") {
    mode = "night";
  } else if (mode == "night") {
    mode = "light";
  } else {
    mode = "dark";
  }
  internal_get_into_the_mode(mode);
  internal_set_theme_mode(mode);
}

function gui_get_theme_mode_highlite_color() {
  var mode = internal_get_theme_mode();
  if (mode == "dark") {
    return "orange";
  } else {
    return "darkred";
  }
}

// Win Modal Functions
function showWinModal(winnerName, winAmount, handType) {
  const modal = document.getElementById("win-modal");
  const title = document.getElementById("win-modal-title");
  const details = document.getElementById("win-modal-details");

  // Set the winner information
  title.textContent = `${winnerName} Wins!`;

  let detailsText = "";
  if (winAmount) {
    detailsText += `Won $${winAmount}`;
  }
  if (handType) {
    detailsText += handType.includes("with")
      ? ` ${handType}`
      : ` with ${handType}`;
  }
  details.textContent = detailsText;

  // Show the modal
  modal.style.display = "block";

  // Add event listeners for buttons
  setupWinModalButtons();
}

function hideWinModal() {
  const modal = document.getElementById("win-modal");
  modal.style.display = "none";
}

function setupWinModalButtons() {
  const newRoundButton = document.getElementById("new-round-button");
  const newGameButton = document.getElementById("new-game-button");

  // Remove existing event listeners
  if (newRoundButton) {
    newRoundButton.onclick = null;
  }
  if (newGameButton) {
    newGameButton.onclick = null;
  }

  // Add event listeners
  if (newRoundButton) {
    newRoundButton.onclick = function () {
      hideWinModal();
      if (typeof new_round === "function") {
        new_round();
      }
    };
  }

  if (newGameButton) {
    newGameButton.onclick = function () {
      hideWinModal();

      console.log("New Round button clicked - checking game mode...");

      // Check multiple ways to detect multiplayer mode
      const isMultiplayer =
        (typeof window.wsClient !== "undefined" &&
          window.wsClient &&
          window.wsClient.isInGame()) ||
        (typeof window.currentGameMode !== "undefined" &&
          window.currentGameMode === "multiplayer");

      console.log("Multiplayer detected:", isMultiplayer);

      if (isMultiplayer) {
        // Multiplayer mode - start new hand with existing players
        console.log("Starting new hand in multiplayer game...");
        if (typeof startMultiplayerGame === "function") {
          startMultiplayerGame();
        } else {
          console.error("startMultiplayerGame function not found");
        }
      } else {
        // Single player mode - start new round with existing setup
        if (typeof players !== "undefined" && players && players.length > 1) {
          console.log("Starting new round in single player game...");
          if (typeof new_round === "function") {
            new_round(); // Start new round, not new game
          } else {
            console.error("new_round function not found");
            // Fallback to continue with same opponents
            const numOpponents = players.length - 1;
            if (typeof new_game_continues === "function") {
              new_game_continues(numOpponents);
            }
          }
        } else {
          // No existing game setup - start completely new game
          console.log("Starting new game from scratch");
          if (typeof new_game === "function") {
            new_game();
          }
        }
      }
    };
  }

  // Close modal when clicking outside
  window.onclick = function (event) {
    const modal = document.getElementById("win-modal");
    if (event.target === modal) {
      hideWinModal();
    }
  };
}

// Function to trigger flip animation on all visible community cards when player actions occur
function gui_animate_community_cards_on_action() {
  console.log("Triggering community card flip animation");
  var table = document.getElementById("poker_table");
  var board = table.children.board;

  if (!board) {
    console.log("Board element not found");
    return;
  }

  var cardIds = ["flop1", "flop2", "flop3", "turn", "river"];
  var animatedCount = 0;

  cardIds.forEach(function (cardId) {
    var cardElement = board.children[cardId];
    if (cardElement) {
      // Check if card is visible and has actual card content (not cardback or empty)
      var isVisible =
        cardElement.style.opacity !== "0" && cardElement.style.opacity !== "";
      var hasBackground =
        cardElement.style.backgroundImage &&
        cardElement.style.backgroundImage !== "";
      var isNotCardback =
        !cardElement.style.backgroundImage.includes("cardback.png");
      var isNotEmpty = !cardElement.style.backgroundImage.includes('url("")');

      var shouldAnimate =
        isVisible && hasBackground && isNotCardback && isNotEmpty;

      console.log(
        `Card ${cardId}: visible=${isVisible}, hasBackground=${hasBackground}, notCardback=${isNotCardback}, shouldAnimate=${shouldAnimate}`
      );

      if (shouldAnimate) {
        // Remove any existing animation classes first
        cardElement.classList.remove("boardcard-action-flip");

        // Force a reflow to ensure the class removal takes effect
        void cardElement.offsetHeight;

        // Add the animation class
        cardElement.classList.add("boardcard-action-flip");
        animatedCount++;

        console.log(`Applied flip animation to ${cardId}`);

        // Remove animation class after animation completes (500ms)
        setTimeout(() => {
          cardElement.classList.remove("boardcard-action-flip");
        }, 500);
      }
    } else {
      console.log(`Card element ${cardId} not found`);
    }
  });

  console.log(`Animated ${animatedCount} community cards`);
}

// Debug function to test animation manually
function gui_test_card_animation() {
  console.log("Testing card animation manually");
  // Animation test function disabled - animations now only trigger on card reveals
}

// Function to parse card string and extract rank and suit
function parseCard(cardStr) {
  if (!cardStr || cardStr === "" || cardStr === "blinded") {
    return null;
  }

  var suit = cardStr.substring(0, 1); // h, d, c, s
  var rank = parseInt(cardStr.substring(1)); // 2-14

  return {
    suit: suit,
    rank: rank,
    original: cardStr,
  };
}

// Function to get current community cards
function getCurrentCommunityCards() {
  var table = document.getElementById("poker_table");
  var board = table.children.board;
  var communityCards = [];
  var cardIds = ["flop1", "flop2", "flop3", "turn", "river"];

  cardIds.forEach(function (cardId) {
    var cardElement = board.children[cardId];
    if (
      cardElement &&
      cardElement.style.opacity !== "0" &&
      cardElement.style.backgroundImage &&
      !cardElement.style.backgroundImage.includes("cardback.png")
    ) {
      // Extract card info from background image URL
      var bgImg = cardElement.style.backgroundImage;
      var match = bgImg.match(
        /(\d+|ace|king|queen|jack)_of_(clubs|diamonds|hearts|spades)/
      );

      if (match) {
        var rank = match[1];
        var suit = match[2];

        // Convert rank to number
        var rankNum;
        if (rank === "ace") rankNum = 14;
        else if (rank === "king") rankNum = 13;
        else if (rank === "queen") rankNum = 12;
        else if (rank === "jack") rankNum = 11;
        else rankNum = parseInt(rank);

        // Convert suit to single letter
        var suitLetter = suit.charAt(0);

        communityCards.push({
          suit: suitLetter,
          rank: rankNum,
          element: cardElement,
          id: cardId,
        });
      }
    }
  });

  return communityCards;
}

// Function to get player's hole cards
function getPlayerCards() {
  // Access global players array from poker.js
  if (typeof players === "undefined" || !players[0]) {
    return { card1: null, card2: null };
  }

  var card1 = parseCard(players[0].carda);
  var card2 = parseCard(players[0].cardb);

  return { card1: card1, card2: card2 };
}

// Function to get player card elements
function getPlayerCardElements() {
  var table = document.getElementById("poker_table");
  var seat0 = table.children["seat0"];
  var holecards = internal_get_a_class_named(seat0, "holecards");
  var card1Element = internal_get_a_class_named(holecards, "card holecard1");
  var card2Element = internal_get_a_class_named(holecards, "card holecard2");

  return { card1Element: card1Element, card2Element: card2Element };
}

// Function to detect and highlight card matches
function gui_highlight_matching_cards() {
  console.log("Checking for card matches");

  // Clear existing highlights first
  gui_clear_card_highlights();

  var playerCards = getPlayerCards();
  var communityCards = getCurrentCommunityCards();
  var playerElements = getPlayerCardElements();

  if (!playerCards.card1 || !playerCards.card2 || communityCards.length === 0) {
    console.log("No player cards or community cards to check");
    return;
  }

  console.log("Player cards:", playerCards);
  console.log("Community cards:", communityCards);

  var matches = [];

  // Check for rank matches (pairs)
  communityCards.forEach(function (commCard) {
    // Check if player card 1 matches community card rank
    if (playerCards.card1.rank === commCard.rank) {
      matches.push({
        type: "pair",
        playerCard: 1,
        communityCard: commCard,
        element: commCard.element,
      });
    }

    // Check if player card 2 matches community card rank
    if (playerCards.card2.rank === commCard.rank) {
      matches.push({
        type: "pair",
        playerCard: 2,
        communityCard: commCard,
        element: commCard.element,
      });
    }
  });

  // Check for potential flushes (same suit)
  var playerSuits = [playerCards.card1.suit, playerCards.card2.suit];
  var suitCounts = {};

  // Count suits including player cards
  playerSuits.forEach(function (suit) {
    suitCounts[suit] = (suitCounts[suit] || 0) + 1;
  });

  communityCards.forEach(function (commCard) {
    suitCounts[commCard.suit] = (suitCounts[commCard.suit] || 0) + 1;
  });

  // Check for flush potential (3+ cards of same suit)
  Object.keys(suitCounts).forEach(function (suit) {
    if (suitCounts[suit] >= 3) {
      // Highlight matching suit cards
      if (playerCards.card1.suit === suit) {
        matches.push({
          type: "flush",
          playerCard: 1,
          suit: suit,
        });
      }
      if (playerCards.card2.suit === suit) {
        matches.push({
          type: "flush",
          playerCard: 2,
          suit: suit,
        });
      }

      communityCards.forEach(function (commCard) {
        if (commCard.suit === suit) {
          matches.push({
            type: "flush",
            communityCard: commCard,
            element: commCard.element,
            suit: suit,
          });
        }
      });
    }
  });

  // Apply highlights
  matches.forEach(function (match) {
    if (match.playerCard === 1 && playerElements.card1Element) {
      if (match.type === "pair") {
        playerElements.card1Element.classList.add("card-match-pair");
      } else if (match.type === "flush") {
        playerElements.card1Element.classList.add("card-match-flush");
      }
    }

    if (match.playerCard === 2 && playerElements.card2Element) {
      if (match.type === "pair") {
        playerElements.card2Element.classList.add("card-match-pair");
      } else if (match.type === "flush") {
        playerElements.card2Element.classList.add("card-match-flush");
      }
    }

    if (match.element) {
      if (match.type === "pair") {
        match.element.classList.add("card-match-pair");
      } else if (match.type === "flush") {
        match.element.classList.add("card-match-flush");
      }
    }
  });

  console.log(`Found ${matches.length} card matches`);

  // Set timeout to clear highlights after a few seconds
  setTimeout(function () {
    gui_clear_card_highlights();
  }, 5000);
}

// Function to clear all card highlights
function gui_clear_card_highlights() {
  var allCards = document.querySelectorAll(".card, .boardcard");
  allCards.forEach(function (card) {
    card.classList.remove(
      "card-match-highlight",
      "card-match-persistent",
      "card-match-pair",
      "card-match-flush",
      "card-match-straight"
    );
  });
}

// Test function to manually trigger card highlighting
function gui_test_card_highlighting() {
  console.log("Testing card highlighting manually");
  gui_highlight_matching_cards();
}

// Timer management for single-player mode
var singlePlayerTimer = null;
var singlePlayerTimerDisplay = null;

// Function to start visual countdown timer for single-player mode
function gui_start_action_timer(seconds) {
  gui_clear_action_timer();

  console.log(`Starting ${seconds} second countdown timer`);

  // Create timer display
  singlePlayerTimerDisplay = document.createElement("div");
  singlePlayerTimerDisplay.id = "single-player-timer";
  singlePlayerTimerDisplay.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: bold;
    font-size: 18px;
    z-index: 1000;
    font-family: Arial, sans-serif;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.2);
  `;
  document.body.appendChild(singlePlayerTimerDisplay);

  var remainingSeconds = seconds;

  // Update timer display immediately
  gui_update_timer_display(remainingSeconds);

  // Start countdown
  singlePlayerTimer = setInterval(function () {
    remainingSeconds--;
    gui_update_timer_display(remainingSeconds);

    if (remainingSeconds <= 0) {
      gui_clear_action_timer();
    }
  }, 1000);
}

// Function to update timer display
function gui_update_timer_display(seconds) {
  if (!singlePlayerTimerDisplay) return;

  singlePlayerTimerDisplay.textContent = `Time remaining: ${seconds}s`;

  // Change color based on remaining time
  if (seconds <= 3) {
    singlePlayerTimerDisplay.style.background = "rgba(255, 0, 0, 0.8)";
    singlePlayerTimerDisplay.style.animation = "pulse 0.5s infinite";
    singlePlayerTimerDisplay.style.border = "2px solid red";
  } else if (seconds <= 5) {
    singlePlayerTimerDisplay.style.background = "rgba(255, 165, 0, 0.8)";
    singlePlayerTimerDisplay.style.animation = "none";
    singlePlayerTimerDisplay.style.border = "2px solid orange";
  } else {
    singlePlayerTimerDisplay.style.background = "rgba(0, 0, 0, 0.8)";
    singlePlayerTimerDisplay.style.animation = "none";
    singlePlayerTimerDisplay.style.border =
      "2px solid rgba(255, 255, 255, 0.2)";
  }
}

// Function to clear action timer
function gui_clear_action_timer() {
  if (singlePlayerTimer) {
    clearInterval(singlePlayerTimer);
    singlePlayerTimer = null;
  }

  if (singlePlayerTimerDisplay) {
    singlePlayerTimerDisplay.remove();
    singlePlayerTimerDisplay = null;
  }
}
