"use strict";

// Hand evaluation system ported from hands.js for server-side use
class HandEvaluator {
  constructor() {
    this.tests = [
      "straight_flush",
      "four_of_a_kind",
      "full_house",
      "flush",
      "straight",
      "three_of_a_kind",
      "two_pair",
      "one_pair",
      "hi_card",
    ];
  }

  // Main function to determine winners
  getWinners(players, communityCards) {
    for (let i = 0; i < this.tests.length; i++) {
      const winners = this.winnersHelper(
        players,
        communityCards,
        this.tests[i]
      );
      if (winners) {
        return {
          winners: winners,
          handType: this.tests[i]
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
        };
      }
    }
    return null;
  }

  winnersHelper(players, communityCards, test) {
    let best;
    let winners = new Array(players.length);

    for (let i = 0; i < players.length; i++) {
      if (!players[i]) {
        // Folded player
        continue;
      }

      const playerForEval = {
        carda: players[i].cards[0],
        cardb: players[i].cards[1],
      };

      const handResult = this.executeTest(
        "test_" + test,
        playerForEval,
        communityCards
      );
      const numNeeded = handResult.num_needed;

      if (numNeeded > 0 || (numNeeded == 0 && numNeeded != "0")) {
        continue;
      }

      if (typeof best === "undefined") {
        best = handResult;
        winners = new Array(players.length);
        winners[i] = handResult;
      } else {
        const comp = this.executeCompare("compare_" + test, handResult, best);
        if (comp == "a") {
          // handResult won
          best = handResult;
          winners = new Array(players.length);
          winners[i] = handResult;
        } else if (comp == "b") {
          // best is still best
          // do nothing
        } else if (comp == "c") {
          // tie, add as winner
          winners[i] = handResult;
        }
      }
    }

    // Check if we have any winners
    for (let i = 0; i < winners.length; i++) {
      if (winners[i]) {
        return winners;
      }
    }
    return null;
  }

  executeTest(testName, player, communityCards) {
    switch (testName) {
      case "test_straight_flush":
        return this.testStraightFlush(player, communityCards);
      case "test_four_of_a_kind":
        return this.testFourOfAKind(player, communityCards);
      case "test_full_house":
        return this.testFullHouse(player, communityCards);
      case "test_flush":
        return this.testFlush(player, communityCards);
      case "test_straight":
        return this.testStraight(player, communityCards);
      case "test_three_of_a_kind":
        return this.testThreeOfAKind(player, communityCards);
      case "test_two_pair":
        return this.testTwoPair(player, communityCards);
      case "test_one_pair":
        return this.testOnePair(player, communityCards);
      case "test_hi_card":
        return this.testHiCard(player, communityCards);
      default:
        throw new Error("Unknown test: " + testName);
    }
  }

  executeCompare(compareName, a, b) {
    switch (compareName) {
      case "compare_straight_flush":
        return this.compareStraight(a, b);
      case "compare_four_of_a_kind":
        return this.compareFourOfAKind(a, b);
      case "compare_full_house":
        return this.compareFullHouse(a, b);
      case "compare_flush":
        return this.compareFlush(a, b);
      case "compare_straight":
        return this.compareStraight(a, b);
      case "compare_three_of_a_kind":
        return this.compareThreeOfAKind(a, b);
      case "compare_two_pair":
        return this.compareTwoPair(a, b);
      case "compare_one_pair":
        return this.compareOnePair(a, b);
      case "compare_hi_card":
        return this.compareHiCard(a, b);
      default:
        throw new Error("Unknown compare: " + compareName);
    }
  }

  // Utility functions
  getSuit(card) {
    if (card) {
      return card.substring(0, 1);
    }
    return "";
  }

  getRank(card) {
    if (card) {
      return parseInt(card.substring(1));
    }
    return 0;
  }

  groupCards(player, communityCards) {
    const cards = [...communityCards];
    cards.push(player.carda);
    cards.push(player.cardb);
    return cards.filter((card) => card); // Remove empty slots
  }

  getPredominantSuit(cards) {
    const suitCount = { c: 0, s: 0, h: 0, d: 0 };

    for (let card of cards) {
      const suit = this.getSuit(card);
      if (suitCount[suit] !== undefined) {
        suitCount[suit]++;
      }
    }

    let maxSuit = "c";
    let maxCount = suitCount[maxSuit];

    for (let suit in suitCount) {
      if (suitCount[suit] > maxCount) {
        maxCount = suitCount[suit];
        maxSuit = suit;
      }
    }

    return maxSuit;
  }

