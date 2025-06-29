/*
If you improve this software or find a bug, please let me know: orciu@users.sourceforge.net
Project home page: http://sourceforge.net/projects/jsholdem/
*/
"use strict";

var START_DATE;
var NUM_ROUNDS;
var STOP_AUTOPLAY = 0;
var RUN_EM = 0;
var STARTING_BANKROLL = 500;
var SMALL_BLIND;
var BIG_BLIND;
var BG_HILITE = "#FFE5A2";
var global_speed = 2;
var HUMAN_WINS_AGAIN;
var HUMAN_GOES_ALL_IN;
var cards = new Array(52);
var players = new Array(10);
var board = new Array(5);
var deck_index = 0;
var BUTTON_INDEX = 0;
var button_index = 0;
var current_bettor_index = 0;
var current_bet_amount = 0;
var current_min_raise = 20;
var players_acted_this_round = null;

// Timeout management variables
var playerActionTimeout = null;
var ACTION_TIMEOUT_DURATION = 10000; // 10 seconds

function leave_pseudo_alert() {
  gui_write_modal_box("");
}

function my_pseudo_alert(text) {
  var html =
    "<html><body topmargin=2 bottommargin=0 bgcolor=" +
    BG_HILITE +
    " onload='document.f.y.focus();'>" +
    "<font size=+2>" +
    text +
    "</font><form name=f><input name=y type=button value='  OK  ' " +
    "onclick='parent.leave_pseudo_alert()'></form></body></html>";
  gui_write_modal_box(html);
}

function player(name, bankroll, carda, cardb, status, total_bet, subtotal_bet) {
  this.name = name;
  this.bankroll = bankroll;
  this.carda = carda;
  this.cardb = cardb;
  this.status = status;
  this.total_bet = total_bet;
  this.subtotal_bet = subtotal_bet;
}

// See stackoverflow.com/questions/16427636/check-if-localstorage-is-available
function has_local_storage() {
  try {
    var storage = window["localStorage"];
    var x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return false;
  }
}

function init() {
  if (!has_local_storage()) {
    my_pseudo_alert(
      "Your browser do not support localStorage - " +
        "try a more modern browser like Firefox"
    );
    return;
  }
  gui_hide_poker_table();
  gui_hide_log_window();
  gui_hide_setup_option_buttons();
  gui_hide_fold_call_click();
  gui_hide_bet_range();
  gui_hide_dealer_button();
  gui_hide_game_response();
  gui_initialize_theme_mode();
  gui_initialize_css(); // Load background images
  make_deck();

  // Initialize pot display as hidden
  if (typeof gui_hide_pot === "function") {
    gui_hide_pot();
  }

  // Initialize multiplayer UI first (sets up WebSocket client)
  initializeMultiplayerUI();

  // Initialize WebSocket connection immediately
  initializeMultiplayer();

  // Initialize toast notifications
  initToastManager();

  // Initialize chat system
  if (typeof initializeChat === "function") {
    initializeChat();
  }

  // Initialize bet visibility state (hidden by default until game starts)
  const pokerTable = document.getElementById("poker_table");
  if (pokerTable) {
    pokerTable.classList.remove("game-active");
  }

  // Initialize all seats to show "Seat X" labels
  for (var i = 0; i < 10; i++) {
    gui_set_player_name("", i); // This will show "Seat X" for empty seats
    gui_set_bankroll("", i);
    gui_set_bet("", i);
    gui_set_player_cards("", "", i, false);
    gui_hilite_player("", "", i);
  }

  // Ensure action buttons are hidden by default
  gui_hide_fold_call_click();

  // Show poker table and controls
  gui_show_poker_table();
  gui_show_game_response();

  // Start by asking player what they want to do
  // showMultiplayerOptions();

  // Show name input screen immediately
  showNameInputScreen();
}

function make_deck() {
  var i;
  var j = 0;
  for (i = 2; i < 15; i++) {
    cards[j++] = "h" + i;
    cards[j++] = "d" + i;
    cards[j++] = "c" + i;
    cards[j++] = "s" + i;
  }
}

function handle_how_many_reply(opponents) {
  gui_write_modal_box("");
  write_settings_frame();
  new_game_continues(opponents);
  gui_initialize_css(); // Load background images
  gui_show_game_response();
}

function ask_how_many_opponents() {
  var quick_values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var asking =
    "<b><font size=+4 color=red>" +
    "So, how many opponents do you want?" +
    "</font></b><br>";
  for (var i = 0; i < 9; i++) {
    if (quick_values[i]) {
      asking +=
        "<font size=+4>" +
        "<a href='javascript:parent.handle_how_many_reply(" +
        quick_values[i] +
        ")'>" +
        quick_values[i] +
        " </a></font>" +
        "&nbsp;&nbsp;&nbsp;";
    }
  }
  var html9 = "<td><table align=center><tr><td align=center>";
  var html10 = asking + "</td></tr></table></td></tr></table></body></html>";
  gui_write_modal_box(html9 + html10);
}

function initialize_game() {
  gui_hide_poker_table();
  gui_hide_dealer_button();
  gui_hide_fold_call_click();
  gui_show_poker_table();
}

function clear_player_cards(count) {
  // Clear all 10 seats to show "Seat X" labels for empty seats
  for (var pl = 0; pl < 10; ++pl) {
    gui_set_player_cards("", "", pl);
    gui_set_player_name("", pl); // This will show "Seat X" for empty seats
    gui_set_bet("", pl);
    gui_set_bankroll("", pl);
  }
}

function new_game() {
  START_DATE = new Date();
  NUM_ROUNDS = 0;
  HUMAN_WINS_AGAIN = 0;
  initialize_game();
  ask_how_many_opponents();
}

function new_game_continues(req_no_opponents) {
  var my_players = [
    new player("Player 1", 0, "", "", "", 0, 0),
    new player("Player 2", 0, "", "", "", 0, 0),
    new player("Player 3", 0, "", "", "", 0, 0),
    new player("Player 4", 0, "", "", "", 0, 0),
    new player("Player 5", 0, "", "", "", 0, 0),
    new player("Player 6", 0, "", "", "", 0, 0),
    new player("Player 7", 0, "", "", "", 0, 0),
    new player("Player 8", 0, "", "", "", 0, 0),
    new player("Player 9", 0, "", "", "", 0, 0),
  ];

  players = new Array(req_no_opponents + 1);
  var player_name = getLocalStorage("playername");
  if (!player_name) {
    player_name = "You";
  }
  players[0] = new player(player_name, 0, "", "", "", 0, 0);
  my_players.sort(compRan);
  var i;
  for (i = 1; i < players.length; i++) {
    players[i] = my_players[i - 1];
  }
  clear_player_cards(my_players.length);
  reset_player_statuses(0);
  clear_bets();
  for (i = 0; i < players.length; i++) {
    players[i].bankroll = STARTING_BANKROLL;
  }
  button_index = Math.floor(Math.random() * players.length);
  new_round();
}

function number_of_active_players() {
  var num_playing = 0;
  var i;
  for (i = 0; i < players.length; i++) {
    if (has_money(i)) {
      num_playing += 1;
    }
  }
  return num_playing;
}

function new_round() {
  RUN_EM = 0;
  NUM_ROUNDS++;
  // Clear buttons
  gui_hide_fold_call_click();

  // Show pot div when game starts
  if (typeof gui_show_pot === "function") {
    gui_show_pot();
  }

  // Enable bet visibility for single player mode during rounds
  const pokerTable = document.getElementById("poker_table");
  if (
    (pokerTable && typeof wsClient === "undefined") ||
    !wsClient ||
    !wsClient.isInGame()
  ) {
    pokerTable.classList.add("game-active");
  }

  var num_playing = number_of_active_players();
  if (num_playing < 2) {
    // Hide pot when game is not active
    if (typeof gui_hide_pot === "function") {
      gui_hide_pot();
    }
    gui_setup_fold_call_click("Start a new game", 0, new_game, new_game);
    return;
  }
  HUMAN_GOES_ALL_IN = 0;
  reset_player_statuses(1);
  clear_bets();
  clear_pot();
  current_min_raise = 0;

  // Initialize tracking for the new round - no players have acted yet
  players_acted_this_round = new Array(players.length);
  for (var i = 0; i < players.length; i++) {
    players_acted_this_round[i] = false;
  }

  collect_cards();
  button_index = get_next_player_position(button_index, 1);
  var i;
  for (i = 0; i < players.length; i++) {
    write_player(i, 0, 0);
  }

  // Clear all community cards and burn cards at start of new hand
  // First clear the data structures
  for (i = 0; i < 5; i++) {
    board[i] = "";
  }

  // Then clear the visual display completely
  gui_clear_all_board_cards();

  console.log(
    "Starting new round - community cards cleared, board is completely clean"
  );

  var message = "<tr><td><font size=+2><b>New round</b></font>";
  gui_write_game_response(message);
  gui_hide_bet_range();
  shuffle();
  blinds_and_deal();
}

