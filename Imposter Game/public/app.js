// Initialize Socket.IO connection
const socket = io();

// Screens
const mainMenu = document.getElementById('mainMenu');
const createScreen = document.getElementById('createScreen');
const joinScreen = document.getElementById('joinScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const roleScreen = document.getElementById('roleScreen');
const clueScreen = document.getElementById('clueScreen');
const votingScreen = document.getElementById('votingScreen');
const voteResultScreen = document.getElementById('voteResultScreen');
const ejectionScreen = document.getElementById('ejectionScreen');

// Buttons
const showCreateBtn = document.getElementById('showCreateBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const cancelJoinBtn = document.getElementById('cancelJoinBtn');
const joinRoomSubmitBtn = document.getElementById('joinRoomSubmitBtn');

// Inputs and displays
const hostNameInput = document.getElementById('hostName');
const displayRoomCode = document.getElementById('displayRoomCode');
const joinNameInput = document.getElementById('joinName');
const joinCodeInput = document.getElementById('joinCode');
const joinStatusMessage = document.getElementById('joinStatusMessage');
const playerList = document.getElementById('playerList');
const errorBanner = document.getElementById('errorBanner');

const hostControls = document.getElementById('hostControls');
const normalWordInput = document.getElementById('normalWord');
const impostorWordInput = document.getElementById('impostorWord');
const impostorSelect = document.getElementById('impostorSelect');
const impostorModeSpecific = document.getElementById('impostorModeSpecific');
const impostorModeRandom = document.getElementById('impostorModeRandom');
const specificImpostorContainer = document.getElementById('specificImpostorContainer');
const startGameBtn = document.getElementById('startGameBtn');
const waitingMessage = document.getElementById('waitingMessage');

const roleStatus = document.getElementById('roleStatus');
const roleWord = document.getElementById('roleWord');
const continueBtn = document.getElementById('continueBtn');

const clueInput = document.getElementById('clueInput');
const submitClueBtn = document.getElementById('submitClueBtn');
const clueStatusMessage = document.getElementById('clueStatusMessage');
const clueProgress = document.getElementById('clueProgress');
const clueList = document.getElementById('clueList');
const allSubmittedMessage = document.getElementById('allSubmittedMessage');
const hostClueControls = document.getElementById('hostClueControls');
const goToVotingBtn = document.getElementById('goToVotingBtn');
const anotherClueBtn = document.getElementById('anotherClueBtn');
const clueSubmissionArea = document.getElementById('clueSubmissionArea');

// Voting
const voteSelect = document.getElementById('voteSelect');
const submitVoteBtn = document.getElementById('submitVoteBtn');
const voteStatusMessage = document.getElementById('voteStatusMessage');
const voteProgress = document.getElementById('voteProgress');
const voteList = document.getElementById('voteList');
const voteTotals = document.getElementById('voteTotals');
const voteConclusion = document.getElementById('voteConclusion');
const hostTieControls = document.getElementById('hostTieControls');
const revoteBtn = document.getElementById('revoteBtn');
const endRoundBtn = document.getElementById('endRoundBtn');
const votingControls = document.getElementById('votingControls');

const hostPostGameControls = document.getElementById('hostPostGameControls');
const postGameClueBtn = document.getElementById('postGameClueBtn');
const postGameVoteBtn = document.getElementById('postGameVoteBtn');
const postGameNewBtn = document.getElementById('postGameNewBtn');
const revealImpostorBtn = document.getElementById('revealImpostorBtn');
const fullRevealInfo = document.getElementById('fullRevealInfo');
const revealImpostorName = document.getElementById('revealImpostorName');
const revealNormalWord = document.getElementById('revealNormalWord');
const revealImpostorWord = document.getElementById('revealImpostorWord');

// ---------------------------------------------------------------------------
// Client-side identity/state. The ID is issued by the server on create/join
// and is what every socket event uses from then on -- never the display name.
// ---------------------------------------------------------------------------
let myPlayerId = null;
let currentRoomCode = '';
let isHostClient = false;
let amISpectator = false;

let latestState = null;      // last roomState payload received, always authoritative
let previousPhase = null;    // to detect real-time phase transitions vs. late joins
let lastSeenResultVersion = null;
let awaitingRoleContinue = false; // true while the role-reveal screen is showing and
                                   // hasn't been dismissed, so background roomState
                                   // updates don't yank the screen away mid-read
let animatingResultVersion = null; // resultVersion currently mid ejection-animation,
                                    // so an unrelated broadcast (e.g. someone else's
                                    // socket reconnecting) can't cut the animation short

let joinRequestId = null; // identifies THIS join attempt to the server so repeated
                           // clicks (or a slow-network retry) before the first
                           // response returns resolve to the same player, not new ones

function generateClientId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'c-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function showScreen(screen) {
    [mainMenu, createScreen, joinScreen, lobbyScreen, roleScreen, clueScreen,
        votingScreen, voteResultScreen, ejectionScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.remove('hidden');
    clearTimeout(showError._t);
    showError._t = setTimeout(() => errorBanner.classList.add('hidden'), 5000);
}

socket.on('actionError', ({ message }) => showError(message));
socket.on('connect_error', () => showError('Connection error. Please check your network and reload.'));

// ---------------------------------------------------------------------------
// Menu navigation
// ---------------------------------------------------------------------------
showCreateBtn.addEventListener('click', () => showScreen(createScreen));
cancelCreateBtn.addEventListener('click', () => { showScreen(mainMenu); hostNameInput.value = ''; });
joinGameBtn.addEventListener('click', () => {
    joinRequestId = null; // fresh attempt each time the screen is opened
    joinStatusMessage.textContent = '';
    showScreen(joinScreen);
});
cancelJoinBtn.addEventListener('click', () => {
    showScreen(mainMenu);
    joinNameInput.value = '';
    joinCodeInput.value = '';
    joinStatusMessage.textContent = '';
    joinRequestId = null;
});

// ---------------------------------------------------------------------------
// Create / join room (HTTP allocates identity, then we bind the socket to it)
// ---------------------------------------------------------------------------
createRoomBtn.addEventListener('click', async () => {
    const hostName = hostNameInput.value.trim();
    const hostIsPlayer = document.getElementById('hostIsPlayer').checked;

    if (!hostName) { alert('Please enter your name!'); return; }

    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostName, hostIsPlayer })
        });
        const data = await response.json();

        if (response.ok) {
            isHostClient = true;
            amISpectator = !hostIsPlayer;
            currentRoomCode = data.roomCode;
            myPlayerId = data.playerId;
            hostControls.classList.remove('hidden');

            displayRoomCode.textContent = data.roomCode;
            showScreen(lobbyScreen);

            socket.emit('joinRoom', { roomCode: data.roomCode, playerId: myPlayerId });
        } else {
            alert(data.error || 'Failed to create room');
        }
    } catch (err) {
        console.error(err);
        alert('Error connecting to the server.');
    }
});

