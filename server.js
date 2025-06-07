// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // Allows connections from localhost:3000, which is where your HTML files will be served from.
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files (your HTML, CSS, JS) from the current directory.
// This allows your browser to access detective_notebook.html and game_master_dashboard.html.
app.use(express.static(path.join(__dirname)));

// --- Game State Variables (stored in server memory) ---
let teamStates = {}; // Stores the current state of each team's notebook
let accusations = {}; // Stores details of any made accusations
let correctAnswer = { // Stores the correct solution set by the Game Master
    suspect: null,
    location: null,
    tool: null
};

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // When a new client connects (either a notebook or the GM dashboard),
    // send them the current state of the game.
    socket.emit('initial_state', { teamStates, accusations, correctAnswer });

    // Listen for updates from a team's notebook.
    socket.on('update_notebook_state', (data) => {
        const { teamId, state } = data;
        if (teamId && state) {
            teamStates[teamId] = state; // Update the server's record for this team
            // Broadcast the update to all connected clients (especially the GM dashboard)
            io.emit('team_state_updated', { teamId, state });
            console.log(`State updated for team: ${state.teamName || teamId}`);
        }
    });

    // Listen for the Game Master setting the correct answer.
    socket.on('set_correct_answer', (answer) => {
        correctAnswer = answer; // Update the server's stored correct answer
        // Notify all connected clients (useful if multiple GMs are present)
        io.emit('correct_answer_updated', correctAnswer);
        console.log("Correct answer set:", correctAnswer);
    });

    // Listen for a team making a final accusation.
    socket.on('make_accusation', (data) => {
        const { teamId, teamName, accusation } = data;
        if (teamId && accusation) {
            // Check if the accusation matches the correct answer set by the GM.
            const isCorrect = (
                correctAnswer.suspect === accusation.suspect &&
                correctAnswer.location === accusation.location &&
                correctAnswer.tool === accusation.tool
            );

            // Store the accusation along with its correctness.
            accusations[teamId] = { teamName: teamName || teamId, accusation, isCorrect };
            // Notify all connected clients (especially the GM dashboard) about the accusation.
            io.emit('accusation_made', { teamId, teamName: teamName || teamId, accusation, isCorrect });
            console.log(`Accusation made by team ${teamName || teamId}:`, accusation, `Correct: ${isCorrect}`);
        }
    });

    // Handle client disconnection.
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start the server listening on the defined port.
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Access Detective Notebooks at: http://localhost:${PORT}/detective_notebook.html`);
    console.log(`Access Game Master Dashboard at: http://localhost:${PORT}/game_master_dashboard.html`);
});