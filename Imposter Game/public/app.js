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
const playerList = document.getElementById('playerList');

const hostControls = document.getElementById('hostControls');
const normalWordInput = document.getElementById('normalWord');
const impostorWordInput = document.getElementById('impostorWord');
const impostorSelect = document.getElementById('impostorSelect');
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

const hostPostGameControls = document.getElementById('hostPostGameControls');
const postGameClueBtn = document.getElementById('postGameClueBtn');
const postGameVoteBtn = document.getElementById('postGameVoteBtn');
const postGameNewBtn = document.getElementById('postGameNewBtn');
const revealImpostorBtn = document.getElementById('revealImpostorBtn');
const fullRevealInfo = document.getElementById('fullRevealInfo');
const revealImpostorName = document.getElementById('revealImpostorName');
const revealNormalWord = document.getElementById('revealNormalWord');
const revealImpostorWord = document.getElementById('revealImpostorWord');

let isHost = false;
let currentRoomCode = '';
let myPlayerName = '';
let amISpectator = false;

// Helper function to switch screens
function showScreen(screen) {
    mainMenu.classList.add('hidden');
    createScreen.classList.add('hidden');
    joinScreen.classList.add('hidden');
    lobbyScreen.classList.add('hidden');
    roleScreen.classList.add('hidden');
    clueScreen.classList.add('hidden');
    votingScreen.classList.add('hidden');
    voteResultScreen.classList.add('hidden');
    screen.classList.remove('hidden');
}

// 1. Show create game screen when "Create Game" is clicked
showCreateBtn.addEventListener('click', () => {
    showScreen(createScreen);
});

// Cancel creating a room
cancelCreateBtn.addEventListener('click', () => {
    showScreen(mainMenu);
    hostNameInput.value = ''; // Clear input
});

// Show join game screen
joinGameBtn.addEventListener('click', () => {
    showScreen(joinScreen);
});

// Cancel joining a room
cancelJoinBtn.addEventListener('click', () => {
    showScreen(mainMenu);
    joinNameInput.value = '';
    joinCodeInput.value = '';
});

// Handle joining a room
joinRoomSubmitBtn.addEventListener('click', async () => {
    const playerName = joinNameInput.value.trim();
    const roomCode = joinCodeInput.value.trim().toUpperCase();

    if (!playerName || !roomCode) {
        alert('Please enter your name and the room code!');
        return;
    }

    try {
        const response = await fetch('/api/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playerName, roomCode })
        });

        const data = await response.json();

        if (response.ok) {
            isHost = false;
            currentRoomCode = data.roomCode;
            myPlayerName = playerName;
            hostControls.classList.add('hidden');

            // Success! Show the lobby screen
            displayRoomCode.textContent = data.roomCode;
            showScreen(lobbyScreen);

            // Connect to the real-time Socket.IO room
            socket.emit('joinRoom', { roomCode: data.roomCode, playerName: myPlayerName });
        } else {
            alert(data.error || 'Failed to join room');
        }
    } catch (err) {
        console.error(err);
        alert('Error connecting to the server.');
    }
});

// 2. Handle creating a room
createRoomBtn.addEventListener('click', async () => {
    const hostName = hostNameInput.value.trim();
    const hostIsPlayer = document.getElementById('hostIsPlayer').checked;

    if (!hostName) {
        alert('Please enter your name!');
        return;
    }

    try {
        // Send a request to our Express server
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hostName, hostIsPlayer })
        });

        const data = await response.json();

        if (response.ok) {
            isHost = true;
            amISpectator = !hostIsPlayer;
            currentRoomCode = data.roomCode;
            myPlayerName = hostName;
            hostControls.classList.remove('hidden');
            // Success! Show the lobby screen with the new room code
            displayRoomCode.textContent = data.roomCode;
            showScreen(lobbyScreen);

            // Connect to the real-time Socket.IO room
            socket.emit('joinRoom', { roomCode: data.roomCode, playerName: myPlayerName });
        } else {
            alert(data.error || 'Failed to create room');
        }
    } catch (err) {
        console.error(err);
        alert('Error connecting to the server.');
    }
});

