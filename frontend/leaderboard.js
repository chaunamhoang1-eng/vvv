async function loadLeaderboard() {
    const tbody = document.getElementById("leaderboardTable");
    const filter = document.getElementById("difficultyFilter");
    if (!tbody || !filter) return;

    tbody.innerHTML = "";

    const difficulty = filter.value;

    try {
        const res = await fetch(`/api/sudoku/leaderboard?difficulty=${difficulty}`);
        const data = await res.json();

        if (!data.success) return;

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
        console.error("Leaderboard load error:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadLeaderboard();
    document.getElementById("difficultyFilter").addEventListener("change", loadLeaderboard);
});