function collect_cards() {
  board = new Array(6);
  for (var i = 0; i < players.length; i++) {
    players[i].carda = "";
    players[i].cardb = "";
  }
}

function new_shuffle() {
  function get_random_int(max) {
    return Math.floor(Math.random() * max);
  }
  var len = cards.length;
  for (var i = 0; i < len; ++i) {
    var j = i + get_random_int(len - i);
    var tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
}

function shuffle() {
  new_shuffle();
  deck_index = 0;
}

function blinds_and_deal() {
  SMALL_BLIND = 5;
  BIG_BLIND = 10;
  var num_playing = number_of_active_players();
  if (num_playing == 3) {
    SMALL_BLIND = 10;
    BIG_BLIND = 20;
  } else if (num_playing < 3) {
    SMALL_BLIND = 25;
    BIG_BLIND = 50;
  }

  var small_blind, big_blind;

  if (num_playing == 2) {
    // Heads-up poker: Dealer (button) is small blind, opponent is big blind
    small_blind = button_index; // Dealer = Small Blind
    big_blind = get_next_player_position(button_index, 1); // Opponent = Big Blind
  } else {
    // Multi-player poker: Standard blind positions
    small_blind = get_next_player_position(button_index, 1);
    big_blind = get_next_player_position(small_blind, 1);
  }

  the_bet_function(small_blind, SMALL_BLIND);
  write_player(small_blind, 0, 0);
  the_bet_function(big_blind, BIG_BLIND);
  write_player(big_blind, 0, 0);
  players[big_blind].status = "OPTION";

  if (num_playing == 2) {
    // Heads-up: Pre-flop betting starts with dealer (small blind)
    current_bettor_index = small_blind;
  } else {
    // Multi-player: Pre-flop betting starts after big blind
    current_bettor_index = get_next_player_position(big_blind, 1);
  }

  deal_and_write_a();
}

function unroll_player(starting_player, player_pos, final_call) {
  var next_player = get_next_player_position(player_pos, 1);
  write_player(player_pos, 0, 0);
  if (starting_player == next_player) {
    setTimeout(final_call, 550 * global_speed);
  } else {
    setTimeout(
      unroll_player,
      550 * global_speed,
      starting_player,
      next_player,
      final_call
    );
  }
}

function deal_and_write_a() {
  var current_player;
  var start_player;

  start_player = current_player = get_next_player_position(button_index, 1);
  // Deal cards to players still active
  do {
    players[current_player].carda = cards[deck_index++];
    current_player = get_next_player_position(current_player, 1);
  } while (current_player != start_player);

  // and now show the cards
  current_player = get_next_player_position(button_index, 1);
  unroll_player(current_player, current_player, deal_and_write_b);
}

// Make a small delay before starting the bets
function delay_for_main() {
  setTimeout(main, 1000);
}

function deal_and_write_b() {
  var current_player = button_index;
  for (var i = 0; i < players.length; i++) {
    current_player = get_next_player_position(current_player, 1);
    if (players[current_player].cardb) {
      break;
    }
    players[current_player].cardb = cards[deck_index++];
  }

  current_player = get_next_player_position(button_index, 1);
  unroll_player(current_player, current_player, delay_for_main);
}

function go_to_betting() {
  // Initialize tracking for new betting round if not already set
  if (!players_acted_this_round) {
    players_acted_this_round = new Array(players.length);
    for (var i = 0; i < players.length; i++) {
      players_acted_this_round[i] = false;
    }
  }

  // Always start betting - don't skip based on number of players with money
  // The main() function will handle when to end the betting round properly
  setTimeout(main, 1000 * global_speed);
}

function unroll_table(last_pos, current_pos, final_call) {
  gui_lay_board_card(current_pos, board[current_pos]);

  if (current_pos == last_pos) {
    setTimeout(final_call, 150 * global_speed);
  } else {
    setTimeout(
      unroll_table,
      150 * global_speed,
      last_pos,
      current_pos + 1,
      final_call
    );
  }
}

function deal_flop() {
  var burn = cards[deck_index++];
  burn = "blinded";
  gui_burn_board_card(0, burn);
  var message = "<tr><td><font size=+2><b>Dealing flop</b></font>";
  gui_write_game_response(message);
  for (var i = 0; i < 3; i++) {
    board[i] = cards[deck_index++];
  }

  // Place 3 first cards
  setTimeout(
    unroll_table,
    1000,
    /*last_pos*/ 2,
    /*start_pos*/ 0,
    go_to_betting
  );
}

function deal_fourth() {
  var burn = cards[deck_index++];
  burn = "blinded";
  gui_burn_board_card(1, burn);
  var message = "<tr><td><font size=+2><b>Dealing turn</b></font>";
  gui_write_game_response(message);
  board[3] = cards[deck_index++];

  // Place 4th card
  setTimeout(
    unroll_table,
    1000,
    /*last_pos*/ 3,
    /*start_pos*/ 3,
    go_to_betting
  );
}

function deal_fifth() {
  var burn = cards[deck_index++];
  burn = "blinded";
  gui_burn_board_card(2, burn);
  var message = "<tr><td><font size=+2><b>Dealing river</b></font>";
  gui_write_game_response(message);
  board[4] = cards[deck_index++];

  // Place 5th card
  setTimeout(
    unroll_table,
    1000,
    /*last_pos*/ 4,
    /*start_pos*/ 4,
    go_to_betting
  );
}

function main() {
  gui_hide_bet_range();
  var increment_bettor_index = 0;
  if (
    players[current_bettor_index].status == "BUST" ||
    players[current_bettor_index].status == "FOLD"
  ) {
    increment_bettor_index = 1;
  } else if (!has_money(current_bettor_index)) {
    players[current_bettor_index].status = "CALL";
    // Mark player as acted since they can't do anything else (all-in)
    if (players_acted_this_round) {
      players_acted_this_round[current_bettor_index] = true;
      console.log(
        "Player",
        current_bettor_index,
        "has no money - marked as acted (all-in)"
      );
    }
    increment_bettor_index = 1;
  } else if (
    players[current_bettor_index].status == "CALL" &&
    players[current_bettor_index].subtotal_bet == current_bet_amount
  ) {
    // Player has already called and matched the bet - mark as acted
    if (players_acted_this_round) {
      players_acted_this_round[current_bettor_index] = true;
      console.log(
        "Player",
        current_bettor_index,
        "already called and matched bet - marked as acted"
      );
    }
    increment_bettor_index = 1;
  } else if (
    players_acted_this_round &&
    players_acted_this_round[current_bettor_index] &&
    players[current_bettor_index].subtotal_bet >= current_bet_amount
  ) {
    // Player has already acted this round AND matched the bet, move to next player
    console.log(
      "Player",
      current_bettor_index,
      "already acted and matched bet - skipping"
    );
    increment_bettor_index = 1;
  } else {
    // Player needs to act - reset their status and give them the option
    players[current_bettor_index].status = "";

    // If this player has acted but needs to match a higher bet, reset their acted status
    if (
      players_acted_this_round &&
      players_acted_this_round[current_bettor_index] &&
      players[current_bettor_index].subtotal_bet < current_bet_amount
    ) {
      console.log(
        "Player",
        current_bettor_index,
        "needs to act again due to raised bet"
      );
      players_acted_this_round[current_bettor_index] = false;
    }

    if (current_bettor_index == 0) {
      var call_button_text = "<u>C</u>all";
      var fold_button_text = "<font color=white><u>F</u>old</font>";
      var to_call = current_bet_amount - players[0].subtotal_bet;

      console.log("=== HUMAN PLAYER TURN ===");
      console.log("current_bet_amount:", current_bet_amount);
      console.log("players[0].subtotal_bet:", players[0].subtotal_bet);
      console.log("to_call calculated as:", to_call);

      if (to_call > players[0].bankroll) {
        to_call = players[0].bankroll;
      }
      call_button_text += " $" + to_call;
      var that_is_not_the_key_you_are_looking_for;
      if (to_call == 0) {
        console.log("SHOWING CHECK BUTTON - to_call is 0");
        call_button_text = "<u>C</u>heck";
        fold_button_text = 0;
        that_is_not_the_key_you_are_looking_for = function (key) {
          if (key == 67) {
            // Check
            human_call();
          } else {
            return true; // Not my business
          }
          return false;
        };
      } else {
        that_is_not_the_key_you_are_looking_for = function (key) {
          if (key == 67) {
            // Call
            human_call();
          } else if (key == 70) {
            // Fold
            human_fold();
          } else {
            return true; // Not my business
          }
          return false;
        };
      }
      // Fix the shortcut keys - structured and simple
      // Called through a key event
      var ret_function = function (key_event) {
        actual_function(key_event.keyCode, key_event);
      };

      // Called both by a key press and click on button.
      // Why? Because we want to disable the shortcut keys when done
      var actual_function = function (key, key_event) {
        if (that_is_not_the_key_you_are_looking_for(key)) {
          return;
        }
        gui_disable_shortcut_keys(ret_function);
        if (key_event != null) {
          key_event.preventDefault();
        }
      };

      // And now set up so the key click also go to 'actual_function'
      var do_fold = function () {
        actual_function(70, null);
      };
      var do_call = function () {
        actual_function(67, null);
      };
      // Trigger the shortcut keys
      gui_enable_shortcut_keys(ret_function);

      // And enable the buttons
      gui_setup_fold_call_click(
        fold_button_text,
        call_button_text,
        do_fold,
        do_call
      );

      // Start timeout for human player action
      startPlayerActionTimeout();

      var quick_values = new Array(6);
      if (to_call < players[0].bankroll) {
        quick_values[0] = current_min_raise;
      }
      var quick_start = quick_values[0];
      if (quick_start < 20) {
        quick_start = 20;
      } else {
        quick_start = current_min_raise + 20;
      }
      var i;
      for (i = 0; i < 5; i++) {
        if (quick_start + 20 * i < players[0].bankroll) {
          quick_values[i + 1] = quick_start + 20 * i;
        }
      }
      var bet_or_raise = "Bet";
      if (to_call > 0) {
        bet_or_raise = "Raise";
      }

      // Set up the range picker for betting - ensure proper minimum raise
      var min_bet = to_call; // Minimum to just call

      // For raises, calculate minimum raise amount
      var min_raise_total = current_bet_amount + current_min_raise;
      var min_raise_additional = Math.max(
        min_raise_total - players[0].subtotal_bet,
        to_call
      );

      var max_bet = players[0].bankroll;

      // Initial bet should be at least the minimum raise if player can afford it
      var initial_bet;
      if (to_call > 0 && players[0].bankroll >= min_raise_additional) {
        // Player has money to raise, set initial to minimum raise
        initial_bet = min_raise_additional;
        min_bet = min_raise_additional; // Force minimum to be a valid raise
      } else {
        // Player can only call or has no money to raise
        initial_bet = Math.min(to_call, max_bet);
      }

      // Setup the range slider with callback for betting
      gui_setup_bet_range(min_bet, max_bet, initial_bet, function (value) {
        // This callback will be triggered when the slider is moved
        var hi_lite_color = gui_get_theme_mode_highlite_color();
        var bet_amount = parseInt(value);
        var total_bet_amount = players[0].subtotal_bet + bet_amount;

        var action_type = "Call";
        if (bet_amount > to_call) {
          action_type = "Raise to";
        } else if (to_call === 0) {
          action_type = "Bet";
        }

        var message =
          "<tr><td><font size=+2><b>Current bet: $" +
          current_bet_amount +
          "</b><br> You need <font color=" +
          hi_lite_color +
          " size=+3>$" +
          to_call +
          "</font> to call.</font><br>" +
          action_type +
          ": <font color=" +
          hi_lite_color +
          " size=+3>$" +
          bet_amount +
          "</font> (Total: $" +
          total_bet_amount +
          ")</td></tr>";
        gui_write_game_response(message);
      });

      var hi_lite_color = gui_get_theme_mode_highlite_color();
      var message =
        "<tr><td><font size=+2><b>Current bet: $" +
        current_bet_amount +
        "</b><br> You need <font color=" +
        hi_lite_color +
        " size=+3>$" +
        to_call +
        "</font> to call.</font></td></tr>";
      gui_write_game_response(message);
      write_player(0, 1, 0);
      return;
    } else {
      write_player(current_bettor_index, 1, 0);
      setTimeout(bet_from_bot, 777 * global_speed, current_bettor_index);
      return;
    }
  }
  var can_break = true;
  console.log("=== Checking if betting round can end ===");
  console.log("Current bet amount:", current_bet_amount);
  console.log("Players acted this round:", players_acted_this_round);

  for (var j = 0; j < players.length; j++) {
    var s = players[j].status;
    console.log(
      "Player",
      j,
      "status:",
      s,
      "bet:",
      players[j].subtotal_bet,
      "acted:",
      players_acted_this_round ? players_acted_this_round[j] : "N/A"
    );

    if (s == "OPTION") {
      console.log("Player", j, "has OPTION status - betting continues");
      can_break = false;
      break;
    }
    if (s != "BUST" && s != "FOLD") {
      if (has_money(j) && players[j].subtotal_bet < current_bet_amount) {
        console.log("Player", j, "needs to match bet - betting continues");
        can_break = false;
        break;
      }
      // Check if this active player hasn't acted yet OR needs to match the bet
      if (
        players_acted_this_round &&
        has_money(j) &&
        (!players_acted_this_round[j] ||
          players[j].subtotal_bet < current_bet_amount)
      ) {
        if (!players_acted_this_round[j]) {
          console.log(
            "Player",
            j,
            "hasn't acted yet and has money - betting continues"
          );
        } else {
          console.log(
            "Player",
            j,
            "acted but needs to match bet (has money) - betting continues"
          );
        }
        can_break = false;
        break;
      }
    }
  }

  console.log("Can end betting round:", can_break);

  // Enhanced safety check: ensure all active players have had a chance to act
  if (!can_break) {
    var all_active_players_acted = true;
    var any_player_needs_to_match_bet = false;

    for (var k = 0; k < players.length; k++) {
      if (
        players[k].status != "BUST" &&
        players[k].status != "FOLD" &&
        has_money(k)
      ) {
        // Player hasn't acted this round
        if (!players_acted_this_round || !players_acted_this_round[k]) {
          all_active_players_acted = false;
          console.log("Player", k, "hasn't acted yet");
          break;
        }

        // Player needs to match the current bet
        if (players[k].subtotal_bet < current_bet_amount) {
          any_player_needs_to_match_bet = true;
          console.log(
            "Player",
            k,
            "needs to match bet:",
            current_bet_amount,
            "vs",
            players[k].subtotal_bet
          );
          break;
        }
      }
    }

    // If all active players have acted AND no one needs to match the bet, end the round
    if (all_active_players_acted && !any_player_needs_to_match_bet) {
      console.log(
        "All players acted and bets matched - forcing end of betting round"
      );
      can_break = true;
    }
  }

  if (increment_bettor_index) {
    current_bettor_index = get_next_player_position(current_bettor_index, 1);
  }
  if (can_break) {
    console.log("Ending betting round - advancing to next card");
    setTimeout(ready_for_next_card, 999 * global_speed);
  } else {
    console.log("Continuing betting round - calling main() again");
    setTimeout(main, 999 * global_speed);
  }
}

var global_pot_remainder = 0;

function handle_end_of_round() {
  var candidates = new Array(players.length);
  var allocations = new Array(players.length);
  var winning_hands = new Array(players.length);
  var my_total_bets_per_player = new Array(players.length);

  // Clear the ones that folded or are busted
  var i;
  var still_active_candidates = 0;
  for (i = 0; i < candidates.length; i++) {
    allocations[i] = 0;
    my_total_bets_per_player[i] = players[i].total_bet;
    if (players[i].status != "FOLD" && players[i].status != "BUST") {
      candidates[i] = players[i];
      still_active_candidates += 1;
    }
  }

  var my_total_pot_size = get_pot_size();
  var my_best_hand_name = "";
  var best_hand_players;
  var current_pot_to_split = 0;
  var pot_remainder = 0;
  if (global_pot_remainder) {
    gui_log_to_history(
      "transferring global pot remainder " + global_pot_remainder
    );
    pot_remainder = global_pot_remainder;
    my_total_pot_size += global_pot_remainder;
    global_pot_remainder = 0;
  }

  while (my_total_pot_size > pot_remainder + 0.9 && still_active_candidates) {
    //    gui_log_to_history("splitting pot with pot " + my_total_pot_size +
    //                       " and remainder " + pot_remainder +
    //                       " on " + still_active_candidates + " candidates" );

    // The first round all who not folded or busted are candidates
    // If that/ose winner(s) cannot get all of the pot then we try
    // with the remaining players until the pot is emptied
    var winners = get_winners(candidates);
    if (!best_hand_players) {
      best_hand_players = winners;
    }
    if (!winners) {
      //      gui_log_to_history("no winners");
      my_pseudo_alert("No winners for the pot ");
      pot_remainder = my_total_pot_size;
      my_total_pot_size = 0;
      break;
    }

    // Get the lowest winner bet, e.g. an all-in
    var lowest_winner_bet = my_total_pot_size * 2;
    var num_winners = 0;
    for (i = 0; i < winners.length; i++) {
      if (!winners[i]) {
        // Only the winners bets
        continue;
      }
      if (!my_best_hand_name) {
        my_best_hand_name = winners[i]["hand_name"];
      }
      num_winners++;
      if (my_total_bets_per_player[i] < lowest_winner_bet) {
        lowest_winner_bet = my_total_bets_per_player[i];
      }
    }

    // Compose the pot
    // If your bet was less than (a fold) or equal to the lowest winner bet:
    //    then add it to the current pot
    // If your bet was greater than lowest:
    //    then just take the 'lowest_winner_bet' to the pot

    // Take in any fraction from a previous split
    //    if (pot_remainder) {
    //      gui_log_to_history("increasing current pot with remainder " + pot_remainder);
    //    }
    current_pot_to_split = pot_remainder;
    pot_remainder = 0;

    for (i = 0; i < players.length; i++) {
      if (lowest_winner_bet >= my_total_bets_per_player[i]) {
        current_pot_to_split += my_total_bets_per_player[i];
        my_total_bets_per_player[i] = 0;
      } else {
        current_pot_to_split += lowest_winner_bet;
        my_total_bets_per_player[i] -= lowest_winner_bet;
      }
    }

    // Divide the pot - in even integrals
    //    gui_log_to_history("Divide the pot " + current_pot_to_split +
    //                       " on " + num_winners + " winner(s)");
    var share = Math.floor(current_pot_to_split / num_winners);
    // and save any remainders to next round
    pot_remainder = current_pot_to_split - share * num_winners;

    //    gui_log_to_history("share " + share + " remainder " + pot_remainder);

    for (i = 0; i < winners.length; i++) {
      if (my_total_bets_per_player[i] < 0.01) {
        candidates[i] = null; // You have got your share
      }
      if (!winners[i]) {
        // You should not have any
        continue;
      }
      my_total_pot_size -= share; // Take from the pot
      allocations[i] += share; // and give to the winners
      winning_hands[i] = winners[i].hand_name;
    }

    // Iterate until pot size is zero - or no more candidates
    for (i = 0; i < candidates.length; i++) {
      if (candidates[i] == null) {
        continue;
      }
      still_active_candidates += 1;
    }
    if (still_active_candidates == 0) {
      pot_remainder = my_total_pot_size;
      //      gui_log_to_history("no more candidates, pot_remainder " + pot_remainder);
    }
    gui_log_to_history("End of iteration");
  } // End of pot distribution

  global_pot_remainder = pot_remainder;
  //  gui_log_to_history("distributed; global_pot_remainder: " +
  //                     global_pot_remainder +
  //                     " pot_remainder: " + pot_remainder);
  pot_remainder = 0;
  var winner_text = "";
  var human_loses = 0;
  var primary_winner = null;
  var primary_winner_amount = 0;
  var primary_winner_hand = "";

  // Distribute the pot - and then do too many things
  for (i = 0; i < allocations.length; i++) {
    if (allocations[i] > 0) {
      var a_string = "" + allocations[i];
      var dot_index = a_string.indexOf(".");
      if (dot_index > 0) {
        a_string = "" + a_string + "00";
        allocations[i] = a_string.substring(0, dot_index + 3) - 0;
      }
      winner_text +=
        winning_hands[i] +
        " gives " +
        allocations[i] +
        " to " +
        players[i].name +
        ". ";
      players[i].bankroll += allocations[i];

      // Track the primary winner (player with largest allocation)
      if (allocations[i] > primary_winner_amount) {
        primary_winner = players[i].name;
        primary_winner_amount = allocations[i];
        primary_winner_hand = winning_hands[i];
      }

      if (best_hand_players[i]) {
        // function write_player(n, hilite, show_cards)
        write_player(i, 2, 1);
      } else {
        write_player(i, 1, 1);
      }
    } else {
      if (!has_money(i) && players[i].status != "BUST") {
        players[i].status = "BUST";
        if (i == 0) {
          human_loses = 1;
        }
      }
      if (players[i].status != "FOLD") {
        write_player(i, 0, 1);
      }
    }
  }

  // Show win modal if there's a winner
  if (primary_winner && primary_winner_amount > 0) {
    setTimeout(function () {
      if (typeof showWinModal === "function") {
        showWinModal(
          primary_winner,
          primary_winner_amount,
          primary_winner_hand
        );
      }
    }, 1000); // Delay to let the table update first
  }
  // Have a more liberal take on winning
  if (allocations[0] > 5) {
    HUMAN_WINS_AGAIN++;
  } else {
    HUMAN_WINS_AGAIN = 0;
  }

  var detail = "";
  for (i = 0; i < players.length; i++) {
    if (players[i].total_bet == 0 && players[i].status == "BUST") {
      continue; // Skip busted players
    }
    detail +=
      players[i].name +
      " bet " +
      players[i].total_bet +
      " & got " +
      allocations[i] +
      ".\\n";
  }
  detail = " (<a href='javascript:alert(\"" + detail + "\")'>details</a>)";

  var quit_text = "<font color=white>Restart</font>";
  var quit_func = new_game;
  var continue_text = "<font color=white>Go on</font>";
  var continue_func = new_round;

  if (players[0].status == "BUST" && !human_loses) {
    continue_text = 0;
    quit_func = function () {
      parent.STOP_AUTOPLAY = 1;
    };
    setTimeout(autoplay_new_round, 1500 + 1100 * global_speed);
  }

  var num_playing = number_of_active_players();
  if (num_playing < 2) {
    // Convoluted way of finding the active player and give him the pot
    for (i = 0; i < players.length; i++) {
      // For whosoever hath, to him shall be given
      if (has_money(i)) {
        players[i].bankroll += pot_remainder;
        pot_remainder = 0;
      }
    }
  }
  if (pot_remainder) {
    var local_text = "There is " + pot_remainder + " put into next pot\n";
    detail += local_text;
  }
  var hi_lite_color = gui_get_theme_mode_highlite_color();
  var html =
    "<html><body topmargin=2 bottommargin=0 bgcolor=" +
    BG_HILITE +
    " onload='document.f.c.focus();'><table><tr><td>" +
    get_pot_size_html() +
    "</td></tr></table><br><font size=+2 color=" +
    hi_lite_color +
    "><b>Winning: " +
    winner_text +
    "</b></font>" +
    detail +
    "<br>";
  gui_write_game_response(html);

  gui_setup_fold_call_click(quit_text, continue_text, quit_func, continue_func);

  var elapsed_milliseconds = new Date() - START_DATE;
  var elapsed_time = makeTimeString(elapsed_milliseconds);

  if (human_loses == 1) {
    var ending = NUM_ROUNDS == 1 ? "1 deal." : NUM_ROUNDS + " deals.";
    my_pseudo_alert(
      "Sorry, you busted " +
        players[0].name +
        ".\n\n" +
        elapsed_time +
        ", " +
        ending
    );
  } else {
    num_playing = number_of_active_players();
    if (num_playing < 2) {
      var end_msg = "GAME OVER!";
      var over_ending = NUM_ROUNDS == 1 ? "1 deal." : NUM_ROUNDS + " deals.";
      if (has_money(0)) {
        end_msg += "\n\nYOU WIN " + players[0].name.toUpperCase() + "!!!";
      } else {
        end_msg += "\n\nSorry, you lost.";
      }
      my_pseudo_alert(
        end_msg + "\n\nThis game lasted " + elapsed_time + ", " + over_ending
      );
    }
  }
}

function autoplay_new_round() {
  if (STOP_AUTOPLAY > 0) {
    STOP_AUTOPLAY = 0;
    new_game();
  } else {
    new_round();
  }
}

function ready_for_next_card() {
  var num_betting = get_num_betting();
  var i;
  for (i = 0; i < players.length; i++) {
    players[i].total_bet += players[i].subtotal_bet;
  }
  clear_bets();

  // If all community cards are dealt, end the hand
  if (board[4]) {
    handle_end_of_round();
    return;
  }

  current_min_raise = BIG_BLIND;
  reset_player_statuses(2);

  // Reset tracking for new betting round
  players_acted_this_round = new Array(players.length);
  for (i = 0; i < players.length; i++) {
    players_acted_this_round[i] = false;
  }

  var num_playing = number_of_active_players();

  if (num_playing == 2) {
    // Heads-up: Post-flop betting starts with opponent (non-dealer), dealer acts last
    var opponent = get_next_player_position(button_index, 1);
    if (players[opponent].status == "FOLD") {
      players[button_index].status = "OPTION";
      current_bettor_index = button_index;
    } else {
      players[opponent].status = "OPTION";
      current_bettor_index = opponent;
    }
  } else {
    // Multi-player: Post-flop betting starts with first player after dealer
    if (players[button_index].status == "FOLD") {
      players[get_next_player_position(button_index, -1)].status = "OPTION";
    } else {
      players[button_index].status = "OPTION";
    }
    current_bettor_index = get_next_player_position(button_index, 1);
  }

  var show_cards = 0;
  if (num_betting < 2) {
    show_cards = 1;
  }

  if (!RUN_EM) {
    for (i = 0; i < players.length; i++) {
      // <-- UNROLL
      if (players[i].status != "BUST" && players[i].status != "FOLD") {
        write_player(i, 0, show_cards);
      }
    }
  }

  if (num_betting < 2) {
    RUN_EM = 1;
  }

  // Deal community cards step by step - only deal the next card in sequence
  if (!board[0]) {
    // Deal flop (3 cards)
    deal_flop();
  } else if (!board[3]) {
    // Deal turn (1 card)
    deal_fourth();
  } else if (!board[4]) {
    // Deal river (1 card)
    deal_fifth();
  }
}

function the_bet_function(player_index, bet_amount) {
  if (players[player_index].status == "FOLD") {
    return 0;
    // FOLD ;
  } else if (bet_amount >= players[player_index].bankroll) {
    // ALL IN
    bet_amount = players[player_index].bankroll;

    var old_current_bet = current_bet_amount;

    if (players[player_index].subtotal_bet + bet_amount > current_bet_amount) {
      current_bet_amount = players[player_index].subtotal_bet + bet_amount;
    }

    // current_min_raise should be calculated earlier ? <--
    var new_current_min_raise = current_bet_amount - old_current_bet;
    if (new_current_min_raise > current_min_raise) {
      current_min_raise = new_current_min_raise;
    }

    // Reset all other players' acted status since this is a raise
    if (current_bet_amount > old_current_bet && players_acted_this_round) {
      for (var i = 0; i < players.length; i++) {
        if (i !== player_index) {
          players_acted_this_round[i] = false;
        }
      }
    }

    players[player_index].status = "CALL";
  } else if (
    bet_amount + players[player_index].subtotal_bet ==
    current_bet_amount
  ) {
    // CALL - bet_amount should always be > 0 here
    // Validate: if current_bet_amount > player's subtotal_bet, bet_amount must be > 0
    var amount_to_call =
      current_bet_amount - players[player_index].subtotal_bet;
    if (amount_to_call > 0 && bet_amount <= 0) {
      // Player is trying to call $0 when there's money to call - invalid
      if (player_index == 0) {
        my_pseudo_alert(
          "Invalid action: You cannot call $0 when there is $" +
            amount_to_call +
            " to call. You must call exactly $" +
            amount_to_call +
            ", raise, or fold."
        );
      }
      return 0;
    }

    // Player must call the EXACT amount to match current bet
    if (amount_to_call > 0 && bet_amount !== amount_to_call) {
      if (player_index == 0) {
        my_pseudo_alert(
          "Invalid call amount: You must call exactly $" +
            amount_to_call +
            " to match the current bet of $" +
            current_bet_amount +
            ". You cannot call $" +
            bet_amount +
            "."
        );
      }
      return 0;
    }

    players[player_index].status = "CALL";
  } else if (
    current_bet_amount >
    players[player_index].subtotal_bet + bet_amount
  ) {
    // BET TOO SMALL - doesn't meet current bet
    if (player_index == 0) {
      my_pseudo_alert(
        "The current bet to match is $" +
          current_bet_amount +
          "\nYou must bet a total of at least $" +
          (current_bet_amount - players[player_index].subtotal_bet) +
          " to call, or raise to at least $" +
          (current_bet_amount + current_min_raise) +
          ", or fold."
      );
    }
    return 0;
  } else if (
    bet_amount + players[player_index].subtotal_bet > current_bet_amount && // RAISE
    get_pot_size() > 0 &&
    bet_amount + players[player_index].subtotal_bet - current_bet_amount <
      current_min_raise
  ) {
    // RAISE TOO SMALL - doesn't meet minimum raise
    var min_total_for_valid_raise = current_bet_amount + current_min_raise;
    var min_additional_bet_needed =
      min_total_for_valid_raise - players[player_index].subtotal_bet;

    if (player_index == 0) {
      my_pseudo_alert(
        "Minimum raise amount is $" +
          current_min_raise +
          ".\nTo raise, you must bet at least $" +
          min_additional_bet_needed +
          " (total bet of $" +
          min_total_for_valid_raise +
          ")."
      );
    }
    return 0;
  } else {
    // VALID RAISE
    players[player_index].status = "CALL";

    var previous_current_bet = current_bet_amount;
    current_bet_amount = players[player_index].subtotal_bet + bet_amount;

    if (get_pot_size() > 0) {
      current_min_raise = current_bet_amount - previous_current_bet;
      if (current_min_raise < BIG_BLIND) {
        current_min_raise = BIG_BLIND;
      }
    }

    // Reset all other players' acted status since there's a new raise
    if (players_acted_this_round && current_bet_amount > previous_current_bet) {
      for (var i = 0; i < players.length; i++) {
        if (i !== player_index) {
          players_acted_this_round[i] = false;
        }
      }
      console.log("New raise detected - reset all other players' acted status");
    }
  }
  players[player_index].subtotal_bet += bet_amount;
  players[player_index].bankroll -= bet_amount;
  var current_pot_size = get_pot_size();
  gui_write_basic_general(current_pot_size);
  return 1;
}

function human_call() {
  console.log("human_call() called in single player mode!");

  // Clear timeout since player acted
  clearPlayerActionTimeout();

  // Clear buttons
  gui_hide_fold_call_click();

  // Mark player as having acted this round BEFORE processing the bet
  if (players_acted_this_round) {
    players_acted_this_round[0] = true;
    console.log("Player 0 marked as acted (call/check)");
  }

  // Process the call/check action
  var call_amount = current_bet_amount - players[0].subtotal_bet;

  console.log("human_call: current_bet_amount =", current_bet_amount);
  console.log("human_call: players[0].subtotal_bet =", players[0].subtotal_bet);
  console.log("human_call: call_amount =", call_amount);

  if (call_amount > 0) {
    // There's a bet to call - this should be a CALL action
    console.log("Processing CALL action for $" + call_amount);
    players[0].status = "CALL";
    var bet_result = the_bet_function(0, call_amount);
    if (!bet_result) {
      // the_bet_function failed - this shouldn't happen for a valid call
      console.error("the_bet_function failed for call amount:", call_amount);
      my_pseudo_alert("Invalid call action.");
      return;
    }
    // Note: the_bet_function already updates the pot display
  } else if (call_amount === 0) {
    // No bet to call, this is a check
    console.log("Processing CHECK action");
    players[0].status = "CHECK";
    // Update pot display even for check (to ensure it's current)
    var current_pot_size = get_pot_size();
    gui_write_basic_general(current_pot_size);
  } else {
    // This shouldn't happen (negative call amount), but handle it
    console.error("Invalid call amount (negative):", call_amount);
    my_pseudo_alert("Invalid action: Cannot call negative amount.");
    return;
  }

  // Community card animations are now handled when cards are actually revealed, not on every action

  current_bettor_index = get_next_player_position(0, 1);
  write_player(0, 0, 0);
  main();
}

function handle_human_bet(bet_amount) {
  console.log(
    "handle_human_bet() called in single player mode with amount:",
    bet_amount
  );

  // Clear timeout since player acted
  clearPlayerActionTimeout();

  if (bet_amount < 0 || isNaN(bet_amount)) bet_amount = 0;
  var to_call = current_bet_amount - players[0].subtotal_bet;
  bet_amount += to_call;
  var is_ok_bet = the_bet_function(0, bet_amount);
  if (is_ok_bet) {
    players[0].status = "CALL";

    // Mark player as having acted this round
    if (players_acted_this_round) {
      players_acted_this_round[0] = true;
      console.log("Player 0 marked as acted (bet/raise)");
    }

    // Community card animations are now handled when cards are actually revealed, not on every action

    current_bettor_index = get_next_player_position(0, 1);
    write_player(0, 0, 0);
    main();
    gui_hide_bet_range();
  } else {
    crash_me();
  }
}

function human_fold() {
  console.log("human_fold() called in single player mode!");

  // Clear timeout since player acted (or timeout triggered this fold)
  clearPlayerActionTimeout();

  players[0].status = "FOLD";

  // Mark player as having acted this round
  if (players_acted_this_round) {
    players_acted_this_round[0] = true;
    console.log("Player 0 marked as acted (fold)");
  }

  // Community card animations are now handled when cards are actually revealed, not on every action

  // Clear the buttons - not able to call
  gui_hide_fold_call_click();
  current_bettor_index = get_next_player_position(0, 1);
  write_player(0, 0, 0);
  var current_pot_size = get_pot_size();
  gui_write_basic_general(current_pot_size);
  main();
}

function bet_from_bot(x) {
  var b = 0;
  var n = current_bet_amount - players[x].subtotal_bet;
  if (!board[0]) b = bot_get_preflop_bet();
  else b = bot_get_postflop_bet();
  if (b >= players[x].bankroll) {
    // ALL IN
    players[x].status = "";
  } else if (b < n) {
    // BET 2 SMALL
    b = 0;
    players[x].status = "FOLD";
  } else if (b == n) {
    // CALL
    players[x].status = "CALL";
  } else if (b > n) {
    if (b - n < current_min_raise) {
      // RAISE 2 SMALL
      b = n;
      players[x].status = "CALL";
    } else {
      players[x].status = ""; // RAISE
    }
  }

  var bet_successful = the_bet_function(x, b);
  if (bet_successful == 0) {
    players[x].status = "FOLD";
    the_bet_function(x, 0);
  }

  // Always update pot display after bot action
  var current_pot_size = get_pot_size();
  gui_write_basic_general(current_pot_size);

  // Mark bot as having acted this round
  if (players_acted_this_round) {
    players_acted_this_round[x] = true;
    console.log("Bot player", x, "marked as acted");
  }

  // Community card animations are now handled when cards are actually revealed, not on every action

  write_player(current_bettor_index, 0, 0);
  current_bettor_index = get_next_player_position(current_bettor_index, 1);
  main();
}

function write_player(n, hilite, show_cards) {
  var carda = "";
  var cardb = "";
  var name_background_color = "";
  var name_font_color = "";
  if (hilite == 1) {
    // Current
    name_background_color = BG_HILITE;
    name_font_color = "black";
  } else if (hilite == 2) {
    // Winner
    name_background_color = "red";
  }
  if (players[n].status == "FOLD") {
    name_font_color = "black";
    name_background_color = "gray";
  }
  if (players[n].status == "BUST") {
    name_font_color = "white";
    name_background_color = "black";
  }
  gui_hilite_player(name_background_color, name_font_color, n);

  var show_folded = false;
  // If the human is out of the game
  if (players[0].status == "BUST" || players[0].status == "FOLD") {
    show_cards = 1;
  }
  if (players[n].carda) {
    if (players[n].status == "FOLD") {
      carda = "";
      show_folded = true;
    } else {
      carda = "blinded";
    }
    if (n == 0 || (show_cards && players[n].status != "FOLD")) {
      carda = players[n].carda;
    }
  }
  if (players[n].cardb) {
    if (players[n].status == "FOLD") {
      cardb = "";
      show_folded = true;
    } else {
      cardb = "blinded";
    }
    if (n == 0 || (show_cards && players[n].status != "FOLD")) {
      cardb = players[n].cardb;
    }
  }
  if (n == button_index) {
    gui_place_dealer_button(n);
  }
  var bet_text = "TO BE OVERWRITTEN";
  var allin = "Bet:";

  if (players[n].status == "FOLD") {
    bet_text =
      "FOLDED (" + (players[n].subtotal_bet + players[n].total_bet) + ")";
    if (n == 0) {
      HUMAN_GOES_ALL_IN = 0;
    }
  } else if (players[n].status == "BUST") {
    bet_text = "BUSTED";
    if (n == 0) {
      HUMAN_GOES_ALL_IN = 0;
    }
  } else if (!has_money(n)) {
    bet_text =
      "ALL IN (" + (players[n].subtotal_bet + players[n].total_bet) + ")";
    if (n == 0) {
      HUMAN_GOES_ALL_IN = 1;
    }
  } else {
    bet_text =
      allin +
      "$" +
      players[n].subtotal_bet +
      " (" +
      (players[n].subtotal_bet + players[n].total_bet) +
      ")";
  }

  gui_set_player_name(players[n].name, n); // offset 1 on seat-index
  gui_set_bet(bet_text, n);
  gui_set_bankroll(players[n].bankroll, n);
  gui_set_player_cards(carda, cardb, n, show_folded);
}

function make_readable_rank(r) {
  if (r < 11) {
    return r;
  } else if (r == 11) {
    return "J";
  } else if (r == 12) {
    return "Q";
  } else if (r == 13) {
    return "K";
  } else if (r == 14) {
    return "A";
  }
}

function get_pot_size() {
  var p = 0;
  for (var i = 0; i < players.length; i++) {
    p += players[i].total_bet + players[i].subtotal_bet;
  }
  return p;
}

function get_pot_size_html() {
  return "<font size=+4><b>TOTAL POT: " + get_pot_size() + "</b></font>";
}

function clear_bets() {
  for (var i = 0; i < players.length; i++) {
    players[i].subtotal_bet = 0;
  }
  current_bet_amount = 0;
}

function clear_pot() {
  for (var i = 0; i < players.length; i++) {
    players[i].total_bet = 0;
  }
}

function reset_player_statuses(type) {
  for (var i = 0; i < players.length; i++) {
    if (type == 0) {
      players[i].status = "";
    } else if (type == 1 && players[i].status != "BUST") {
      players[i].status = "";
    } else if (
      type == 2 &&
      players[i].status != "FOLD" &&
      players[i].status != "BUST"
    ) {
      players[i].status = "";
    }
  }
}

function get_num_betting() {
  var n = 0;
  for (var i = 0; i < players.length; i++) {
    if (
      players[i].status != "FOLD" &&
      players[i].status != "BUST" &&
      has_money(i)
    ) {
      n++;
    }
  }
  return n;
}

function change_name() {
  var name = prompt("What is your name?", getLocalStorage("playername"));
  if (!name) {
    return;
  }
  if (!players) {
    my_pseudo_alert("Too early to get a name");
    return;
  }
  if (name.length > 14) {
    my_pseudo_alert("Too long, I will call you Sue");
    name = "Sue";
  }
  players[0].name = name;
  write_player(0, 0, 0);
  setLocalStorage("playername", name);
}

function help_func() {
  var win = window.open("help.html", "_blank");
  win.focus();
}

function update_func() {
  var url = "https://sourceforge.net/projects/js-css-poker/files/";
  var win = window.open(url, "_blank");
  win.focus();
}

function write_settings_frame() {
  var default_speed = 2;
  var speed_i = getLocalStorage("gamespeed");
  if (speed_i == "") {
    speed_i = default_speed;
  }
  if (
    speed_i == null ||
    (speed_i != 0 &&
      speed_i != 1 &&
      speed_i != 2 &&
      speed_i != 3 &&
      speed_i != 4)
  ) {
    speed_i = default_speed;
  }
  set_speed(speed_i);
  gui_setup_option_buttons(
    change_name,
    set_raw_speed,
    help_func,
    update_func,
    gui_toggle_the_theme_mode
  );
}

function index2speed(index) {
  var speeds = ["2", "1", ".6", ".3", "0.01"];
  return speeds[index];
}

function set_speed(index) {
  global_speed = index2speed(index);
  setLocalStorage("gamespeed", index);
  gui_set_selected_speed_option(index);
}

function set_raw_speed(selector_index) {
  // check that selector_index = [1,5]
  if (selector_index < 1 || selector_index > 5) {
    my_pseudo_alert("Cannot set speed to " + selector_index);
    selector_index = 3;
  }
  var index = selector_index - 1;
  set_speed(index);
}

function get_next_player_position(i, delta) {
  var j = 0;
  var step = 1;
  if (delta < 0) step = -1;

  var loop_on = 0;
  do {
    i += step;
    if (i >= players.length) {
      i = 0;
    } else {
      if (i < 0) {
        i = players.length - 1;
      }
    }

    // Check if we can stop
    loop_on = 0;
    if (players[i].status == "BUST") loop_on = 1;
    if (players[i].status == "FOLD") loop_on = 1;
    if (++j < delta) loop_on = 1;
  } while (loop_on);

  return i;
}

function getLocalStorage(key) {
  return localStorage.getItem(key);
}

function setLocalStorage(key, value) {
  return localStorage.setItem(key, value);
}

function has_money(i) {
  if (players[i].bankroll >= 0.01) {
    return true;
  }
  return false;
}

function compRan() {
  return 0.5 - Math.random();
}

function my_local_subtime(invalue, fractionizer) {
  var quotient = 0;
  var remainder = invalue;
  if (invalue > fractionizer) {
    quotient = Math.floor(invalue / fractionizer);
    remainder = invalue - quotient * fractionizer;
  }
  return [quotient, remainder];
}

function getTimeText(string, number, text) {
  if (number == 0) return string;
  if (string.length > 0) {
    string += " ";
  }
  if (number == 1) {
    string = string + "1 " + text;
  } else {
    string = string + number + " " + text + "s";
  }
  return string;
}

function makeTimeString(milliseconds) {
  var _MS_PER_SECOND = 1000;
  var _MS_PER_MINUTE = 1000 * 60;
  var _MS_PER_HOUR = _MS_PER_MINUTE * 60;
  var _MS_PER_DAY = 1000 * 60 * 60 * 24;
  var _MS_PER_WEEK = _MS_PER_DAY * 7;
  var weeks = 0;
  var days = 0;
  var hours = 0;
  var minutes = 0;
  var seconds = 0;
  [weeks, milliseconds] = my_local_subtime(milliseconds, _MS_PER_WEEK);
  [days, milliseconds] = my_local_subtime(milliseconds, _MS_PER_DAY);
  [hours, milliseconds] = my_local_subtime(milliseconds, _MS_PER_HOUR);
  [minutes, milliseconds] = my_local_subtime(milliseconds, _MS_PER_MINUTE);
  [seconds, milliseconds] = my_local_subtime(milliseconds, _MS_PER_SECOND);

  var string = "";
  string = getTimeText(string, weeks, "week");
  string = getTimeText(string, days, "day");
  string = getTimeText(string, hours, "hour");
  string = getTimeText(string, minutes, "minute");
  string = getTimeText(string, seconds, "second");

  return string;
}

// Multiplayer functions
function initializeMultiplayerUI() {
  // Setup multiplayer button event handlers
  const joinRoomBtn = document.getElementById("join-room-button");
  const createRoomBtn = document.getElementById("create-room-button");
  const startGameBtn = document.getElementById("start-game-button");
  const roomCodeDisplay = document.getElementById("room-code-display");
  const enterNameBtn = document.getElementById("enter-name-button");

  // Initially hide the start game button (will be shown when 2+ players join)
  if (startGameBtn) {
    startGameBtn.classList.remove("show");
  }

  if (joinRoomBtn) {
    joinRoomBtn.onclick = function () {
      const playerName = prompt(
        "Enter your name:",
        getLocalStorage("playername") || ""
      );
      if (!playerName) {
        gui_write_game_response("Player name is required to join a room");
        gui_set_game_response_font_color("red");
        return;
      }

      // Save the name for future use
      setLocalStorage("playername", playerName);

      const roomId = prompt("Enter room code:");
      if (roomId) {
        joinPokerRoom(roomId, playerName);
      }
    };
  }

  if (createRoomBtn) {
    createRoomBtn.onclick = function () {
      showCreateRoomModal();
    };
  }

  if (enterNameBtn) {
    enterNameBtn.onclick = function () {
      showNameInputScreen();
    };
  }

  if (startGameBtn) {
    startGameBtn.onclick = function () {
      startMultiplayerGame();
    };
  }

  if (roomCodeDisplay) {
    roomCodeDisplay.onclick = function () {
      const roomCode = getRoomCode();
      if (roomCode) {
        navigator.clipboard.writeText(roomCode).then(() => {
          gui_write_game_response("Room code copied to clipboard!");
          gui_set_game_response_font_color("green");
        });
      }
    };
  }

  // Initialize WebSocket connection
  initializeMultiplayer();

  // Add single player button functionality
  const singleplayerBtn = document.getElementById("singleplayer-button");
  if (singleplayerBtn) {
    singleplayerBtn.onclick = function () {
      new_game_singleplayer();
    };
  }

  // Setup name input screen handlers
  setupNameInputHandlers();
}

// Name input screen functions
function showNameInputScreen() {
  const nameInputScreen = document.getElementById("name-input-screen");
  const playerNameInput = document.getElementById("player-name-input");

  if (nameInputScreen) {
    // Pre-fill with existing name if available
    const existingName = getLocalStorage("playername");
    if (existingName && playerNameInput) {
      playerNameInput.value = existingName;
    }

    nameInputScreen.style.display = "flex";

    // Focus on input
    if (playerNameInput) {
      setTimeout(() => playerNameInput.focus(), 300);
    }
  }
}

function hideNameInputScreen() {
  const nameInputScreen = document.getElementById("name-input-screen");
  if (nameInputScreen) {
    nameInputScreen.style.display = "none";
  }
}

function setupNameInputHandlers() {
  const continueBtn = document.getElementById("continue-to-stakes");
  const joinRoomBtn = document.getElementById("join-room-from-name");
  const playerNameInput = document.getElementById("player-name-input");

  if (continueBtn) {
    continueBtn.onclick = function () {
      const playerName = playerNameInput ? playerNameInput.value.trim() : "";

      if (!playerName) {
        alert("Please enter your name to continue.");
        if (playerNameInput) playerNameInput.focus();
        return;
      }

      if (playerName.length > 20) {
        alert("Name is too long. Please use 20 characters or less.");
        if (playerNameInput) playerNameInput.focus();
        return;
      }

      // Save the player name
      setLocalStorage("playername", playerName);

      // Hide name input screen
      hideNameInputScreen();

      // Navigate to stake selection
      navigateToStakeSelection(playerName);
    };
  }

  if (joinRoomBtn) {
    joinRoomBtn.onclick = function () {
      const playerName = playerNameInput ? playerNameInput.value.trim() : "";

      if (!playerName) {
        alert("Please enter your name first.");
        if (playerNameInput) playerNameInput.focus();
        return;
      }

      if (playerName.length > 20) {
        alert("Name is too long. Please use 20 characters or less.");
        if (playerNameInput) playerNameInput.focus();
        return;
      }

      // Save the player name
      setLocalStorage("playername", playerName);

      // Prompt for room ID
      const roomId = prompt("Enter Room ID:");
      if (roomId && roomId.trim()) {
        // Hide name input screen
        hideNameInputScreen();

        // Join the room
        joinPokerRoom(roomId.trim(), playerName);
      }
    };
  }

  if (playerNameInput) {
    // Handle Enter key
    playerNameInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (continueBtn) continueBtn.click();
      }
    });

    // Update button state based on input
    playerNameInput.addEventListener("input", function () {
      const name = this.value.trim();
      if (continueBtn) {
        continueBtn.disabled = !name;
        continueBtn.style.opacity = name ? "1" : "0.5";
      }
      if (joinRoomBtn) {
        joinRoomBtn.disabled = !name;
        joinRoomBtn.style.opacity = name ? "1" : "0.5";
      }
    });
  }
}

