const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const crypto = require('crypto');

app.use(express.json());
app.use(express.static('public'));

// ---------------------------------------------------------------------------
// In-memory room store. ONE room object per room code is the single source
// of truth. Nothing about the game is ever derived independently on a client.
// ---------------------------------------------------------------------------
const rooms = {};

const PHASES = ['lobby', 'clues', 'voting', 'result'];

// Explicit allow-list of phase transitions. Anything not listed here is
// rejected by the server, regardless of what a client asks for.
const ALLOWED_TRANSITIONS = {
  lobby: ['clues'],
  clues: ['voting'],
  voting: ['result'],
  result: ['clues', 'voting', 'lobby'],
};

function canTransition(from, to) {
  return ALLOWED_TRANSITIONS[from] && ALLOWED_TRANSITIONS[from].includes(to);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}

function generateId() {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Helpers that operate on a room. These are the ONLY places allowed to read
// or mutate room internals, so identity/authorization rules live in one spot.
// ---------------------------------------------------------------------------

// A "participant" is anyone with a seat in the game: the host (if playing)
// plus every joined player. Identity is always the stable id, never the name.
function getParticipant(room, id) {
  if (room.host.id === id && room.host.isPlayer) {
    return { id: room.host.id, name: room.host.name };
  }
  return room.players.find((p) => p.id === id) || null;
}

function isParticipant(room, id) {
  return !!getParticipant(room, id);
}

function nameOf(room, id) {
  if (id === room.host.id) return room.host.name;
  const p = room.players.find((pl) => pl.id === id);
  return p ? p.name : 'Unknown';
}

function socketIsHost(room, socket) {
  return room.connections[room.host.id] === socket.id;
}

// Resolve which player id owns this socket (host or otherwise).
function idForSocket(room, socket) {
  return Object.keys(room.connections).find((id) => room.connections[id] === socket.id) || null;
}

function sendError(socket, message) {
  socket.emit('actionError', { message });
}

// Build the state that is safe to send to EVERY client in the room. No
// secret words, no impostor identity (unless the host has explicitly
// revealed it), no per-player role information.
function publicState(room) {
  return {
    code: room.code,
    phase: room.phase,
    host: { name: room.host.name, isPlayer: room.host.isPlayer },
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: !!room.connections[p.id],
    })),
    totalParticipants: room.players.length,
    clueRounds: room.clueRounds.map((round) =>
      round.map((c) => ({ playerId: c.playerId, name: nameOf(room, c.playerId), clueText: c.clueText }))
    ),
    currentClueRound: room.currentClueRound,
    votes: room.votes.map((v) => ({
      voterId: v.voterId,
      voterName: nameOf(room, v.voterId),
      targetId: v.targetId,
      targetName: nameOf(room, v.targetId),
    })),
    lastResult: room.lastResult,
    resultVersion: room.resultVersion,
    reveal: room.reveal, // set only after host explicitly reveals impostor+words
  };
}

function broadcastRoomState(room) {
  io.to(room.code).emit('roomState', publicState(room));
}

