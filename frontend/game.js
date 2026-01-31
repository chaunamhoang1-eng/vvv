/* ================= 6×6 MINI SUDOKU (FIXED GENERATOR) ================= */

const SIZE = 6;
const BOX_R = 2;
const BOX_C = 3;
const DIGITS = [1, 2, 3, 4, 5, 6];

let puzzle = [];
let solution = [];
let seconds = 0;
let mistakes = 0;
let timer;

/* ------------ SHUFFLE ARRAY ------------ */
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

/* ------------ SAFETY CHECK ------------ */
function isSafe(board, row, col, num) {
  // row
  for (let c = 0; c < SIZE; c++)
    if (board[row][c] === num) return false;

  // col
  for (let r = 0; r < SIZE; r++)
    if (board[r][col] === num) return false;

  // box
  let br = row - (row % BOX_R);
  let bc = col - (col % BOX_C);

  for (let r = 0; r < BOX_R; r++)
    for (let c = 0; c < BOX_C; c++)
      if (board[br + r][bc + c] === num) return false;

  return true;
}

/* ------------ SOLVER (BACKTRACK) ------------ */
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

/* ------------ COUNT SOLUTIONS ------------ */
function countSolutions(board) {
  let count = 0;

  function dfs(bd) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (bd[r][c] === 0) {

          for (let n of DIGITS) {
            if (isSafe(bd, r, c, n)) {
              bd[r][c] = n;
              dfs(bd);
              bd[r][c] = 0;
              if (count > 1) return;
            }
          }

          return;
        }
      }
    }
    count++;
  }

  dfs(board.map(r => [...r]));
  return count;
}

/* ------------ GENERATE FULL SOLUTION ------------ */
function generateSolved() {
  let board = Array(SIZE)
    .fill()
    .map(() => Array(SIZE).fill(0));

  solveBoard(board);
  return board;
}

/* ------------ GENERATE FAIR PUZZLE (FIXED) ------------ */
function generatePuzzle(solved, difficulty) {
  let puzzle = solved.map(r => [...r]);

  // how many to remove
  let remove =
    difficulty === "easy" ? 8 :
    difficulty === "medium" ? 12 : 16;

  let attempts = 0;

  while (remove > 0 && attempts < 200) {
    attempts++;

    let r = Math.floor(Math.random() * SIZE);
    let c = Math.floor(Math.random() * SIZE);

    if (puzzle[r][c] === 0) continue;

    let backup = puzzle[r][c];
    puzzle[r][c] = 0;

    // check unique solution
    if (countSolutions(puzzle) !== 1) {
      puzzle[r][c] = backup;
    } else {
      remove--;
    }
  }

  return puzzle;
}

/* ================= GAME LOGIC ================= */

function newGame() {
  clearInterval(timer);
  seconds = 0;
  mistakes = 0;

  let diff = document.getElementById("difficulty").value;

  solution = generateSolved();
  puzzle = generatePuzzle(solution, diff);

  document.getElementById("timer").innerHTML = "⏳ 00:00";
  document.getElementById("mistakes").innerHTML = "Mistakes: 0/5";

  renderBoard();
  startTimer();
}

function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  for (let r = 0; r < SIZE; r++) {
    const row = document.createElement("div");
    row.className = "row";

    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";

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

function disableBoard() {
  document.querySelectorAll(".cell input").forEach(inp => (inp.disabled = true));
}

function startTimer() {
  timer = setInterval(() => {
    seconds++;
    let m = String(Math.floor(seconds / 60)).padStart(2, "0");
    let s = String(seconds % 60).padStart(2, "0");
    document.getElementById("timer").innerHTML = `⏳ ${m}:${s}`;
  }, 1000);
}

function checkValue(r, c, inp) {
  if (inp.value == solution[r][c]) {
    inp.classList.remove("wrong");
    checkWin();
  } else {
    mistakes++;
    inp.classList.add("wrong");
    document.getElementById("mistakes").innerHTML = `Mistakes: ${mistakes}/5`;
    showWrongPopup();
    if (mistakes >= 5) showLossPopup();
  }
}

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
    `You reached 5 mistakes.<br>⏳ Time: ${seconds}s`;
  document.getElementById("popup").style.display = "block";
}

/* ------ SAVE SCORE (no auth required) ------ */
async function submitScore(time, mistakes, difficulty) {
  try {
    await fetch("/api/sudoku/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "",
        nickname: document.getElementById("nickname").value || "Unknown",
        time,
        mistakes,
        difficulty
      })
    });
  } catch (err) {
    console.error("Submit score error:", err);
  }
}

/* ------ LOCAL WIN EFFECT (CSP-SAFE) ------ */
function tinyWinEffect() {
  const el = document.createElement("div");
  el.innerHTML = "🎉";
  el.style.position = "fixed";
  el.style.top = "50%";
  el.style.left = "50%";
  el.style.fontSize = "50px";
  el.style.animation = "pop 0.8s ease-out";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function checkWin() {
  const inputs = document.querySelectorAll(".cell input");
  let idx = 0;

  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (inputs[idx++].value != solution[r][c]) return;

  clearInterval(timer);
  disableBoard();

  tinyWinEffect();

  document.getElementById("popupTitle").innerHTML = "🎉 You Win!";
  document.getElementById("finalTime").innerHTML =
    `⏱ Time: ${seconds}s<br>Mistakes: ${mistakes}`;
  document.getElementById("popup").style.display = "block";

  submitScore(seconds, mistakes, document.getElementById("difficulty").value);
}

function closePopup() {
  document.getElementById("popup").style.display = "none";
}

function solve() {
  clearInterval(timer);
  const inputs = document.querySelectorAll(".cell input");
  let idx = 0;

  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      inputs[idx++].value = solution[r][c];

  disableBoard();
}

function toggleNight() {
  document.body.classList.toggle("night");
}

window.newGame = newGame;
window.solve = solve;
window.toggleNight = toggleNight;
window.closePopup = closePopup;