joinRoomSubmitBtn.addEventListener('click', async () => {
    if (joinRoomSubmitBtn.disabled) return; // belt-and-suspenders against double firing

    const playerName = joinNameInput.value.trim();
    const roomCode = joinCodeInput.value.trim().toUpperCase();

    if (!playerName || !roomCode) { alert('Please enter your name and the room code!'); return; }

    // Same id for every click of THIS attempt (reset only when the join screen
    // is (re)opened), so a slow connection + repeated clicks all resolve to
    // one player server-side instead of creating a new one each time.
    if (!joinRequestId) joinRequestId = generateClientId();

    joinRoomSubmitBtn.disabled = true;
    joinStatusMessage.textContent = 'Joining...';

    try {
        const response = await fetch('/api/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName, roomCode, clientJoinId: joinRequestId })
        });
        const data = await response.json();

        if (response.ok) {
            isHostClient = false;
            amISpectator = false;
            currentRoomCode = data.roomCode;
            myPlayerId = data.playerId;
            hostControls.classList.add('hidden');

            displayRoomCode.textContent = data.roomCode;
            joinStatusMessage.textContent = '';
            showScreen(lobbyScreen);

            socket.emit('joinRoom', { roomCode: data.roomCode, playerId: myPlayerId });
        } else {
            joinRoomSubmitBtn.disabled = false;
            joinStatusMessage.textContent = '';
            alert(data.error || 'Failed to join room');
        }
    } catch (err) {
        console.error(err);
        joinRoomSubmitBtn.disabled = false;
        joinStatusMessage.textContent = '';
        alert('Error connecting to the server.');
    }
});

// ---------------------------------------------------------------------------
// THE single sync point. Every real-time update -- lobby list, clue
// submissions, votes, results -- arrives here as one authoritative snapshot.
// ---------------------------------------------------------------------------
socket.on('roomState', (state) => {
    latestState = state;
    renderState(state);
    previousPhase = state.phase;
});

