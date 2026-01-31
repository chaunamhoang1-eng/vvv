/* ============================================================
   FULL OFFLINE SUDOKU GENERATOR + SOLVER
   No API required. Generates puzzles locally.
============================================================ */

let puzzle = [];
let solution = [];
let seconds = 0;
let mistakes = 0;
let timerInterval;

/* ---------------- TIMER ---------------- */
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds++;
        let m = String(Math.floor(seconds / 60)).padStart(2, "0");
        let s = String(seconds % 60)).padStart(2, "0");
        document.getElementById("timer").innerHTML = `⏳ Timer: ${m}:${s}`;
    }, 1000);
}

/* ---------------- SHUFFLE HELPER ---------------- */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* ---------------- GENERATE SOLVED BOARD ---------------- */
function generateSolvedBoard() {
    let board = Array(9).fill().map(() => Array(9).fill(0));

    function isSafe(row, col, num) {
        for (let x = 0; x < 9; x++) {
            if (board[row][x] === num || board[x][col] === num) return false;
        }
        let r = row - row % 3;
        let c = col - col % 3;
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++)
                if (board[i + r][j + c] === num) return false;

        return true;
    }

    function solveBoard() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0) {
                    let numbers = shuffle([1,2,3,4,5,6,7,8,9]);
                    for (let num of numbers) {
                        if (isSafe(row, col, num)) {
                            board[row][col] = num;
                            if (solveBoard()) return true;
                            board[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    solveBoard();
    return board;
}

/* ---------------- REMOVE CELLS TO MAKE PUZZLE ---------------- */
function generatePuzzle(solved, difficulty) {
    let puzzle = solved.map(row => row.slice());

    let removals = difficulty === "easy" ? 40 :
                   difficulty === "medium" ? 50 : 60;

    while (removals > 0) {
        let r = Math.floor(Math.random() * 9);
        let c = Math.floor(Math.random() * 9);
        if (puzzle[r][c] !== 0) {
            puzzle[r][c] = 0;
            removals--;
        }
    }
    return puzzle;
}

/* ---------------- NEW GAME ---------------- */
function newGame() {
    seconds = 0;
    mistakes = 0;

    let diff = document.getElementById("difficulty").value;

    solution = generateSolvedBoard();
    puzzle = generatePuzzle(solution, diff);

    document.getElementById("mistakes").innerHTML = "Mistakes: 0/5";
    document.getElementById("timer").innerHTML = "⏳ Timer: 00:00";

    renderBoard();
    startTimer();
}

/* ---------------- RENDER BOARD ---------------- */
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
            };

            cell.appendChild(input);
            row.appendChild(cell);
        }

        board.appendChild(row);
    }
}

/* ---------------- CHECK VALUE ---------------- */
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

/* ---------------- CHECK WIN ---------------- */
function checkWin() {
    const inputs = document.querySelectorAll(".cell input");
    let index = 0;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (inputs[index].value != solution[r][c]) return;
            index++;
        }
    }

    clearInterval(timerInterval);
    alert("🎉 YOU WON!");
}

/* ---------------- SOLVE ---------------- */
function solve() {
    const inputs = document.querySelectorAll(".cell input");
    let index = 0;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            inputs[index].value = solution[r][c];
            inputs[index].classList.remove("wrong");
            index++;
        }
    }
}

window.onload = newGame;