function navigateToStakeSelection(playerName) {
  // Hide name input screen
  hideNameInputScreen();

  // Show stake selection screen
  showStakeSelectionScreen(playerName);
}

function showStakeSelectionScreen(playerName) {
  const stakeSelectionScreen = document.getElementById(
    "stake-selection-screen"
  );

  if (stakeSelectionScreen) {
    // Set player name in the stake selection system
    if (
      typeof window.stakeSelection !== "undefined" &&
      window.stakeSelection.setPlayerName
    ) {
      window.stakeSelection.setPlayerName(playerName);
    }

    stakeSelectionScreen.style.display = "flex";

    // Initialize stake selection if it hasn't been initialized yet
    setTimeout(() => {
      if (typeof initializeStakeSelection === "function") {
        initializeStakeSelection();
      }
    }, 100);
  }
}

function hideStakeSelectionScreen() {
  const stakeSelectionScreen = document.getElementById(
    "stake-selection-screen"
  );
  if (stakeSelectionScreen) {
    stakeSelectionScreen.style.display = "none";
  }
}

// Function to create room with stake settings (called from stake selection)
function createRoomWithStakeSettings(playerName, stakeSettings) {
  console.log("createRoomWithStakeSettings called with:", {
    playerName,
    stakeSettings,
  });
  console.log(
    "wsClient status:",
    wsClient ? "exists" : "null",
    wsClient ? (wsClient.isConnected ? "connected" : "not connected") : ""
  );

  // Set up a one-time listener for successful room creation
  const setupRoomCreationListener = () => {
    if (wsClient && wsClient.handleMessage) {
      const originalHandler = wsClient.handleMessage.bind(wsClient);
      wsClient.handleMessage = function (message) {
        // Call the original handler first
        originalHandler(message);

        // Check if room was successfully created
        if (message.type === "joined_room" && message.success) {
          console.log("Room created successfully from poker.js");

          // Hide stake selection if it's visible
          if (typeof hideStakeSelectionScreen === "function") {
            hideStakeSelectionScreen();
          }

          // Hide loading state if available
          if (
            typeof window.stakeSelection !== "undefined" &&
            window.stakeSelection.hideLoadingState
          ) {
            window.stakeSelection.hideLoadingState();
          }

          // Restore original handler
          wsClient.handleMessage = originalHandler;
        }
      };
    }
  };

  // Use the websocket client to create room with stake settings
  if (wsClient && wsClient.isConnected) {
    console.log("Creating room with stake settings...");
    setupRoomCreationListener();
    wsClient.createRoomWithSettings(playerName, {
      startingChips: stakeSettings.startingChips,
      minCall: stakeSettings.minCall,
      maxCall: stakeSettings.maxCall,
      stakeLevel: stakeSettings.stakes,
    });
  } else {
    // Initialize WebSocket client if not available
    if (!wsClient) {
      console.log("Initializing WebSocket client...");
      gui_write_game_response("Connecting to server...");
      gui_set_game_response_font_color("orange");

      initializeMultiplayer();

      // Wait for connection before creating room
      setTimeout(() => {
        if (wsClient && wsClient.isConnected) {
          console.log("Connection established, creating room...");
          setupRoomCreationListener();
          wsClient.createRoomWithSettings(playerName, {
            startingChips: stakeSettings.startingChips,
            minCall: stakeSettings.minCall,
            maxCall: stakeSettings.maxCall,
            stakeLevel: stakeSettings.stakes,
          });
        } else {
          console.log("Connection failed");
          gui_write_game_response(
            "Failed to connect to server. Please refresh the page."
          );
          gui_set_game_response_font_color("red");

          // Hide loading state on failure
          if (
            typeof window.stakeSelection !== "undefined" &&
            window.stakeSelection.hideLoadingState
          ) {
            window.stakeSelection.hideLoadingState();
          }
        }
      }, 2000);
    } else {
      console.log("WebSocket exists but not connected, waiting...");
      gui_write_game_response("Connecting to server...");
      gui_set_game_response_font_color("orange");

      // Wait for existing connection to establish
      setTimeout(() => {
        if (wsClient && wsClient.isConnected) {
          console.log("Connection established, creating room...");
          setupRoomCreationListener();
          wsClient.createRoomWithSettings(playerName, {
            startingChips: stakeSettings.startingChips,
            minCall: stakeSettings.minCall,
            maxCall: stakeSettings.maxCall,
            stakeLevel: stakeSettings.stakes,
          });
        } else {
          console.log("Connection timeout");
          gui_write_game_response("Connection timeout. Please try again.");
          gui_set_game_response_font_color("red");

          // Hide loading state on timeout
          if (
            typeof window.stakeSelection !== "undefined" &&
            window.stakeSelection.hideLoadingState
          ) {
            window.stakeSelection.hideLoadingState();
          }
        }
      }, 2000);
    }
  }
}