function renderState(state) {
    renderLobby(state);

    if (state.phase === 'lobby') {
        // A real transition INTO lobby (e.g. "New Word Game") should clear the
        // host's previous word-setup inputs. A same-phase re-render (another
        // player joining) must not wipe out what the host is mid-typing.
        if (previousPhase !== null && previousPhase !== 'lobby' && isHostClient) {
            normalWordInput.value = '';
            impostorWordInput.value = '';
            impostorModeSpecific.checked = true;
            updateImpostorModeUI();
        }
        if (!awaitingRoleContinue) showScreen(lobbyScreen);
        return;
    }

    if (state.phase === 'clues') {
        renderClues(state);
        // Only jump to the clue screen automatically if we're not mid role-reveal
        // (a fresh "startGame" sends a private roleReveal first; the player
        // dismisses it with Continue, which is what actually shows this screen).
        if (!awaitingRoleContinue) showScreen(clueScreen);
        return;
    }

    if (state.phase === 'voting') {
        renderVotingStarted(state);
        showScreen(votingScreen);
        return;
    }

    if (state.phase === 'result') {
        if (animatingResultVersion !== null && animatingResultVersion === state.resultVersion) {
            return; // don't let an unrelated broadcast interrupt the animation in progress
        }

        const isFreshResult = state.lastResult && state.resultVersion !== lastSeenResultVersion;
        lastSeenResultVersion = state.resultVersion;

        if (isFreshResult && !state.lastResult.isTie && previousPhase === 'voting') {
            animatingResultVersion = state.resultVersion;
            playEjectionAnimation(state);
        } else {
            renderResult(state);
            showScreen(voteResultScreen);
        }
    }
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------
function renderLobby(state) {
    playerList.innerHTML = '';
    impostorSelect.innerHTML = '<option value="">Select Impostor...</option>';

    const hostModeText = state.host.isPlayer ? 'Playing' : 'Spectator';
    document.getElementById('hostModeDisplay').textContent = `Host: ${state.host.name} — ${hostModeText}`;

    state.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.connected ? player.name : `${player.name} (disconnected)`;
        playerList.appendChild(li);

        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.name;
        impostorSelect.appendChild(option);
    });

    waitingMessage.classList.toggle('hidden', state.players.length > 0);
}

function updateImpostorModeUI() {
    const isRandom = impostorModeRandom.checked;
    specificImpostorContainer.classList.toggle('hidden', isRandom);
}
impostorModeSpecific.addEventListener('change', updateImpostorModeUI);
impostorModeRandom.addEventListener('change', updateImpostorModeUI);

startGameBtn.addEventListener('click', () => {
    const normalWord = normalWordInput.value.trim();
    const impostorWord = impostorWordInput.value.trim();
    const impostorKnowsRole = document.getElementById('impostorKnowsYes').checked;
    const impostorMode = impostorModeRandom.checked ? 'random' : 'specific';

    if (!normalWord || !impostorWord) {
        alert('Please fill out all host settings.');
        return;
    }

    let impostorId = null;
    if (impostorMode === 'specific') {
        impostorId = impostorSelect.value;
        if (!impostorId) {
            alert('Please select an impostor, or choose Random.');
            return;
        }
    }
    // In 'random' mode no impostorId is sent at all -- the server picks and
    // never tells this (host) browser who it picked.

    socket.emit('startGame', {
        roomCode: currentRoomCode,
        normalWord,
        impostorWord,
        impostorMode,
        impostorId,
        impostorKnowsRole
    });
});

// ---------------------------------------------------------------------------
// Role reveal (private, transient -- not part of roomState)
// ---------------------------------------------------------------------------
socket.on('roleReveal', (data) => {
    awaitingRoleContinue = true;
    showScreen(roleScreen);

    if (data.isSpectator) {
        roleStatus.textContent = 'You are Spectating';
        roleStatus.style.color = 'gray';
        roleWord.textContent = 'Players are viewing their roles...';
    } else if (data.impostorKnowsRole === false) {
        roleStatus.textContent = '';
        roleWord.textContent = `Your word: ${data.word}`;
    } else if (data.isImpostor) {
        roleStatus.textContent = 'You are the Impostor';
        roleStatus.style.color = 'red';
        if (data.normalWord) {
            roleWord.innerHTML = `Your Impostor word: <strong>${data.word}</strong><br>Normal players' word: <strong>${data.normalWord}</strong>`;
        } else {
            roleWord.textContent = `Your word: ${data.word}`;
        }
    } else {
        roleStatus.textContent = 'You are a Normal Player';
        roleStatus.style.color = 'blue';
        roleWord.textContent = `Your word: ${data.word}`;
    }
});

continueBtn.addEventListener('click', () => {
    awaitingRoleContinue = false;
    clueInput.value = '';
    if (latestState) renderClues(latestState);
    showScreen(clueScreen);
});

