# Realtime Multiplayer Poker Game

A Texas Hold'em poker game implemented with HTML5, JavaScript, and WebSockets for real-time multiplayer functionality.

## Features

- **Real-time Multiplayer**: Up to 10 players per game room
- **WebSocket Communication**: Low-latency, real-time game updates
- **Full Texas Hold'em Rules**: Complete poker gameplay with blinds, betting rounds, and hand evaluation
- **Room-based Games**: Create or join game rooms with unique room codes
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Themes**: Multiple visual themes for comfortable playing

## Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- Modern web browser with WebSocket support

### Installation

1. **Clone or download this repository**

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start the server**:

   ```bash
   npm start
   ```

4. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

### Development Mode

For development with auto-restart:

```bash
npm run dev
```

## How to Play

### Creating a Game

1. **Start the server** as described above
2. **Open the game** in your browser
3. **Click "Create Room"** to create a new game room
4. **Share the room code** with other players
5. **Wait for players to join**
6. **Click "Start Game"** when ready (minimum 2 players required)

### Joining a Game

1. **Open the game** in your browser
2. **Click "Join Room"**
3. **Enter the room code** provided by the game creator
4. **Wait for the game to start**

### Gameplay

- **Betting Actions**: Fold, Call/Check, Raise
- **Betting Slider**: Use the range slider to set raise amounts
- **Real-time Updates**: See other players' actions immediately
- **Hand History**: View recent game actions in the history panel

## Game Controls

### Player Actions

- **Fold**: Give up your hand (lose any bets made)
- **Call**: Match the current bet
- **Check**: Pass when no bet is required
- **Raise**: Increase the current bet using the slider

### Interface Elements

- **Room Code Display**: Click to copy room code to clipboard
- **Player Highlighting**: Current player is highlighted
- **Card Display**: Your cards are revealed, others show card backs
- **Pot Display**: Shows current pot size
- **Dealer Button**: Indicates the dealer position

## Technical Architecture

### Server-Side (`server.js`)

- **WebSocket Server**: Handles real-time communication
- **Game Room Management**: Creates and manages multiple game rooms
- **Game State Synchronization**: Ensures all players see the same game state
- **Player Actions Processing**: Validates and processes all player actions

### Client-Side

- **WebSocket Client** (`static/js/websocket-client.js`): Handles server communication
- **Game Logic** (`static/js/jsholdem/`): Original poker game logic
- **GUI Interface** (`static/js/gui_if.js`): User interface management
- **Responsive Design**: CSS for various screen sizes

### Game Flow

1. **Connection**: Player connects to WebSocket server
2. **Room Join**: Player joins or creates a game room
3. **Game Start**: When 2+ players are ready, game begins
4. **Betting Rounds**: Preflop, Flop, Turn, River
5. **Showdown**: Hand evaluation and winner determination
6. **Next Hand**: Automatic progression to next hand

## WebSocket Message Protocol

### Client → Server Messages

```javascript
// Join a room
{
  type: 'join_room',
  roomId: 'abc123', // Optional, creates new room if not provided
  playerName: 'PlayerName'
}

// Start game (when ready)
{
  type: 'start_game'
}

// Player action
{
  type: 'player_action',
  action: {
    type: 'fold' | 'call' | 'raise',
    amount: 100 // For raise actions
  }
}
```

### Server → Client Messages

```javascript
// Room joined confirmation
{
  type: 'joined_room',
  success: true,
  roomId: 'abc123',
  playerId: 'player_xyz',
  gameState: { /* current game state */ }
}

// Game state update
{
  type: 'game_update',
  action: { /* player action */ },
  playerId: 'player_xyz',
  gameState: { /* updated game state */ }
}
```

## Configuration

### Server Configuration

You can modify these settings in `server.js`:

- **Port**: Default 3000 (set via `PORT` environment variable)
- **Max Players**: Default 10 per room
- **Starting Bankroll**: Default $500
- **Small Blind**: Default $5
- **Big Blind**: Default $10

### Game Settings

Client-side settings (stored in localStorage):

- **Player Name**: Set via "Name" button
- **Game Speed**: Adjustable animation speed
- **Theme Mode**: Light/Dark/High Contrast themes

## File Structure

```
html5_2/
├── server.js                 # WebSocket server
├── package.json             # Node.js dependencies
├── index.html              # Main game page
├── static/
│   ├── css/               # Stylesheets
│   │   ├── poker.css     # Main game styles
│   │   ├── phone.css     # Mobile responsive styles
│   │   └── ...
│   ├── images/           # Card and chip images
│   └── js/
│       ├── websocket-client.js  # WebSocket client
│       ├── gui_if.js           # GUI functions
│       └── jsholdem/           # Core game logic
│           ├── poker.js        # Main game logic
│           ├── hands.js        # Hand evaluation
│           └── bot.js          # AI player logic
```

## Troubleshooting

### Common Issues

1. **"Connection failed"**

   - Check if the server is running (`npm start`)
   - Verify you're using the correct URL
   - Check browser console for errors

2. **"Room is full"**

   - Maximum 10 players per room
   - Try creating a new room

3. **"Game won't start"**
   - Need minimum 2 players
   - Make sure all players have joined the room

### Browser Compatibility

- **Chrome**: Fully supported
- **Firefox**: Fully supported
- **Safari**: Fully supported
- **Edge**: Fully supported
- **Mobile browsers**: Supported with responsive design

### Network Requirements

- **WebSocket support**: Required
- **Local network**: Works on localhost
- **Internet**: Works with proper port forwarding/hosting

## Deployment

### Local Network

To play with others on your local network:

1. **Find your IP address**:

   ```bash
   # Windows
   ipconfig

   # Mac/Linux
   ifconfig
   ```

2. **Share your IP**: Others can connect to `http://YOUR_IP:3000`

### Cloud Deployment

For internet deployment, consider:

- **Heroku**: Easy deployment with WebSocket support
- **AWS**: EC2 instances with proper security groups
- **DigitalOcean**: Droplets with Node.js support

Remember to:

- Set appropriate `PORT` environment variable
- Configure firewall/security groups for WebSocket connections
- Use HTTPS/WSS for production

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

## License

This project is open source. Feel free to modify and distribute according to your needs.

## Credits

- Original poker game logic based on JS Hold'em
- WebSocket implementation using Node.js `ws` library
- Card images and design assets included
- Responsive design for cross-platform compatibility
