import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

async function loadLeaderboard() {
    const tbody = document.getElementById("leaderboardTable");
    tbody.innerHTML = "";

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        console.log("User not logged in yet...");
        return setTimeout(loadLeaderboard, 500); // wait for Firebase
    }

    const token = await user.getIdToken();

    const difficulty = document.getElementById("difficultyFilter").value;

    const res = await fetch(`/api/sudoku/leaderboard?difficulty=${difficulty}`, {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    if (!res.ok) {
        console.error("Failed to fetch leaderboard", res.status);
        return;
    }

    const data = await res.json();

    data.forEach((row, index) => {
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

// Load on page open
document.addEventListener("DOMContentLoaded", loadLeaderboard);

// Reload on filter change
document.getElementById("difficultyFilter").addEventListener("change", loadLeaderboard);