// Listen for player list updates from the server
socket.on('updatePlayers', ({ players, hostName, hostIsPlayer }) => {
    playerList.innerHTML = ''; // Clear current list
    impostorSelect.innerHTML = '<option value="">Select Impostor...</option>'; // Clear select options

    // Display host mode
    const hostModeText = hostIsPlayer ? "Playing" : "Spectator";
    document.getElementById('hostModeDisplay').textContent = `Host: ${hostName} — ${hostModeText}`;

    players.forEach(player => {
        // Add to list
        const li = document.createElement('li');
        li.textContent = player;
        playerList.appendChild(li);

        // Add to host dropdown
        const option = document.createElement('option');
        option.value = player;
        option.textContent = player;
        impostorSelect.appendChild(option);
    });
});

// Handle starting the game
startGameBtn.addEventListener('click', () => {
    const normalWord = normalWordInput.value.trim();
    const impostorWord = impostorWordInput.value.trim();
    const impostor = impostorSelect.value;
    const impostorKnowsRole = document.getElementById('impostorKnowsYes').checked;
    const tellImpostorNormalWord = document.getElementById('tellImpostorNormalWord').checked;

    if (!normalWord || !impostorWord || !impostor) {
        alert('Please fill out all host settings.');
        return;
    }

    // Send secret setup to the server
    socket.emit('startGame', {
        roomCode: currentRoomCode,
        normalWord,
        impostorWord,
        impostor,
        impostorKnowsRole,
        tellImpostorNormalWord
    });
});

socket.on('roleReveal', (data) => {
    showScreen(roleScreen);

    if (data.isSpectator) {
        roleStatus.textContent = "You are Spectating";
        roleStatus.style.color = "gray";
        roleWord.textContent = "Players are viewing their roles...";
    } else if (data.impostorKnowsRole === false) {
        roleStatus.textContent = "";
        roleWord.textContent = `Your word: ${data.word}`;
    } else if (data.isImpostor) {
        roleStatus.textContent = "You are the Impostor";
        roleStatus.style.color = "red";
        if (data.normalWord) {
            roleWord.innerHTML = `Your Impostor word: <strong>${data.word}</strong><br>Normal players' word: <strong>${data.normalWord}</strong>`;
        } else {
            roleWord.textContent = `Your word: ${data.word}`;
        }
    } else {
        roleStatus.textContent = "You are a Normal Player";
        roleStatus.style.color = "blue";
        roleWord.textContent = `Your word: ${data.word}`;
    }
});

continueBtn.addEventListener('click', () => {
    // Reset clue screen UI before showing
    clueInput.value = '';
    
    if (amISpectator) {
        document.getElementById('clueSubmissionArea').classList.add('hidden');
        clueStatusMessage.textContent = 'You are spectating the game. You cannot submit clues.';
    } else {
        document.getElementById('clueSubmissionArea').classList.remove('hidden');
        clueInput.disabled = false;
        submitClueBtn.disabled = false;
        clueStatusMessage.textContent = '';
    }
    
    allSubmittedMessage.classList.add('hidden');
    hostClueControls.classList.add('hidden');

    // Request current clues in case others submitted while we were on the role reveal screen
    socket.emit('requestCurrentClues', { roomCode: currentRoomCode });

    showScreen(clueScreen);
});

// Submit a clue
submitClueBtn.addEventListener('click', () => {
    const clueText = clueInput.value.trim();
    if (!clueText) return;

    socket.emit('submitClue', {
        roomCode: currentRoomCode,
        playerName: myPlayerName,
        clueText
    });

    clueInput.disabled = true;
    submitClueBtn.disabled = true;
    clueStatusMessage.textContent = 'You submitted your clue.';
});

