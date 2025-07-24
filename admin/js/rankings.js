document.addEventListener('DOMContentLoaded', () => {
    populateTournamentFilter();
    const container = document.getElementById('rankings-container');
    container.innerHTML = '<p class="placeholder-text">Seleccione un torneo para ver los rankings.</p>';
    document.getElementById('tournament-filter').addEventListener('change', renderRankings);
});

async function populateTournamentFilter() {
    const select = document.getElementById('tournament-filter');
    select.innerHTML = '<option value="" disabled selected>Seleccione un torneo...</option>';
    const { data: tournaments } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    if (tournaments) {
        tournaments.forEach(t => { select.innerHTML += `<option value="${t.id}">${t.name}</option>`; });
    }
}

async function renderRankings() {
    const tournamentId = document.getElementById('tournament-filter').value;
    const container = document.getElementById('rankings-container');
    container.innerHTML = '<div class="placeholder-text">Calculando rankings...</div>';

    if (!tournamentId) {
        container.innerHTML = '<p class="placeholder-text">Seleccione un torneo para ver los rankings.</p>';
        return;
    }

    const { data: tournamentPlayersLinks } = await supabase.from('tournament_players').select('player_id').eq('tournament_id', tournamentId);
    if (!tournamentPlayersLinks || tournamentPlayersLinks.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Este torneo no tiene jugadores inscritos.</p>';
        return;
    }
    const playerIds = tournamentPlayersLinks.map(link => link.player_id);

    const { data: playersInTournament } = await supabase.from('players').select('*, teams(name), categories(id, name)').in('id', playerIds);
    const { data: matchesInTournament } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId).not('winner_id', 'is', null);

    const stats = calculateStats(playersInTournament || [], matchesInTournament || []);
    const categoriesInTournament = [...new Map(playersInTournament.map(p => [p.category_id, p.categories])).values()];

    container.innerHTML = '';
    if (stats.every(s => s.pj === 0)) {
        container.innerHTML = '<p class="placeholder-text">Aún no hay partidos completados en este torneo para mostrar un ranking.</p>';
        return;
    }

    categoriesInTournament.forEach(category => {
        let categoryStats = stats.filter(s => s.categoryId === category.id);
        if (categoryStats.length === 0) return;
        const categoryTitle = document.createElement('h3');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = category.name;
        container.appendChild(categoryTitle);
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-wrapper';
        tableContainer.innerHTML = generateRankingsHTML(categoryStats);
        container.appendChild(tableContainer);
    });
}

function calculateStats(players, matches) {
    const stats = players.map(player => ({
        playerId: player.id, name: player.name, categoryId: player.category_id, teamName: player.teams ? player.teams.name : 'N/A',
        pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, gg: 0, gp: 0, bonus: 0, puntos: 0,
    }));
    matches.forEach(match => {
        const p1Stat = stats.find(s => s.playerId === match.player1_id);
        const p2Stat = stats.find(s => s.playerId === match.player2_id);
        if (!p1Stat || !p2Stat) return;
        p1Stat.pj++; p2Stat.pj++;
        let p1SetsWon = 0, p2SetsWon = 0;
        (match.sets || []).forEach(set => {
            p1Stat.gg += set.p1; p1Stat.gp += set.p2;
            p2Stat.gg += set.p2; p2Stat.gp += set.p1;
            if(set.p1 > set.p2) p1SetsWon++; else p2SetsWon++;
        });
        p1Stat.sg += p1SetsWon; p1Stat.sp += p2SetsWon;
        p2Stat.sg += p2SetsWon; p2Stat.sp += p1SetsWon;
        if (match.winner_id === p1Stat.playerId) {
            p1Stat.pg++; p2Stat.pp++; p1Stat.puntos += 2;
            if (match.bonus_loser) p2Stat.bonus += 1;
        } else {
            p2Stat.pg++; p1Stat.pp++; p2Stat.puntos += 2;
            if (match.bonus_loser) p1Stat.bonus += 1;
        }
    });
    stats.forEach(s => {
        s.puntos += s.bonus; s.difP = s.pg - s.pp; s.difS = s.sg - s.sp; s.difG = s.gg - s.gp;
        s.parcial = s.pj > 0 ? (s.puntos / s.pj) : 0;
        s.partidosParaPromediar = Math.max(s.pj, 8);
        s.promedio = s.pj > 0 ? (s.puntos / s.partidosParaPromediar) : 0;
    });
    stats.sort((a, b) => {
        if (b.promedio !== a.promedio) return b.promedio - a.promedio;
        if (b.difP !== a.difP) return b.difP - a.difP;
        if (b.difS !== a.difS) return b.difS - a.difS;
        if (b.difG !== a.difG) return b.difG - a.difG;
        return b.pj - a.pj;
    });
    return stats;
}

function generateRankingsHTML(stats) {
    let tableHTML = `
        <table class="matches-table ranking-table">
            <thead>
                <tr>
                    <th>Pos.</th><th>Jugador</th><th>P+</th><th>P-</th>
                    <th class="divider-left">Dif.</th><th class="divider-left">S+</th>
                    <th>S-</th><th class="divider-left">Dif.</th><th class="divider-left">G+</th>
                    <th>G-</th><th class="divider-left">Dif.</th><th class="divider-left">Bon.</th>
                    <th class="divider-left">Pts.</th><th class="divider-left">Parcial</th>
                    <th class="divider-left">Prom. %</th>
                </tr>
            </thead>
            <tbody>`;
    stats.forEach((s, index) => {
        tableHTML += `
            <tr>
                <td class="position">${index + 1}°</td>
                <td class="player-cell">
                    ${s.name}
                    ${s.teamName !== 'N/A' ? `<span class="team-name">(${s.teamName})</span>` : ''}
                </td>
                <td>${s.pg}</td><td>${s.pp}</td>
                <td class="divider-left"><span class="diff-value">${s.difP > 0 ? '+' : ''}${s.difP}</span></td>
                <td class="divider-left">${s.sg}</td><td>${s.sp}</td>
                <td class="divider-left"><span class="diff-value">${s.difS > 0 ? '+' : ''}${s.difS}</span></td>
                <td class="divider-left">${s.gg}</td><td>${s.gp}</td>
                <td class="divider-left"><span class="diff-value">${s.difG > 0 ? '+' : ''}${s.difG}</span></td>
                <td class="divider-left">${s.bonus}</td>
                <td class="divider-left points">${s.puntos}</td>
                <td class="divider-left">${s.parcial.toFixed(2)}</td>
                <td class="divider-left promedio">
                    ${s.promedio.toFixed(2)}
                    <span class="prom-divisor">${s.partidosParaPromediar}</span>
                </td>
            </tr>`;
    });
    tableHTML += '</tbody></table>';
    return tableHTML;
}