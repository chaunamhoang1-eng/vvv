import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

async function loadLeaderboard() {
    const tbody = document.getElementById("leaderboardTable");
    const filter = document.getElementById("difficultyFilter");
    if (!tbody || !filter) return; // Safety check

    tbody.innerHTML = "";

    // Wait until Firebase Auth user is available
    const auth = getAuth();
    let user = auth.currentUser;

    if (!user) {
        return setTimeout(loadLeaderboard, 300);
    }

    const token = await user.getIdToken();
    const difficulty = filter.value;

    try {
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

    } catch (err) {
        console.error("Leaderboard fetch error:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadLeaderboard();
    document.getElementById("difficultyFilter").addEventListener("change", loadLeaderboard);
});