// ---------------------------------------------------------------------------
// Clue phase
// ---------------------------------------------------------------------------
function renderClues(state) {
    clueList.innerHTML = '';
    state.clueRounds.forEach((roundClues, index) => {
        const header = document.createElement('h4');
        header.textContent = `ROUND ${index + 1}`;
        header.style.marginTop = index === 0 ? '0' : '1.5rem';
        header.style.marginBottom = '0.5rem';
        header.style.color = '#555';
        clueList.appendChild(header);

        roundClues.forEach(clue => {
            const li = document.createElement('li');
            li.style.marginBottom = '0.5rem';
            li.innerHTML = `<strong>${clue.name}:</strong> ${clue.clueText}`;
            clueList.appendChild(li);
        });
    });

    const currentRoundClues = state.clueRounds[state.currentClueRound] || [];
    clueProgress.textContent = `${currentRoundClues.length} / ${state.totalParticipants}`;

    const iHaveSubmitted = currentRoundClues.some(c => c.playerId === myPlayerId);
    if (iHaveSubmitted) {
        clueSubmissionArea.classList.add('hidden');
        clueStatusMessage.textContent = 'You submitted your clue.';
    } else if (amISpectator) {
        clueSubmissionArea.classList.add('hidden');
        clueStatusMessage.textContent = 'You are spectating the game. You cannot submit clues.';
    } else {
        clueSubmissionArea.classList.remove('hidden');
        clueInput.disabled = false;
        submitClueBtn.disabled = false;
        clueStatusMessage.textContent = '';
    }

    const allSubmitted = state.totalParticipants > 0 && currentRoundClues.length === state.totalParticipants;
    allSubmittedMessage.classList.toggle('hidden', !allSubmitted);
    hostClueControls.classList.toggle('hidden', !(allSubmitted && isHostClient));
}

submitClueBtn.addEventListener('click', () => {
    const clueText = clueInput.value.trim();
    if (!clueText) return;

    socket.emit('submitClue', { roomCode: currentRoomCode, clueText });
    clueInput.value = '';
    clueInput.disabled = true;
    submitClueBtn.disabled = true;
    clueStatusMessage.textContent = 'You submitted your clue.';
});

goToVotingBtn.addEventListener('click', () => {
    socket.emit('startVoting', { roomCode: currentRoomCode });
});

anotherClueBtn.addEventListener('click', () => {
    socket.emit('startAnotherClueRound', { roomCode: currentRoomCode });
});

// ---------------------------------------------------------------------------
// Voting phase
// ---------------------------------------------------------------------------
function renderVotingStarted(state) {
    voteSelect.innerHTML = '<option value="">Select a player...</option>';
    state.players.forEach(p => {
        if (p.id !== myPlayerId) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            voteSelect.appendChild(opt);
        }
    });

    voteList.innerHTML = '';
    state.votes.forEach(v => {
        const li = document.createElement('li');
        li.style.marginBottom = '0.5rem';
        li.textContent = `${v.voterName} → ${v.targetName}`;
        voteList.appendChild(li);
    });
    voteProgress.textContent = `${state.votes.length} / ${state.totalParticipants}`;
    voteStatusMessage.textContent = '';

    hostPostGameControls.classList.add('hidden');
    fullRevealInfo.classList.add('hidden');

    const iHaveVoted = state.votes.some(v => v.voterId === myPlayerId);

    if (amISpectator) {
        votingControls.classList.add('hidden');
        voteStatusMessage.textContent = 'You are spectating. You cannot vote.';
    } else if (iHaveVoted) {
        votingControls.classList.add('hidden');
        voteStatusMessage.textContent = 'You have submitted your vote.';
    } else {
        votingControls.classList.remove('hidden');
        voteSelect.disabled = false;
        submitVoteBtn.disabled = false;
    }
}

submitVoteBtn.addEventListener('click', () => {
    const targetId = voteSelect.value;
    if (!targetId) return;
    socket.emit('submitVote', { roomCode: currentRoomCode, targetId });
});

