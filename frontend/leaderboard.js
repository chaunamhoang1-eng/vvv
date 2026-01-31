import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

async function loadLeaderboard() {
    const tbody = document.getElementById("leaderboardTable");
    tbody.innerHTML = "";

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        return setTimeout(loadLeaderboard, 500);
    }

    const token = await user.getIdToken();
    const difficulty = document.getElementById("difficultyFilter").value;

    const res = await fetch(`/api/sudoku/leaderboard?difficulty=${difficulty}`, {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();

    if (!data.success) {
        console.error("Leaderboard error:", data.error);
        return;
    }

    data.leaderboard.forEach((row, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${row.nickname}</td>
            <td>${row.time}s</td>
            <td>${row.mistakes}</td>
            <td>${new Date(row.createdAt).toLocaleDateString()}</td>
        `;

        tbody.appendChild(tr);
    });
}

document.addEventListener("DOMContentLoaded", loadLeaderboard);
document.getElementById("difficultyFilter").addEventListener("change", loadLeaderboard);