// Make the function globally available for stake selection page
if (typeof window !== "undefined") {
  window.createRoomWithStakeSettings = createRoomWithStakeSettings;
}

function showMultiplayerOptions() {
  gui_write_basic_general_text("");
  gui_write_game_response(
    "Welcome to Multiplayer Poker! Create or join a room to start playing."
  );
  gui_set_game_response_font_color("blue");
}

function updateRoomCodeDisplay(roomCode) {
  const roomCodeDisplay = document.getElementById("room-code-display");
  if (roomCodeDisplay && roomCode) {
    roomCodeDisplay.textContent = `Room: ${roomCode}`;
    roomCodeDisplay.style.visibility = "visible";
  }
}

// Override the original new_game function for single-player mode
function new_game_singleplayer() {
  console.log("Starting single player game...");

  // Clear any existing game state
  gui_hide_fold_call_click();
  gui_hide_bet_range();
  gui_write_modal_box("");

  // Enable bet visibility for single player mode
  const pokerTable = document.getElementById("poker_table");
  if (pokerTable) {
    pokerTable.classList.add("game-active");
  }

  START_DATE = new Date();
  NUM_ROUNDS = 0;
  HUMAN_WINS_AGAIN = 0;

  // Reset global variables
  players = null;
  board = null;
  deck_index = 0;

  console.log("Calling initialize_game...");
  initialize_game();

  console.log("Calling ask_how_many_opponents...");
  ask_how_many_opponents();
}

