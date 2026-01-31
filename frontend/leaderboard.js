async function loadLeaderboard() {
    const diff = document.getElementById("difficulty").value;

    const res = await fetch(`/api/sudoku/leaderboard?difficulty=${diff}`);
    const data = await res.json();

    const tbody = document.getElementById("leaderboardTable");
    tbody.innerHTML = "";

    data.leaderboard.forEach((s, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${s.nickname}</td>
            <td>${s.time}s</td>
            <td>${s.mistakes}</td>
            <td>${new Date(s.createdAt).toLocaleDateString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

loadLeaderboard();
