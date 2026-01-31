/* ===========================
     6×6 MINI SUDOKU ENGINE
   =========================== */

const SIZE = 6;
const BOX_R = 2;
const BOX_C = 3;
const DIGITS = [1, 2, 3, 4, 5, 6];

let puzzle = [];
let solution = [];
let timer;
let seconds = 0;
let mistakes = 0;

/* --------------------------------
   Utility: Shuffle an Array
----------------------------------- */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* --------------------------------
   Check if placing num is safe
----------------------------------- */
function isSafe(board, row, col, num) {

    // Row & Column check
    for (let c = 0; c < SIZE; c++) if (board[row][c] === num) return false;
    for (let r = 0; r < SIZE; r++) if (board[r][col] === num) return false;

    // Box check
    const br = row - (row % BOX_R);
    const bc = col - (col % BOX_C);

    for (let r = 0; r < BOX_R; r++)
        for (let c = 0; c < BOX_C; c++)
            if (board[br + r][bc + c] === num) return false;

    return true;
}

/* --------------------------------
   Full Solver (Backtracking)
----------------------------------- */
function solveBoard(board) {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {

            if (board[r][c] === 0) {

                for (let n of shuffle([...DIGITS])) {
                    if (isSafe(board, r, c, n)) {
                        board[r][c] = n;
                        if (solveBoard(board)) return true;
                        board[r][c] = 0;
                    }
                }

                return false;
            }
        }
    }
    return true;
}

/* --------------------------------
  Count Solutions (Unique Check)
----------------------------------- */
function countSolutions(board, counter) {

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {

            if (board[r][c] === 0) {
                for (let n of DIGITS) {
                    if (isSafe(board, r, c, n)) {
                        board[r][c] = n;
                        countSolutions(board, counter);
                        board[r][c] = 0;

                        if (counter.value > 1) return; // stop early
                    }
                }
                return;
            }
        }
    }

    counter.value++;
}

/* --------------------------------
   Ensure Unique Solution
----------------------------------- */
function hasUniqueSolution(board) {
    const copy = board.map(r => [...r]);
    const counter = { value: 0 };
    countSolutions(copy, counter);
    return counter.value === 1;
}

/* --------------------------------
   Generate a Full Valid Board
----------------------------------- */
function generateSolved() {
    const board = Array(SIZE)
        .fill()
        .map(() => Array(SIZE).fill(0));

    solveBoard(board);
    return board;
}

/* --------------------------------
   Generate Puzzle (Guaranteed Unique)
----------------------------------- */
function generatePuzzle(solved, difficulty) {

    const puzzle = solved.map(r => [...r]); // copy
    let removeCount =
        difficulty === "easy" ? 10 :
        difficulty === "medium" ? 14 : 18;

    while (removeCount > 0) {
        const r = Math.floor(Math.random() * SIZE);
        const c = Math.floor(Math.random() * SIZE);

        if (puzzle[r][c] !== 0) {
            const backup = puzzle[r][c];
            puzzle[r][c] = 0;

            if (!hasUniqueSolution(puzzle)) {
                puzzle[r][c] = backup; // restore
            } else {
                removeCount--;
            }
        }
    }

    return puzzle;
}

/* ===========================================
      NEW GAME
=========================================== */
function newGame() {

    clearInterval(timer);
    seconds = 0;
    mistakes = 0;

    const difficulty = document.getElementById("difficulty").value;

    solution = generateSolved();
    puzzle = generatePuzzle(solution, difficulty);

    document.getElementById("timer").innerHTML = "⏳ 00:00";
    document.getElementById("mistakes").innerHTML = "Mistakes: 0/5";

    renderBoard();
    startTimer();
}