// Room creation modal functions
function showCreateRoomModal() {
  const modal = document.getElementById("create-room-modal");
  const nameInput = document.getElementById("room-creator-name");
  const startingChipsInput = document.getElementById("starting-chips");
  const minCallInput = document.getElementById("min-call");
  const maxCallInput = document.getElementById("max-call");
  const closeBtn = modal.querySelector(".close");
  const form = document.getElementById("room-settings-form");
  const cancelBtn = document.getElementById("create-room-cancel");

  // Pre-fill name if available
  nameInput.value = getLocalStorage("playername") || "";

  // Show modal
  modal.style.display = "block";

  // Handle form submission
  form.onsubmit = function (e) {
    e.preventDefault();

    const playerName = nameInput.value.trim();
    const startingChips = parseInt(startingChipsInput.value);
    const minCall = parseInt(minCallInput.value);
    const maxCall = parseInt(maxCallInput.value);

    // Validation
    if (!playerName) {
      alert("Player name is required");
      return;
    }

    if (minCall >= maxCall) {
      alert("Maximum call must be greater than minimum call");
      return;
    }

    if (startingChips < minCall * 10) {
      alert("Starting chips should be at least 10 times the minimum call");
      return;
    }

    // Save the name for future use
    setLocalStorage("playername", playerName);

    // Create room with settings
    createRoomWithSettings(playerName, startingChips, minCall, maxCall);

    // Hide modal
    modal.style.display = "none";
  };

  // Handle close button
  closeBtn.onclick = function () {
    modal.style.display = "none";
  };

  // Handle cancel button
  cancelBtn.onclick = function () {
    modal.style.display = "none";
  };

  // Handle click outside modal
  window.onclick = function (event) {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  };
}