  compNum(a, b) {
    return b - a;
  }

  // Hand testing functions
  testStraightFlush(player, communityCards) {
    const cards = this.groupCards(player, communityCards);
    const predominantSuit = this.getPredominantSuit(cards);
    const workingCards = [];

    for (let card of cards) {
      if (this.getSuit(card) === predominantSuit) {
        const rank = this.getRank(card);
        workingCards.push(rank);
        if (rank === 14) {
          workingCards.push(1); // Ace low
        }
      }
    }

    workingCards.sort(this.compNum);

    let longestStretch = 0;
    let hiCard = 0;
    let currentStretch = 1;
    let currentHi = 0;

    for (let i = 0; i < workingCards.length - 1; i++) {
      if (workingCards[i] - workingCards[i + 1] === 1) {
        currentStretch++;
        if (currentHi === 0) currentHi = workingCards[i];
      } else {
        if (currentStretch > longestStretch) {
          longestStretch = currentStretch;
          hiCard = currentHi || workingCards[i];
        }
        currentStretch = 1;
        currentHi = 0;
      }
    }

    if (currentStretch > longestStretch) {
      longestStretch = currentStretch;
      hiCard = currentHi || workingCards[workingCards.length - 1];
    }

    let numMine = 0;
    for (let i = 0; i < longestStretch; i++) {
      const checkCard = predominantSuit + (hiCard - i);
      if (checkCard === player.carda || checkCard === player.cardb) {
        numMine++;
      }
    }

    return {
      straight_hi: hiCard,
      num_needed: 5 - longestStretch,
      num_mine: numMine,
      hand_name: "Straight Flush",
    };
  }

  testFourOfAKind(player, communityCards) {
    const cards = this.groupCards(player, communityCards);
    const ranks = new Array(13).fill(0);

    for (let card of cards) {
      const rank = this.getRank(card);
      if (rank >= 2 && rank <= 14) {
        ranks[rank - 2]++;
      }
    }

    let fourRank = 0;
    let kicker = 0;

    for (let i = 0; i < 13; i++) {
      if (ranks[i] === 4) {
        fourRank = i + 2;
      } else if (ranks[i] > 0) {
        kicker = i + 2;
      }
    }

    let numMine = 0;
    if (this.getRank(player.carda) === fourRank) numMine++;
    if (this.getRank(player.cardb) === fourRank) numMine++;

    return {
      rank: fourRank,
      kicker: kicker,
      num_needed: fourRank ? 0 : 3,
      num_mine: numMine,
      hand_name: "Four of a Kind",
    };
  }

  testFullHouse(player, communityCards) {
    const cards = this.groupCards(player, communityCards);
    const ranks = new Array(13).fill(0);

    for (let card of cards) {
      const rank = this.getRank(card);
      if (rank >= 2 && rank <= 14) {
        ranks[rank - 2]++;
      }
    }

    let threeRank = 0;
    let pairRank = 0;

    // Find three of a kind and pair
    for (let i = 12; i >= 0; i--) {
      if (ranks[i] >= 3 && !threeRank) {
        threeRank = i + 2;
      } else if (ranks[i] >= 2 && !pairRank) {
        pairRank = i + 2;
      }
    }

    let numMine = 0;
    const playerRankA = this.getRank(player.carda);
    const playerRankB = this.getRank(player.cardb);

    if (playerRankA === threeRank || playerRankA === pairRank) numMine++;
    if (playerRankB === threeRank || playerRankB === pairRank) numMine++;

    const hasFullHouse = threeRank && pairRank;

    return {
      rank_1: threeRank,
      rank_2: pairRank,
      num_needed: hasFullHouse ? 0 : 1,
      num_mine: numMine,
      hand_name: "Full House",
    };
  }