// Receive updated clue list
socket.on('cluesUpdated', ({ clueRounds, currentRound, totalPlayers }) => {
    clueList.innerHTML = ''; // Clear and rebuild from server truth
    
    clueRounds.forEach((roundClues, index) => {
        const header = document.createElement('h4');
        header.textContent = `ROUND ${index + 1}`;
        header.style.marginTop = index === 0 ? '0' : '1.5rem';
        header.style.marginBottom = '0.5rem';
        header.style.color = '#555';
        clueList.appendChild(header);

        roundClues.forEach(clue => {
            const li = document.createElement('li');
            li.style.marginBottom = '0.5rem';
            li.innerHTML = `<strong>${clue.playerName}:</strong> ${clue.clueText}`;
            clueList.appendChild(li);
        });
    });
    
    const currentRoundClues = clueRounds[currentRound] || [];
    clueProgress.textContent = `${currentRoundClues.length} / ${totalPlayers}`;
    
    // Make sure our input is disabled if we already submitted
    const iHaveSubmitted = currentRoundClues.some(c => c.playerName === myPlayerName);
    if (iHaveSubmitted) {
        document.getElementById('clueSubmissionArea').classList.add('hidden');
        clueStatusMessage.textContent = 'You submitted your clue.';
    } else {
        if (amISpectator) {
            document.getElementById('clueSubmissionArea').classList.add('hidden');
            clueStatusMessage.textContent = 'You are spectating the game. You cannot submit clues.';
        } else {
            document.getElementById('clueSubmissionArea').classList.remove('hidden');
            clueInput.disabled = false;
            submitClueBtn.disabled = false;
            clueStatusMessage.textContent = '';
        }
    }

    // Rely on the server's authoritative state to handle completion
    if (totalPlayers > 0 && currentRoundClues.length === totalPlayers) {
        allSubmittedMessage.classList.remove('hidden');
        if (isHost) {
            hostClueControls.classList.remove('hidden');
        }
    }
});

// Everyone has submitted
socket.on('allCluesSubmitted', () => {
    allSubmittedMessage.classList.remove('hidden');
    if (isHost) {
        hostClueControls.classList.remove('hidden');
    }
});

// Host goes to voting phase
goToVotingBtn.addEventListener('click', () => {
    socket.emit('startVoting', { roomCode: currentRoomCode });
});

anotherClueBtn.addEventListener('click', () => {
    socket.emit('startAnotherClueRound', { roomCode: currentRoomCode });
});

// ------------- VOTING PHASE ------------- //

socket.on('votingStarted', ({ players }) => {
    voteSelect.innerHTML = '<option value="">Select a player...</option>';
    players.forEach(p => {
        if (p !== myPlayerName) {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            voteSelect.appendChild(opt);
        }
    });

    voteList.innerHTML = '';
    voteProgress.textContent = `0 / ${players.length}`;
    voteStatusMessage.textContent = '';

    hostPostGameControls.classList.add('hidden');
    fullRevealInfo.classList.add('hidden');
    
    if (amISpectator) {
        document.getElementById('votingControls').classList.add('hidden');
        voteStatusMessage.textContent = 'You are spectating. You cannot vote.';
    } else {
        document.getElementById('votingControls').classList.remove('hidden');
        voteSelect.disabled = false;
        submitVoteBtn.disabled = false;
    }

    showScreen(votingScreen);
});

submitVoteBtn.addEventListener('click', () => {
    const targetName = voteSelect.value;
    if (!targetName) return;

    socket.emit('submitVote', {
        roomCode: currentRoomCode,
        voterName: myPlayerName,
        targetName
    });
});

socket.on('newVote', ({ voterName, targetName, totalVotes, totalPlayers, votes }) => {
    voteList.innerHTML = '';
    votes.forEach(v => {
        const li = document.createElement('li');
        li.style.marginBottom = '0.5rem';
        li.textContent = `${v.voterName} → ${v.targetName}`;
        voteList.appendChild(li);
    });
    voteProgress.textContent = `${totalVotes} / ${totalPlayers}`;

    const iHaveVoted = votes.some(v => v.voterName === myPlayerName);
    if (iHaveVoted) {
        document.getElementById('votingControls').classList.add('hidden');
        if (!amISpectator) {
            voteStatusMessage.textContent = 'You have submitted your vote.';
        }
    }
});