function createRoomWithSettings(playerName, startingChips, minCall, maxCall) {
  console.log("createRoomWithSettings called with:", {
    playerName,
    startingChips,
    minCall,
    maxCall,
  });
  console.log(
    "wsClient status:",
    wsClient ? "exists" : "null",
    wsClient ? (wsClient.isConnected ? "connected" : "not connected") : ""
  );

  // Use the websocket client to create room with custom settings
  if (wsClient && wsClient.isConnected) {
    console.log("Creating room with settings...");
    wsClient.createRoomWithSettings(playerName, {
      startingChips: startingChips,
      minCall: minCall,
      maxCall: maxCall,
    });
  } else {
    // Initialize WebSocket client if not available
    if (!wsClient) {
      console.log("Initializing WebSocket client...");
      gui_write_game_response("Connecting to server...");
      gui_set_game_response_font_color("orange");

      initializeMultiplayer();

      // Wait for connection before creating room
      setTimeout(() => {
        if (wsClient && wsClient.isConnected) {
          console.log("Connection established, creating room...");
          wsClient.createRoomWithSettings(playerName, {
            startingChips: startingChips,
            minCall: minCall,
            maxCall: maxCall,
          });
        } else {
          console.log("Connection failed");
          gui_write_game_response(
            "Failed to connect to server. Please refresh the page."
          );
          gui_set_game_response_font_color("red");
        }
      }, 2000); // Increased timeout to 2 seconds
    } else {
      console.log("WebSocket exists but not connected, waiting...");
      gui_write_game_response("Connecting to server...");
      gui_set_game_response_font_color("orange");

      // Wait for existing connection to establish
      setTimeout(() => {
        if (wsClient && wsClient.isConnected) {
          console.log("Connection established, creating room...");
          wsClient.createRoomWithSettings(playerName, {
            startingChips: startingChips,
            minCall: minCall,
            maxCall: maxCall,
          });
        } else {
          console.log("Connection timeout");
          gui_write_game_response("Connection timeout. Please try again.");
          gui_set_game_response_font_color("red");
        }
      }, 2000);
    }
  }
}

