/* ==================== GLOBAL VARIABLES ==================== */
let puzzle = [];
let solution = [];
let seconds = 0;
let mistakes = 0;
let timerInterval;

/* ==================== TIMER ==================== */
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds++;
        let m = String(Math.floor(seconds / 60)).padStart(2, "0");
        let s = String(seconds % 60)).padStart(2, "0");
        document.getElementById("timer").innerHTML = `⏳ Timer: ${m}:${s}`;
    }, 1000);
}

/* ==================== NEW GAME ==================== */
async function newGame() {
    try {
        const diff = document.getElementById("difficulty").value;

        const res = await fetch(`https://youdosudoku.com/api/generate?difficulty=${diff}`);
        const data = await res.json();

        const puzzleStr = data.puzzle;
        const solutionStr = data.solution;

        puzzle = [];
        solution = [];

        // Convert into 9×9 arrays
        for (let i = 0; i < 81; i += 9) {
            puzzle.push(puzzleStr.slice(i, i + 9).split(""));
            solution.push(solutionStr.slice(i, i + 9).split(""));
        }

        seconds = 0;
        mistakes = 0;

        document.getElementById("mistakes").innerText = "Mistakes: 0/5";
        document.getElementById("timer").innerHTML = "⏳ Timer: 00:00";

        renderBoard();
        startTimer();

    } catch (err) {
        console.error("API ERROR:", err);
        alert("Sudoku API temporarily unavailable. Try again.");
    }
}

/* ==================== RENDER BOARD ==================== */
function renderBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";

    for (let r = 0; r < 9; r++) {
        const row = document.createElement("div");
        row.className = "row";

        for (let c = 0; c < 9; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";

            const input = document.createElement("input");

            if (puzzle[r][c] !== "0") {
                input.value = puzzle[r][c];
                input.disabled = true;
                cell.classList.add("given");
            }

            input.oninput = () => {
                input.value = input.value.replace(/[^1-9]/g, "");
                checkValue(r, c, input);
            };

            cell.appendChild(input);
            row.appendChild(cell);
        }

        board.appendChild(row);
    }
}

/* ==================== CHECK INPUT ==================== */
function checkValue(r, c, input) {
    if (input.value === solution[r][c]) {
        input.classList.remove("wrong");
        checkWin();
    } else {
        input.classList.add("wrong");
        mistakes++;
        document.getElementById("mistakes").innerHTML = `Mistakes: ${mistakes}/5`;
    }
}

/* ==================== CHECK WIN ==================== */
async function checkWin() {
    const inputs = document.querySelectorAll(".cell input");
    for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].value !== solution[Math.floor(i / 9)][i % 9]) return;
    }

    // Confetti animation
    for (let i = 0; i < 5; i++) {
        setTimeout(() => confetti({ particleCount: 100, spread: 80 }), i * 150);
    }

    clearInterval(timerInterval);

    document.getElementById("finalTime").innerText = `⏱ Time: ${seconds}s`;
    document.getElementById("finalMistakes").innerText = `❌ Mistakes: ${mistakes}`;
    document.getElementById("victoryPopup").style.display = "block";

    const nickname = document.getElementById("nickname").value || "Player";
    const difficulty = document.getElementById("difficulty").value;
    const email = localStorage.getItem("email") || "guest@example.com";

    await fetch("/api/sudoku/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email,
            nickname,
            difficulty,
            time: seconds,
            mistakes
        })
    });
}

/* ==================== SOLVE BUTTON ==================== */
function solve() {
    const inputs = document.querySelectorAll(".cell input");
    let index = 0;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            inputs[index].value = solution[r][c];
            index++;
        }
    }
}

/* ==================== CLOSE POPUP ==================== */
function closeVictory() {
    document.getElementById("victoryPopup").style.display = "none";
}

window.onload = newGame;
