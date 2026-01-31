/* ================= 6×6 MINI SUDOKU ================= */

const SIZE = 6;
const BOX_R = 2;
const BOX_C = 3;
const DIGITS = [1,2,3,4,5,6];

let puzzle = [];
let solution = [];
let seconds = 0;
let mistakes = 0;
let timer;

/* ------------ SHUFFLE ------------ */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------ SAFE CHECK ------------ */
function isSafe(board, row, col, num) {
  for (let c = 0; c < SIZE; c++)
    if (board[row][c] === num) return false;

  for (let r = 0; r < SIZE; r++)
    if (board[r][col] === num) return false;

  let br = row - (row % BOX_R);
  let bc = col - (col % BOX_C);

  for (let r = 0; r < BOX_R; r++)
    for (let c = 0; c < BOX_C; c++)
      if (board[br+r][bc+c] === num) return false;

  return true;
}

/* ------------ SOLVER ------------ */
function solveBoard(board) {
  for (let r=0; r<SIZE; r++) {
    for (let c=0; c<SIZE; c++) {
      if (board[r][c] === 0) {
        let nums = shuffle([...DIGITS]);
        for (let n of nums) {
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

/* ------------ GENERATE SOLVED ------------ */
function generateSolved() {
  let board = Array(SIZE).fill().map(()=>Array(SIZE).fill(0));
  solveBoard(board);
  return board;
}

/* ------------ GENERATE PUZZLE ------------ */
function generatePuzzle(solved, difficulty) {
  let puzzle = solved.map(r => r.slice());
  let remove = difficulty === "easy" ? 10 :
               difficulty === "medium" ? 14 : 18;

  while (remove > 0) {
    let r = Math.floor(Math.random() * SIZE);
    let c = Math.floor(Math.random() * SIZE);
    if (puzzle[r][c] !== 0) {
      puzzle[r][c] = 0;
      remove--;
    }
  }
  return puzzle;
}

/* ------------ NEW GAME ------------ */
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

/* ------------ RENDER BOARD ------------ */
function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  for (let r=0; r<SIZE; r++) {
    const row = document.createElement("div");
    row.className = "row";

    for (let c=0; c<SIZE; c++) {
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
        checkValue(r, c, input);
      };

      cell.appendChild(input);
      row.appendChild(cell);
    }
    board.appendChild(row);
  }
}

/* ------------ DISABLE BOARD ------------ */
function disableBoard() {
  const inputs = document.querySelectorAll(".cell input");
  inputs.forEach(inp => inp.disabled = true);
}

/* ------------ TIMER ------------ */
function startTimer() {
  timer = setInterval(() => {
    seconds++;
    let m = String(Math.floor(seconds / 60)).padStart(2,"0");
    let s = String(seconds % 60).padStart(2,"0");
    document.getElementById("timer").innerHTML = `⏳ ${m}:${s}`;
  }, 1000);
}

/* ------------ CHECK VALUE ------------ */
function checkValue(r, c, inp) {
  if (inp.value == solution[r][c]) {

    // Correct value
    inp.classList.remove("wrong");
    checkWin();

  } else {

    // Wrong value
    mistakes++;
    inp.classList.add("wrong");
    document.getElementById("mistakes").innerHTML = `Mistakes: ${mistakes}/5`;

    showWrongPopup();   // Instant wrong popup

    if (mistakes >= 5) {
      showLossPopup();  // Game over popup
    }
  }
}

/* ------------ WRONG POPUP ------------ */
function showWrongPopup() {
  clearInterval(timer);
  disableBoard();

  document.getElementById("finalTime").innerHTML =
    `❌ Wrong Value!<br>Mistakes: ${mistakes}/5<br>⏳ Time: ${seconds}s`;

  document.getElementById("popup").style.display = "block";
}

/* ------------ LOSS POPUP (5/5 mistakes) ------------ */
function showLossPopup() {
  clearInterval(timer);
  disableBoard();

  document.getElementById("finalTime").innerHTML =
    `💀 Game Over!<br>You reached 5 mistakes.<br>⏳ Time: ${seconds}s`;

  document.getElementById("popup").style.display = "block";
}

/* ------------ WIN CHECK ------------ */
function checkWin() {
  const inputs = document.querySelectorAll(".cell input");
  let index=0;

  for (let r=0; r<SIZE; r++)
    for (let c=0; c<SIZE; c++)
      if (inputs[index++].value != solution[r][c])
        return;

  clearInterval(timer);
  disableBoard();

  confetti({ particleCount: 150, spread: 70 });

  document.getElementById("finalTime").innerHTML =
    `🎉 Congratulations!<br>You solved the Sudoku!<br>⏱ Time: ${seconds}s`;

  document.getElementById("popup").style.display = "block";
}

/* ------------ CLOSE POPUP ------------ */
function closePopup() {
  document.getElementById("popup").style.display = "none";
}

/* ------------ SOLVE BUTTON ------------ */
function solve() {
  clearInterval(timer);

  const inputs = document.querySelectorAll(".cell input");
  let index=0;

  for (let r=0; r<SIZE; r++)
    for (let c=0; c<SIZE; c++)
      inputs[index++].value = solution[r][c];

  disableBoard();
}

/* ------------ NIGHT MODE ------------ */
function toggleNight() {
  document.body.classList.toggle("night");
}

window.onload = newGame;