// Function to start action timeout for human player
function startPlayerActionTimeout() {
  clearPlayerActionTimeout(); // Clear any existing timeout

  console.log("Starting 10-second action timeout for human player");

  // Start visual countdown timer
  if (typeof gui_start_action_timer === "function") {
    gui_start_action_timer(ACTION_TIMEOUT_DURATION / 1000);
  }

  playerActionTimeout = setTimeout(function () {
    console.log("Player action timeout - automatically folding");

    // Show timeout message
    gui_log_to_history("You timed out and folded automatically");

    // Show timeout toast if available
    if (typeof showPlayerTimeoutToast === "function") {
      showPlayerTimeoutToast("You");
    }

    // Handle timeout with visual feedback
    handlePlayerTimeout();

    // Automatically fold the player
    human_fold();
  }, ACTION_TIMEOUT_DURATION);
}

// Function to clear action timeout
function clearPlayerActionTimeout() {
  if (playerActionTimeout) {
    clearTimeout(playerActionTimeout);
    playerActionTimeout = null;
    console.log("Cleared player action timeout");
  }

  // Clear visual timer
  if (typeof gui_clear_action_timer === "function") {
    gui_clear_action_timer();
  }
}

// Function to handle timeout with visual feedback
function handlePlayerTimeout() {
  gui_log_to_history("⏰ Time's up! You were automatically folded.");

  // Add visual feedback
  var gameResponse = document.getElementById("game-response");
  if (gameResponse) {
    gameResponse.style.backgroundColor = "rgba(255, 0, 0, 0.2)";
    gameResponse.style.border = "2px solid red";
    setTimeout(function () {
      gameResponse.style.backgroundColor = "";
      gameResponse.style.border = "";
    }, 3000);
  }
}