/* ===========================================
      RENDER BOARD
=========================================== */
function renderBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";

    for (let r = 0; r < SIZE; r++) {

        const row = document.createElement("div");
        row.classList.add("row");

        for (let c = 0; c < SIZE; c++) {

            const cell = document.createElement("div");
            cell.classList.add("cell");

            const input = document.createElement("input");

            if (puzzle[r][c] !== 0) {
                input.value = puzzle[r][c];
                input.disabled = true;
                cell.classList.add("given");
            }

            input.oninput = () => {
                input.value = input.value.replace(/[^1-6]/g, "");
                if (input.value.length > 1) input.value = input.value[0];

                checkValue(r, c, input);
            };

            cell.appendChild(input);
            row.appendChild(cell);
        }

        board.appendChild(row);
    }
}

/* ===========================================
      Disable Board
=========================================== */
function disableBoard() {
    document.querySelectorAll(".cell input").forEach(i => i.disabled = true);
}

/* ===========================================
      Timer
=========================================== */
function startTimer() {
    timer = setInterval(() => {
        seconds++;
        const m = String(Math.floor(seconds / 60)).padStart(2, "0");
        const s = String(seconds % 60).padStart(2, "0");
        document.getElementById("timer").innerHTML = `⏳ ${m}:${s}`;
    }, 1000);
}

/* ===========================================
      Check Value
=========================================== */
function checkValue(r, c, inp) {

    if (inp.value == solution[r][c]) {
        inp.classList.remove("wrong");
        checkWin();
    } else {
        mistakes++;
        inp.classList.add("wrong");
        document.getElementById("mistakes").innerHTML =
            `Mistakes: ${mistakes}/5`;

        showWrongPopup();

        if (mistakes >= 5) showLossPopup();
    }
}

/* ===========================================
      Popups
=========================================== */
function showWrongPopup() {
    document.getElementById("popupTitle").innerHTML = "❌ Wrong Value!";
    document.getElementById("finalTime").innerHTML =
        `Mistakes: ${mistakes}/5<br>⏳ Time: ${seconds}s`;

    document.getElementById("popup").style.display = "block";
}

function showLossPopup() {
    clearInterval(timer);
    disableBoard();

    document.getElementById("popupTitle").innerHTML = "💀 Game Over!";
    document.getElementById("finalTime").innerHTML =
        `Reached 5 mistakes.<br>⏳ Time: ${seconds}s`;

    document.getElementById("popup").style.display = "block";
}

/* ===========================================
      Confetti (CSP-Safe)
=========================================== */
function confettiSafe() {
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.width = "100%";
    el.style.height = "0px";
    el.style.pointerEvents = "none";
    el.style.background = "transparent";
    document.body.appendChild(el);

    for (let i = 0; i < 80; i++) {
        const p = document.createElement("div");
        p.className = "confetti";
        p.style.left = Math.random() * 100 + "%";
        el.appendChild(p);

        setTimeout(() => p.remove(), 1500);
    }
}

/* ===========================================
      Win Condition
=========================================== */
function checkWin() {

    const inputs = document.querySelectorAll(".cell input");
    let idx = 0;

    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            if (inputs[idx++].value != solution[r][c])
                return;

    clearInterval(timer);
    disableBoard();

    confettiSafe();

    document.getElementById("popupTitle").innerHTML = "🎉 You Win!";
    document.getElementById("finalTime").innerHTML =
        `⏱ Time: ${seconds}s<br>Mistakes: ${mistakes}`;

    document.getElementById("popup").style.display = "block";
}

/* ===========================================
      Solve Button
=========================================== */
function solve() {
    clearInterval(timer);

    const inputs = document.querySelectorAll(".cell input");
    let idx = 0;

    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            inputs[idx++].value = solution[r][c];

    disableBoard();
}

/* ===========================================
      Misc
=========================================== */
function closePopup() {
    document.getElementById("popup").style.display = "none";
}

function toggleNight() {
    document.body.classList.toggle("night");
}

/* ===========================================
      Expose to HTML
=========================================== */
window.newGame = newGame;
window.solve = solve;
window.toggleNight = toggleNight;
window.closePopup = closePopup;
