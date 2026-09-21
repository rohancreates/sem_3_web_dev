const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Middleware to parse JSON bodies from HTTP requests
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// In-memory store for rooms
const rooms = {};

// Helper function to generate a random 4-character code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for(let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]); // Ensure the code isn't already in use
  return code;
}

// API endpoint to create a new room
app.post('/api/rooms', (req, res) => {
  const { hostName, hostIsPlayer } = req.body;
  
  if (!hostName) {
    return res.status(400).json({ error: 'Host name is required' });
  }

  const roomCode = generateRoomCode();
  
  // Save room data to memory
  rooms[roomCode] = {
    host: hostName,
    hostIsPlayer: hostIsPlayer,
    players: hostIsPlayer ? [hostName] : [], // Only add to players if playing
    createdAt: new Date(),
    sockets: {} // To store socket IDs
  };

  // Send the room code back to the client
  res.json({ roomCode });
});

// API endpoint to join an existing room
app.post('/api/join', (req, res) => {
  let { playerName, roomCode } = req.body;
  
  if (!playerName || !roomCode) {
    return res.status(400).json({ error: 'Player name and room code are required' });
  }

  roomCode = roomCode.toUpperCase();

  const room = rooms[roomCode];

  if (!room) {
    return res.status(404).json({ error: 'Room not found. Please check the code.' });
  }

  // Add the new player to the room
  room.players.push(playerName);

  // Send success response
  res.json({ roomCode, players: room.players });
});

