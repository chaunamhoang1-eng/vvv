let puzzle = [];
let solution = [];
let seconds = 0;
let mistakes = 0;
let notesMode = false;
let nightMode = false;
let timer;

/* ===== SHUFFLE ===== */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* ===== GENERATE SOLVED BOARD ===== */
function generateSolved() {
    let board = Array(9).fill().map(() => Array(9).fill(0));

    function isSafe(r, c, n) {
        for (let i = 0; i < 9; i++)
            if (board[r][i] === n || board[i][c] === n) return false;

        let br = r - r % 3, bc = c - c % 3;
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++)
                if (board[br + i][bc + j] === n) return false;

        return true;
    }

    function fill() {
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (board[r][c] === 0) {
                    let nums = shuffle([1,2,3,4,5,6,7,8,9]);
                    for (let n of nums) {
                        if (isSafe(r, c, n)) {
                            board[r][c] = n;
                            if (fill()) return true;
                            board[r][c] = 0;
                        }
                    }
                    return false;
                }
        return true;
    }

    fill();
    return board;
}

/* ===== GENERATE PUZZLE ===== */
function generatePuzzle(solved, difficulty) {
    let puzzle = solved.map(row => row.slice());
    let remove = difficulty === "easy" ? 40 : difficulty === "medium" ? 50 : 60;

    while (remove > 0) {
        let r = Math.floor(Math.random() * 9);
        let c = Math.floor(Math.random() * 9);
        if (puzzle[r][c] !== 0) {
            puzzle[r][c] = 0;
            remove--;
        }
    }
    return puzzle;
}

/* ===== NEW GAME ===== */
function newGame() {
    clearInterval(timer);
    seconds = 0;
    mistakes = 0;

    let diff = document.getElementById("difficulty").value;

    solution = generateSolved();
    puzzle = generatePuzzle(solution, diff);

    document.getElementById("mistakes").innerHTML = "Mistakes: 0/5";
    document.getElementById("timer").innerHTML = "⏳ Timer: 00:00";

    renderBoard();
    startTimer();
}

/* ===== TIMER ===== */
function startTimer() {
    timer = setInterval(() => {
        seconds++;
        let m = String(Math.floor(seconds / 60)).padStart(2,"0");
        let s = String(seconds % 60).padStart(2,"0");
        document.getElementById("timer").innerHTML = `⏳ Timer: ${m}:${s}`;
    }, 1000);
}

/* ===== RENDER BOARD ===== */
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

            if (puzzle[r][c] !== 0) {
                input.value = puzzle[r][c];
                input.disabled = true;
                cell.classList.add("given");
            }

            input.oninput = () => {
                input.value = input.value.replace(/[^1-9]/g, "");
                checkValue(r, c, input);
                highlightDuplicates();
            };

            cell.appendChild(input);
            row.appendChild(cell);
        }
        board.appendChild(row);
    }
}

/* ===== CHECK VALUE ===== */
function checkValue(r, c, input) {
    if (input.value == solution[r][c]) {
        input.classList.remove("wrong");
        checkWin();
    } else {
        input.classList.add("wrong");
        mistakes++;
        document.getElementById("mistakes").innerHTML = `Mistakes: ${mistakes}/5`;
    }
}

/* ===== DUPLICATE HIGHLIGHT ===== */
function highlightDuplicates() {
    const inputs = document.querySelectorAll(".cell input");
    let counts = {};

    inputs.forEach(inp => {
        if (inp.value) {
            counts[inp.value] = (counts[inp.value] || 0) + 1;
        }
    });

    inputs.forEach(inp => {
        if (inp.value && counts[inp.value] > 1) {
            inp.parentElement.classList.add("duplicate");
        } else {
            inp.parentElement.classList.remove("duplicate");
        }
    });
}

/* ===== NOTES MODE ===== */
function toggleNotes() {
    notesMode = !notesMode;
    alert("Notes mode: " + (notesMode ? "ON" : "OFF"));
}

/* ===== NIGHT MODE ===== */
function toggleNightMode() {
    nightMode = !nightMode;
    document.body.classList.toggle("night");
}

/* ===== CHECK WIN ===== */
function checkWin() {
    let index = 0;
    const inputs = document.querySelectorAll(".cell input");

    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (inputs[index++].value != solution[r][c])
                return;

    clearInterval(timer);

    for (let i = 0; i < 5; i++)
        setTimeout(() => confetti({ particleCount: 100, spread: 70 }), i * 200);

    document.getElementById("finalTime").innerHTML = "⏱ Time: " + seconds + "s";
    document.getElementById("finalMistakes").innerHTML = "❌ Mistakes: " + mistakes;
    document.getElementById("victoryPopup").style.display = "block";

    saveToLeaderboard();
}

/* ===== SAVE TO BACKEND ===== */
async function saveToLeaderboard() {
    const nickname = document.getElementById("nickname").value || "Player";
    const difficulty = document.getElementById("difficulty").value;
    const email = localStorage.getItem("email") || "guest@example.com";

    await fetch("/api/sudoku/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nickname,
            email,
            difficulty,
            time: seconds,
            mistakes
        })
    });
}

/* ===== CLOSE POPUP ===== */
function closeVictory() {
    document.getElementById("victoryPopup").style.display = "none";
}

/* ===== SOLVE BUTTON ===== */
function solve() {
    const inputs = document.querySelectorAll(".cell input");
    let idx = 0;

    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            inputs[idx++].value = solution[r][c];
}

window.onload = newGame;