  testFlush(player, communityCards) {
    const cards = this.groupCards(player, communityCards);
    const suitCounts = { c: [], s: [], h: [], d: [] };

    for (let card of cards) {
      const suit = this.getSuit(card);
      const rank = this.getRank(card);
      if (suitCounts[suit]) {
        suitCounts[suit].push(rank);
      }
    }

    let flushSuit = "";
    let flushCards = [];

    for (let suit in suitCounts) {
      if (suitCounts[suit].length >= 5) {
        flushSuit = suit;
        flushCards = suitCounts[suit].sort(this.compNum);
        break;
      }
    }

    let numMine = 0;
    if (flushCards.length >= 5) {
      if (this.getSuit(player.carda) === flushSuit) numMine++;
      if (this.getSuit(player.cardb) === flushSuit) numMine++;
    }

    return {
      hi_card_0: flushCards[0] || 0,
      hi_card_1: flushCards[1] || 0,
      hi_card_2: flushCards[2] || 0,
      hi_card_3: flushCards[3] || 0,
      hi_card_4: flushCards[4] || 0,
      num_needed: Math.max(0, 5 - flushCards.length),
      num_mine: numMine,
      hand_name: "Flush",
    };
  }

  testStraight(player, communityCards) {
    const cards = this.groupCards(player, communityCards);
    const ranks = new Set();

    for (let card of cards) {
      const rank = this.getRank(card);
      ranks.add(rank);
      if (rank === 14) {
        ranks.add(1); // Ace low
      }
    }

    const sortedRanks = Array.from(ranks).sort(this.compNum);

    let longestStretch = 1;
    let hiCard = 0;
    let currentStretch = 1;
    let currentHi = sortedRanks[0];

    for (let i = 1; i < sortedRanks.length; i++) {
      if (sortedRanks[i - 1] - sortedRanks[i] === 1) {
        currentStretch++;
      } else {
        if (currentStretch > longestStretch) {
          longestStretch = currentStretch;
          hiCard = currentHi;
        }
        currentStretch = 1;
        currentHi = sortedRanks[i];
      }
    }

    if (currentStretch > longestStretch) {
      longestStretch = currentStretch;
      hiCard = currentHi;
    }

    let numMine = 0;
    const playerRankA = this.getRank(player.carda);
    const playerRankB = this.getRank(player.cardb);

    for (let i = 0; i < longestStretch; i++) {
      const checkRank = hiCard - i;
      if (checkRank === playerRankA || checkRank === playerRankB) {
        numMine++;
      }
    }

    return {
      straight_hi: hiCard,
      num_needed: Math.max(0, 5 - longestStretch),
      num_mine: numMine,
      hand_name: "Straight",
    };
  }

  testThreeOfAKind(player, communityCards) {
    const cards = this.groupCards(player, communityCards);
    const ranks = new Array(13).fill(0);

    for (let card of cards) {
      const rank = this.getRank(card);
      if (rank >= 2 && rank <= 14) {
        ranks[rank - 2]++;
      }
    }

    let threeRank = 0;
    let kicker1 = 0;
    let kicker2 = 0;

    for (let i = 12; i >= 0; i--) {
      if (ranks[i] >= 3 && !threeRank) {
        threeRank = i + 2;
      } else if (ranks[i] > 0) {
        if (!kicker1) {
          kicker1 = i + 2;
        } else if (!kicker2) {
          kicker2 = i + 2;
        }
      }
    }

    let numMine = 0;
    if (this.getRank(player.carda) === threeRank) numMine++;
    if (this.getRank(player.cardb) === threeRank) numMine++;

    return {
      rank: threeRank,
      kicker_1: kicker1,
      kicker_2: kicker2,
      num_needed: threeRank ? 0 : 2,
      num_mine: numMine,
      hand_name: "Three of a Kind",
    };
  }

  testTwoPair(player, communityCards) {
    const cards = this.groupCards(player, communityCards);
    const ranks = new Array(13).fill(0);

    for (let card of cards) {
      const rank = this.getRank(card);
      if (rank >= 2 && rank <= 14) {
        ranks[rank - 2]++;
      }
    }

    let pair1 = 0;
    let pair2 = 0;
    let kicker = 0;

    for (let i = 12; i >= 0; i--) {
      if (ranks[i] >= 2) {
        if (!pair1) {
          pair1 = i + 2;
        } else if (!pair2) {
          pair2 = i + 2;
        }
      } else if (ranks[i] === 1 && !kicker) {
        kicker = i + 2;
      }
    }

    let numMine = 0;
    const playerRankA = this.getRank(player.carda);
    const playerRankB = this.getRank(player.cardb);

    if (playerRankA === pair1 || playerRankA === pair2) numMine++;
    if (playerRankB === pair1 || playerRankB === pair2) numMine++;

    const hasTwoPair = pair1 && pair2;

    return {
      rank_1: pair1,
      rank_2: pair2,
      kicker: kicker,
      num_needed: hasTwoPair ? 0 : 1,
      num_mine: numMine,
      hand_name: "Two Pair",
    };
  }