// Socket.IO logic for real-time updates
io.on('connection', (socket) => {
  // When a client joins a room via Socket.IO
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    socket.join(roomCode);
    
    // Broadcast the updated player list to everyone in this room
    if (rooms[roomCode]) {
      // Store this player's specific socket ID
      if (!rooms[roomCode].sockets) rooms[roomCode].sockets = {};
      rooms[roomCode].sockets[playerName] = socket.id;

      io.to(roomCode).emit('updatePlayers', {
        players: rooms[roomCode].players,
        hostName: rooms[roomCode].host,
        hostIsPlayer: rooms[roomCode].hostIsPlayer
      });
    }
  });

  // When the host starts the game
  socket.on('startGame', ({ roomCode, normalWord, impostorWord, impostor, impostorKnowsRole, tellImpostorNormalWord }) => {
    const room = rooms[roomCode];
    if (room) {
      // Store secret state on the server ONLY
      room.state = 'playing';
      room.normalWord = normalWord;
      room.impostorWord = impostorWord;
      room.impostor = impostor;
      room.impostorKnowsRole = impostorKnowsRole;
      room.tellImpostorNormalWord = tellImpostorNormalWord;
      room.clueRounds = [ [] ];
      room.currentClueRound = 0;
      
      // Send individual secret roles to each participating player
      room.players.forEach(player => {
        const playerSocketId = room.sockets[player];
        if (playerSocketId) {
          const isImpostor = (player === impostor);
          const word = isImpostor ? impostorWord : normalWord;
          
          let isImpostorPayload = false;
          if (isImpostor && impostorKnowsRole) {
              isImpostorPayload = true;
          }

          const payload = {
            isImpostor: isImpostorPayload,
            impostorKnowsRole: impostorKnowsRole,
            word
          };
          
          if (isImpostor && tellImpostorNormalWord) {
            payload.normalWord = room.normalWord;
          }

          io.to(playerSocketId).emit('roleReveal', payload);
        }
      });
      
      // If host is spectator, they are not in room.players. Send them a spectator reveal.
      if (!room.hostIsPlayer) {
        const hostSocketId = room.sockets[room.host];
        if (hostSocketId) {
          io.to(hostSocketId).emit('roleReveal', {
            isSpectator: true
          });
        }
      }
    }
  });

  // When a player submits a clue
  socket.on('submitClue', ({ roomCode, playerName, clueText }) => {
    const room = rooms[roomCode];
    // Validate state, player, and input
    if (room && room.state === 'playing' && clueText && playerName) {
      if (!room.players.includes(playerName)) return; // Spectators can't submit clues
      
      if (!room.clueRounds[room.currentClueRound]) {
        room.clueRounds[room.currentClueRound] = [];
      }
      
      const currentRoundClues = room.clueRounds[room.currentClueRound];
      // Prevent duplicate submissions in current round
      const alreadySubmitted = currentRoundClues.some(c => c.playerName === playerName);
      if (!alreadySubmitted) {
        const newClue = { playerName, clueText };
        currentRoundClues.push(newClue);
        
        // Send the complete clue rounds history
        io.to(roomCode).emit('cluesUpdated', {
          clueRounds: room.clueRounds,
          currentRound: room.currentClueRound,
          totalPlayers: room.players.length
        });
      }
    }
  });

  // Client requests current clues when they enter the phase
  socket.on('requestCurrentClues', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.state === 'playing' && room.clueRounds) {
      socket.emit('cluesUpdated', {
        clueRounds: room.clueRounds,
        currentRound: room.currentClueRound,
        totalPlayers: room.players.length
      });
    }
  });

  // Start voting phase
  socket.on('startVoting', ({ roomCode }) => {
    console.log(`[DEBUG] Received startVoting for room ${roomCode} from socket ${socket.id}`);
    const room = rooms[roomCode];
    if (room && room.state === 'playing' && room.sockets[room.host] === socket.id) {
      console.log(`[DEBUG] startVoting authorized for ${roomCode}, transitioning to voting`);
      room.state = 'voting';
      room.votes = [];
      io.to(roomCode).emit('votingStarted', { players: room.players });
    } else {
      console.log(`[DEBUG] startVoting failed. Room exists: ${!!room}, State: ${room?.state}, Is Host: ${room?.sockets?.[room?.host] === socket.id}`);
    }
  });

  // Submit a vote
  socket.on('submitVote', ({ roomCode, voterName, targetName }) => {
    const room = rooms[roomCode];
    if (room && room.state === 'voting' && voterName && targetName) {
      if (!room.players.includes(voterName)) return; // Spectators can't vote
      if (voterName === targetName) return; // Can't vote for self
      if (!room.players.includes(targetName)) return; // Target must play
      
      const alreadyVoted = room.votes.some(v => v.voterName === voterName);
      if (!alreadyVoted) {
        room.votes.push({ voterName, targetName });
        
        // Broadcast vote to everyone immediately
        io.to(roomCode).emit('newVote', {
          voterName,
          targetName,
          totalVotes: room.votes.length,
          totalPlayers: room.players.length,
          votes: room.votes
        });
        
        // Tally results if everyone has voted
        if (room.votes.length === room.players.length) {
          const tallies = {};
          room.players.forEach(p => tallies[p] = 0);
          room.votes.forEach(v => tallies[v.targetName]++);
          
          let maxVotes = 0;
          for (let p in tallies) {
            if (tallies[p] > maxVotes) maxVotes = tallies[p];
          }
          
          const tiedPlayers = Object.keys(tallies).filter(p => tallies[p] === maxVotes);
          const isTie = tiedPlayers.length > 1;
          
          let actualImpostor = room.impostor;
          let votedPlayer = isTie ? null : tiedPlayers[0];
          let votedOutWasImpostor = votedPlayer === actualImpostor;

          io.to(roomCode).emit('votingComplete', {
            tallies,
            votes: room.votes,
            isTie,
            votedPlayer,
            votedOutWasImpostor,
            actualImpostor
          });
        }
      }
    }
  });

  // Host Revote handling
  socket.on('revote', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.state === 'voting') {
      room.votes = [];
      io.to(roomCode).emit('votingStarted', { players: room.players });
    }
  });

  // Host tie break / end round
  socket.on('endRoundTie', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.state === 'voting') {
      io.to(roomCode).emit('revealImpostor', { actualImpostor: room.impostor });
    }
  });

  // Host: Another Clue Round
  socket.on('startAnotherClueRound', ({ roomCode }) => {
    console.log(`[DEBUG] Received startAnotherClueRound for room ${roomCode} from socket ${socket.id}`);
    const room = rooms[roomCode];
    if (room && room.sockets[room.host] === socket.id) {
      console.log(`[DEBUG] startAnotherClueRound authorized for ${roomCode}`);
      room.state = 'playing';
      room.currentClueRound += 1;
      if (!room.clueRounds[room.currentClueRound]) {
        room.clueRounds[room.currentClueRound] = [];
      }
      room.votes = [];
      io.to(roomCode).emit('cluePhaseStarted');
    } else {
      console.log(`[DEBUG] startAnotherClueRound failed. Room exists: ${!!room}, Is Host: ${room?.sockets?.[room?.host] === socket.id}`);
    }
  });

  // Host: Another Voting Round
  socket.on('startAnotherVotingRound', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.sockets[room.host] === socket.id) {
      room.state = 'voting';
      room.votes = [];
      io.to(roomCode).emit('votingStarted', { players: room.players });
    }
  });

  // Host: New Word Game
  socket.on('startNewWordGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.sockets[room.host] === socket.id) {
      room.state = 'lobby';
      room.clueRounds = [ [] ];
      room.currentClueRound = 0;
      room.votes = [];
      room.normalWord = null;
      room.impostorWord = null;
      room.impostor = null;
      io.to(roomCode).emit('newWordGameStarted');
    }
  });
  // Host reveals impostor and both words
  socket.on('revealImpostorAndWords', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.sockets[room.host] === socket.id) {
      io.to(roomCode).emit('impostorRevealed', {
        impostor: room.impostor,
        normalWord: room.normalWord,
        impostorWord: room.impostorWord
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on ${PORT}`);
});