// ---------------------------------------------------------------------------
// Result phase (tie handling, post-game controls, reveal)
// ---------------------------------------------------------------------------
function renderResult(state) {
    const result = state.lastResult;
    if (!result) return;

    voteTotals.innerHTML = '<h4>Individual Votes</h4><ul style="list-style:none;padding:0;">';
    state.votes.forEach(v => {
        voteTotals.innerHTML += `<li style="margin-bottom:0.25rem;">${v.voterName} → ${v.targetName}</li>`;
    });
    voteTotals.innerHTML += '</ul><h4>Vote Count</h4><ul style="list-style:none;padding:0;">';
    for (const name in result.tallies) {
        voteTotals.innerHTML += `<li style="margin-bottom:0.25rem;">${name} &mdash; <strong>${result.tallies[name]}</strong></li>`;
    }
    voteTotals.innerHTML += '</ul>';

    hostTieControls.classList.add('hidden');
    hostPostGameControls.classList.add('hidden');

    if (result.isTie && !result.resolved) {
        voteConclusion.textContent = "It's a tie.";
        voteConclusion.style.color = 'orange';
        if (isHostClient) hostTieControls.classList.remove('hidden');
    } else if (result.isTie && result.resolved) {
        voteConclusion.innerHTML = `The round has ended.<br><span style="color:blue;">The Impostor was ${result.actualImpostorName}.</span>`;
        if (isHostClient) hostPostGameControls.classList.remove('hidden');
    } else {
        if (result.votedOutWasImpostor) {
            voteConclusion.innerHTML = `${result.votedPlayerName} received the most votes.<br><span style="color:green;">They WERE the Impostor!</span>`;
        } else {
            voteConclusion.innerHTML = `${result.votedPlayerName} received the most votes.<br><span style="color:red;">They were NOT the Impostor.</span>`;
        }
        if (isHostClient) hostPostGameControls.classList.remove('hidden');
    }

    if (state.reveal) {
        revealImpostorName.textContent = state.reveal.impostorName;
        revealNormalWord.textContent = state.reveal.normalWord;
        revealImpostorWord.textContent = state.reveal.impostorWord;
        fullRevealInfo.classList.remove('hidden');
    } else {
        fullRevealInfo.classList.add('hidden');
    }
}

revoteBtn.addEventListener('click', () => socket.emit('revote', { roomCode: currentRoomCode }));
endRoundBtn.addEventListener('click', () => socket.emit('endRoundTie', { roomCode: currentRoomCode }));
revealImpostorBtn.addEventListener('click', () => socket.emit('revealImpostorAndWords', { roomCode: currentRoomCode }));
postGameClueBtn.addEventListener('click', () => socket.emit('startAnotherClueRound', { roomCode: currentRoomCode }));
postGameVoteBtn.addEventListener('click', () => socket.emit('startAnotherVotingRound', { roomCode: currentRoomCode }));
postGameNewBtn.addEventListener('click', () => socket.emit('startNewWordGame', { roomCode: currentRoomCode }));

// ---------------------------------------------------------------------------
// Ejection animation -- purely a client-side presentation layer over the
// authoritative result. It always ends by rendering the same result screen
// renderResult()/renderState() would have shown anyway.
// ---------------------------------------------------------------------------
function playEjectionAnimation(state) {
    const result = state.lastResult;
    const ejectedPlayerName = document.getElementById('ejectedPlayerName');
    const ejectedCharacter = document.getElementById('ejectedCharacter');
    const ejectionStars = document.getElementById('ejectionStars');
    const ejectionRoleReveal = document.getElementById('ejectionRoleReveal');
    const ejectionRoleText = document.getElementById('ejectionRoleText');
    const ejectionWinText = document.getElementById('ejectionWinText');

    ejectedPlayerName.textContent = result.votedPlayerName;
    ejectedCharacter.classList.remove('animate-eject');
    ejectionStars.classList.add('hidden');
    ejectionRoleReveal.classList.add('hidden');
    ejectionWinText.classList.add('hidden');

    showScreen(ejectionScreen);

    void ejectedCharacter.offsetWidth; // force reflow to restart animation
    ejectedCharacter.classList.add('animate-eject');

    let revealTimeout, endTimeout;

    const finish = () => {
        clearTimeout(revealTimeout);
        clearTimeout(endTimeout);
        ejectionScreen.removeEventListener('click', finish);
        animatingResultVersion = null;
        // Re-render from whatever the latest state is (it may have moved on,
        // e.g. the host already revealed the impostor while we were animating).
        renderResult(latestState || state);
        showScreen(voteResultScreen);
    };

    ejectionScreen.addEventListener('click', finish);

    revealTimeout = setTimeout(() => {
        ejectionStars.classList.remove('hidden');
        ejectionRoleReveal.classList.remove('hidden');

        if (result.votedOutWasImpostor) {
            ejectionRoleText.innerHTML = `${result.votedPlayerName}<br>WAS THE IMPOSTOR!`;
            ejectionWinText.textContent = '★ CREWMATES WIN! ★';
            ejectionWinText.classList.remove('hidden');
        } else {
            ejectionRoleText.innerHTML = `${result.votedPlayerName}<br>WAS NOT THE IMPOSTOR.<br><br>THE IMPOSTOR IS STILL HERE...`;
        }

        endTimeout = setTimeout(finish, 3000);
    }, 2000);
}