  testOnePair(player, communityCards) {
    const cards = this.groupCards(player, communityCards);
    const ranks = new Array(13).fill(0);

    for (let card of cards) {
      const rank = this.getRank(card);
      if (rank >= 2 && rank <= 14) {
        ranks[rank - 2]++;
      }
    }

    let pairRank = 0;
    let kickers = [];

    for (let i = 12; i >= 0; i--) {
      if (ranks[i] >= 2 && !pairRank) {
        pairRank = i + 2;
      } else if (ranks[i] === 1) {
        kickers.push(i + 2);
      }
    }

    kickers = kickers.sort(this.compNum).slice(0, 3);

    let numMine = 0;
    if (this.getRank(player.carda) === pairRank) numMine++;
    if (this.getRank(player.cardb) === pairRank) numMine++;

    return {
      rank: pairRank,
      kicker_1: kickers[0] || 0,
      kicker_2: kickers[1] || 0,
      kicker_3: kickers[2] || 0,
      num_needed: pairRank ? 0 : 1,
      num_mine: numMine,
      hand_name: "One Pair",
    };
  }

  testHiCard(player, communityCards) {
    const cards = this.groupCards(player, communityCards);
    const ranks = cards.map((card) => this.getRank(card)).sort(this.compNum);

    const result = {
      num_needed: 0,
      hand_name: "High Card",
    };

    for (let i = 0; i < 5; i++) {
      result[`hi_card_${i}`] = ranks[i] || 0;
    }

    return result;
  }

  // Comparison functions
  compareFourOfAKind(a, b) {
    if (a.rank > b.rank) return "a";
    if (b.rank > a.rank) return "b";
    if (a.kicker > b.kicker) return "a";
    if (b.kicker > a.kicker) return "b";
    return "c";
  }

  compareFullHouse(a, b) {
    if (a.rank_1 > b.rank_1) return "a";
    if (b.rank_1 > a.rank_1) return "b";
    if (a.rank_2 > b.rank_2) return "a";
    if (b.rank_2 > a.rank_2) return "b";
    return "c";
  }

  compareFlush(a, b) {
    for (let i = 0; i < 5; i++) {
      const cardA = a[`hi_card_${i}`];
      const cardB = b[`hi_card_${i}`];
      if (cardA > cardB) return "a";
      if (cardB > cardA) return "b";
    }
    return "c";
  }

  compareStraight(a, b) {
    if (a.straight_hi > b.straight_hi) return "a";
    if (b.straight_hi > a.straight_hi) return "b";
    return "c";
  }

  compareThreeOfAKind(a, b) {
    if (a.rank > b.rank) return "a";
    if (b.rank > a.rank) return "b";
    if (a.kicker_1 > b.kicker_1) return "a";
    if (b.kicker_1 > a.kicker_1) return "b";
    if (a.kicker_2 > b.kicker_2) return "a";
    if (b.kicker_2 > a.kicker_2) return "b";
    return "c";
  }

  compareTwoPair(a, b) {
    if (a.rank_1 > b.rank_1) return "a";
    if (b.rank_1 > a.rank_1) return "b";
    if (a.rank_2 > b.rank_2) return "a";
    if (b.rank_2 > a.rank_2) return "b";
    if (a.kicker > b.kicker) return "a";
    if (b.kicker > a.kicker) return "b";
    return "c";
  }

  compareOnePair(a, b) {
    if (a.rank > b.rank) return "a";
    if (b.rank > a.rank) return "b";
    if (a.kicker_1 > b.kicker_1) return "a";
    if (b.kicker_1 > a.kicker_1) return "b";
    if (a.kicker_2 > b.kicker_2) return "a";
    if (b.kicker_2 > a.kicker_2) return "b";
    if (a.kicker_3 > b.kicker_3) return "a";
    if (b.kicker_3 > a.kicker_3) return "b";
    return "c";
  }

  compareHiCard(a, b) {
    for (let i = 0; i < 5; i++) {
      const cardA = a[`hi_card_${i}`];
      const cardB = b[`hi_card_${i}`];
      if (cardA > cardB) return "a";
      if (cardB > cardA) return "b";
    }
    return "c";
  }
}

module.exports = HandEvaluator;