socket.on('votingComplete', ({ tallies, votes, isTie, votedPlayer, votedOutWasImpostor }) => {
    voteTotals.innerHTML = '<h4>Individual Votes</h4><ul style="list-style:none;padding:0;">';
    votes.forEach(v => {
        voteTotals.innerHTML += `<li style="margin-bottom:0.25rem;">${v.voterName} → ${v.targetName}</li>`;
    });
    voteTotals.innerHTML += '</ul><h4>Vote Count</h4><ul style="list-style:none;padding:0;">';
    for (let p in tallies) {
        voteTotals.innerHTML += `<li style="margin-bottom:0.25rem;">${p} &mdash; <strong>${tallies[p]}</strong></li>`;
    }
    voteTotals.innerHTML += '</ul>';

    hostTieControls.classList.add('hidden');

    if (isTie) {
        voteConclusion.textContent = "It's a tie.";
        voteConclusion.style.color = "orange";
        if (isHost) {
            hostTieControls.classList.remove('hidden');
        }
    } else {
        if (votedOutWasImpostor) {
            voteConclusion.innerHTML = `${votedPlayer} received the most votes.<br><span style="color:green;">They WERE the Impostor!</span>`;
        } else {
            voteConclusion.innerHTML = `${votedPlayer} received the most votes.<br><span style="color:red;">They were NOT the Impostor.</span>`;
        }
        if (isHost) {
            hostPostGameControls.classList.remove('hidden');
        }
    }

    showScreen(voteResultScreen);
});

socket.on('revealImpostor', ({ actualImpostor }) => {
    voteConclusion.innerHTML = `The round has ended.<br><span style="color:blue;">The Impostor was ${actualImpostor}.</span>`;
    hostTieControls.classList.add('hidden');
    if (isHost) {
        hostPostGameControls.classList.remove('hidden');
    }
});

revoteBtn.addEventListener('click', () => {
    socket.emit('revote', { roomCode: currentRoomCode });
});

endRoundBtn.addEventListener('click', () => {
    socket.emit('endRoundTie', { roomCode: currentRoomCode });
});

// ------------- POST-GAME PHASE ------------- //

revealImpostorBtn.addEventListener('click', () => {
    socket.emit('revealImpostorAndWords', { roomCode: currentRoomCode });
});

socket.on('impostorRevealed', (data) => {
    revealImpostorName.textContent = data.impostor;
    revealNormalWord.textContent = data.normalWord;
    revealImpostorWord.textContent = data.impostorWord;
    fullRevealInfo.classList.remove('hidden');
});

postGameClueBtn.addEventListener('click', () => {
    socket.emit('startAnotherClueRound', { roomCode: currentRoomCode });
});

postGameVoteBtn.addEventListener('click', () => {
    socket.emit('startAnotherVotingRound', { roomCode: currentRoomCode });
});

postGameNewBtn.addEventListener('click', () => {
    socket.emit('startNewWordGame', { roomCode: currentRoomCode });
});

socket.on('cluePhaseStarted', () => {
    hostPostGameControls.classList.add('hidden');
    hostTieControls.classList.add('hidden');
    
    clueInput.value = '';
    allSubmittedMessage.classList.add('hidden');
    hostClueControls.classList.add('hidden');
    
    socket.emit('requestCurrentClues', { roomCode: currentRoomCode });
    
    showScreen(clueScreen);
});

socket.on('newWordGameStarted', () => {
    hostPostGameControls.classList.add('hidden');
    hostTieControls.classList.add('hidden');
    
    if (isHost) {
        normalWordInput.value = '';
        impostorWordInput.value = '';
        impostorSelect.value = '';
    }
    
    showScreen(lobbyScreen);
});