// Deliver each participant's private role information. Never broadcast this.
function sendPrivateRoles(room) {
  room.players.forEach((player) => {
    const socketId = room.connections[player.id];
    if (!socketId) return; // not connected right now; they'll refresh state won't recover this (see limitations)
    const isImpostor = player.id === room.game.impostorId;
    const word = isImpostor ? room.game.impostorWord : room.game.normalWord;
    const payload = {
      isImpostor: isImpostor && room.game.impostorKnowsRole,
      impostorKnowsRole: room.game.impostorKnowsRole,
      word,
    };
    if (isImpostor && room.game.tellImpostorNormalWord) {
      payload.normalWord = room.game.normalWord;
    }
    io.to(socketId).emit('roleReveal', payload);
  });

  if (!room.host.isPlayer) {
    const hostSocketId = room.connections[room.host.id];
    if (hostSocketId) {
      io.to(hostSocketId).emit('roleReveal', { isSpectator: true });
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP: room creation / joining. These only allocate identity; all real-time
// synchronization happens over the socket once the client binds to that id.
// ---------------------------------------------------------------------------

app.post('/api/rooms', (req, res) => {
  const { hostName, hostIsPlayer } = req.body;

  if (!hostName || !hostName.trim()) {
    return res.status(400).json({ error: 'Host name is required' });
  }

  const roomCode = generateRoomCode();
  const hostId = generateId();
  const isPlayer = !!hostIsPlayer;

  const room = {
    code: roomCode,
    host: { id: hostId, name: hostName.trim(), isPlayer },
    players: isPlayer ? [{ id: hostId, name: hostName.trim() }] : [],
    connections: {}, // playerId -> socket.id
    phase: 'lobby',
    game: {
      normalWord: null,
      impostorWord: null,
      impostorId: null,
      impostorKnowsRole: true,
      tellImpostorNormalWord: false,
    },
    clueRounds: [[]],
    currentClueRound: 0,
    votes: [],
    lastResult: null,
    resultVersion: 0,
    reveal: null,
    createdAt: new Date(),
  };

  rooms[roomCode] = room;

  res.json({ roomCode, playerId: hostId, isHost: true, isPlayer });
});

app.post('/api/join', (req, res) => {
  let { playerName, roomCode } = req.body;

  if (!playerName || !playerName.trim() || !roomCode) {
    return res.status(400).json({ error: 'Player name and room code are required' });
  }

  playerName = playerName.trim();
  roomCode = roomCode.toUpperCase();

  const room = rooms[roomCode];
  if (!room) {
    return res.status(404).json({ error: 'Room not found. Please check the code.' });
  }

  if (room.phase !== 'lobby') {
    return res.status(409).json({ error: 'This game has already started. Ask the host for a new room.' });
  }

  const playerId = generateId();
  room.players.push({ id: playerId, name: playerName });

  res.json({ roomCode, playerId, isHost: false, isPlayer: true });
});

// ---------------------------------------------------------------------------
// Socket.IO: everything past this point is "client asks, server decides".
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomCode, playerId }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');

    const isHostId = playerId === room.host.id;
    if (!isHostId && !isParticipant(room, playerId)) {
      return sendError(socket, 'You are not recognized in this room.');
    }

    room.connections[playerId] = socket.id;
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.playerId = playerId;

    broadcastRoomState(room);
  });

  // Host starts the game: lobby -> clues
  socket.on('startGame', ({ roomCode, normalWord, impostorWord, impostorId, impostorKnowsRole, tellImpostorNormalWord }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (!socketIsHost(room, socket)) return sendError(socket, 'Only the host can start the game.');
    if (!canTransition(room.phase, 'clues')) return sendError(socket, `Cannot start game from phase "${room.phase}".`);

    if (!normalWord || !impostorWord || !impostorId) {
      return sendError(socket, 'Normal word, impostor word, and impostor selection are required.');
    }
    if (!isParticipant(room, impostorId)) {
      return sendError(socket, 'Selected impostor is not a participating player.');
    }
    if (room.players.length < 2) {
      return sendError(socket, 'Need at least 2 players to start.');
    }

    room.game = {
      normalWord: String(normalWord),
      impostorWord: String(impostorWord),
      impostorId,
      impostorKnowsRole: !!impostorKnowsRole,
      tellImpostorNormalWord: !!tellImpostorNormalWord,
    };
    room.clueRounds = [[]];
    room.currentClueRound = 0;
    room.votes = [];
    room.lastResult = null;
    room.reveal = null;
    room.phase = 'clues';

    sendPrivateRoles(room);
    broadcastRoomState(room);
  });

  socket.on('submitClue', ({ roomCode, clueText }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (room.phase !== 'clues') return sendError(socket, 'Clues are not being collected right now.');

    const playerId = idForSocket(room, socket);
    if (!playerId) return sendError(socket, 'You are not connected to this room.');
    if (!room.players.some((p) => p.id === playerId)) return sendError(socket, 'Spectators cannot submit clues.');
    if (!clueText || !String(clueText).trim()) return sendError(socket, 'Clue cannot be empty.');

    const round = room.clueRounds[room.currentClueRound];
    if (round.some((c) => c.playerId === playerId)) {
      return sendError(socket, 'You already submitted a clue this round.');
    }

    round.push({ playerId, clueText: String(clueText).trim() });
    broadcastRoomState(room);
  });

  // Explicit resync request (e.g. right after a client finishes an animation
  // or transition). Always answered from the same authoritative state.
  socket.on('requestState', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    socket.emit('roomState', publicState(room));
  });

  // Host: clues -> voting
  socket.on('startVoting', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (!socketIsHost(room, socket)) return sendError(socket, 'Only the host can start voting.');
    if (!canTransition(room.phase, 'voting')) return sendError(socket, `Cannot start voting from phase "${room.phase}".`);

    room.votes = [];
    room.lastResult = null;
    room.phase = 'voting';
    broadcastRoomState(room);
  });

  socket.on('submitVote', ({ roomCode, targetId }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (room.phase !== 'voting') return sendError(socket, 'Voting is not open right now.');

    const voterId = idForSocket(room, socket);
    if (!voterId) return sendError(socket, 'You are not connected to this room.');
    if (!room.players.some((p) => p.id === voterId)) return sendError(socket, 'Spectators cannot vote.');
    if (!room.players.some((p) => p.id === targetId)) return sendError(socket, 'Invalid vote target.');
    if (voterId === targetId) return sendError(socket, 'You cannot vote for yourself.');
    if (room.votes.some((v) => v.voterId === voterId)) return sendError(socket, 'You already voted.');

    room.votes.push({ voterId, targetId });
    broadcastRoomState(room);

    if (room.votes.length === room.players.length) {
      tallyVotesAndTransition(room);
    }
  });

  function tallyVotesAndTransition(room) {
    const tallies = {};
    room.players.forEach((p) => (tallies[p.id] = 0));
    room.votes.forEach((v) => (tallies[v.targetId] = (tallies[v.targetId] || 0) + 1));

    let maxVotes = 0;
    for (const id in tallies) if (tallies[id] > maxVotes) maxVotes = tallies[id];
    const tiedIds = Object.keys(tallies).filter((id) => tallies[id] === maxVotes);
    const isTie = tiedIds.length > 1;

    const votedId = isTie ? null : tiedIds[0];
    const votedOutWasImpostor = votedId !== null && votedId === room.game.impostorId;

    room.lastResult = {
      isTie,
      tallies: Object.fromEntries(Object.entries(tallies).map(([id, count]) => [nameOf(room, id), count])),
      votedPlayerId: votedId,
      votedPlayerName: votedId ? nameOf(room, votedId) : null,
      votedOutWasImpostor,
      resolved: !isTie, // a tie is not yet a resolved result; host must revote or end round
    };
    room.resultVersion += 1;
    room.phase = 'result';
    broadcastRoomState(room);
  }

  // Host tie-break: revote (voting phase again, same round)
  socket.on('revote', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (!socketIsHost(room, socket)) return sendError(socket, 'Only the host can call a revote.');
    if (room.phase !== 'result' || !room.lastResult || !room.lastResult.isTie) {
      return sendError(socket, 'Revote is only available after a tied vote.');
    }
    if (!canTransition(room.phase, 'voting')) return sendError(socket, 'Invalid transition.');

    room.votes = [];
    room.lastResult = null;
    room.phase = 'voting';
    broadcastRoomState(room);
  });

  // Host tie-break: end the round without resolving the tie, reveal impostor
  socket.on('endRoundTie', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (!socketIsHost(room, socket)) return sendError(socket, 'Only the host can end the round.');
    if (room.phase !== 'result' || !room.lastResult || !room.lastResult.isTie) {
      return sendError(socket, 'This action is only available after a tied vote.');
    }

    room.lastResult.resolved = true;
    room.lastResult.tieEndedWithoutVote = true;
    room.lastResult.actualImpostorName = nameOf(room, room.game.impostorId);
    room.resultVersion += 1;
    broadcastRoomState(room);
  });

  // Host: reveal impostor identity + both words (post-game info panel)
  socket.on('revealImpostorAndWords', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (!socketIsHost(room, socket)) return sendError(socket, 'Only the host can reveal the impostor.');
    if (room.phase !== 'result') return sendError(socket, 'Reveal is only available on the results screen.');

    room.reveal = {
      impostorName: nameOf(room, room.game.impostorId),
      normalWord: room.game.normalWord,
      impostorWord: room.game.impostorWord,
    };
    broadcastRoomState(room);
  });

  // Host: result -> clues (new round, clue history preserved)
  socket.on('startAnotherClueRound', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (!socketIsHost(room, socket)) return sendError(socket, 'Only the host can start another clue round.');
    if (!canTransition(room.phase, 'clues')) return sendError(socket, `Cannot start a clue round from phase "${room.phase}".`);

    room.currentClueRound += 1;
    room.clueRounds.push([]);
    room.votes = [];
    room.lastResult = null;
    room.reveal = null;
    room.phase = 'clues';
    broadcastRoomState(room);
  });

  // Host: result -> voting (new voting round, clue history preserved)
  socket.on('startAnotherVotingRound', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (!socketIsHost(room, socket)) return sendError(socket, 'Only the host can start another voting round.');
    if (!canTransition(room.phase, 'voting')) return sendError(socket, `Cannot start voting from phase "${room.phase}".`);

    room.votes = [];
    room.lastResult = null;
    room.reveal = null;
    room.phase = 'voting';
    broadcastRoomState(room);
  });

  // Host: result -> lobby (new word game; room + players persist)
  socket.on('startNewWordGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return sendError(socket, 'Room not found.');
    if (!socketIsHost(room, socket)) return sendError(socket, 'Only the host can start a new word game.');
    if (!canTransition(room.phase, 'lobby')) return sendError(socket, `Cannot return to lobby from phase "${room.phase}".`);

    room.game = { normalWord: null, impostorWord: null, impostorId: null, impostorKnowsRole: true, tellImpostorNormalWord: false };
    room.clueRounds = [[]];
    room.currentClueRound = 0;
    room.votes = [];
    room.lastResult = null;
    room.reveal = null;
    room.phase = 'lobby';
    broadcastRoomState(room);
  });

  socket.on('disconnect', () => {
    const { roomCode, playerId } = socket.data || {};
    const room = roomCode && rooms[roomCode];
    if (!room || !playerId) return;
    // Only clear the mapping if this socket is still the one on file (a
    // reconnect may already have replaced it with a newer socket id).
    if (room.connections[playerId] === socket.id) {
      delete room.connections[playerId];
      broadcastRoomState(room);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on ${PORT}`);
});
