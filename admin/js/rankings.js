document.addEventListener('DOMContentLoaded', async () => {
    // AQUI ESTÁ EL CAMBIO: Leer parámetros de la URL
    const params = new URLSearchParams(window.location.search);
    const tournamentIdToSelect = params.get('tournamentId');
    const playerToHighlight = params.get('highlightPlayerId');

    await populateTournamentFilter();
    
    // Si viene un ID de torneo en la URL, lo seleccionamos y cargamos el ranking
    if (tournamentIdToSelect) {
        const select = document.getElementById('tournament-filter');
        select.value = tournamentIdToSelect;
        // Pasamos el ID del jugador a resaltar a la función que renderiza
        await renderRankings(playerToHighlight);
    } else {
        const container = document.getElementById('rankings-container');
        container.innerHTML = '<p class="placeholder-text">Seleccione un torneo para ver los rankings.</p>';
    }

    document.getElementById('tournament-filter').addEventListener('change', (event) => {
        // Al cambiar manualmente, no resaltamos a nadie
        renderRankings(null);
    });
});


async function populateTournamentFilter() {
    const select = document.getElementById('tournament-filter');
    select.innerHTML = '<option value="" disabled selected>Seleccione un torneo...</option>';
    const { data: tournaments } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    if (tournaments) {
        tournaments.forEach(t => { select.innerHTML += `<option value="${t.id}">${t.name}</option>`; });
    }
}

async function renderRankings(playerToHighlight = null) {
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

    const { data: playersInTournament } = await supabase.from('players').select('*, teams(name, image_url), categories(id, name)').in('id', playerIds);
    const { data: matchesInTournament } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId).not('winner_id', 'is', null);

    const stats = calculateStats(playersInTournament || [], matchesInTournament || []);
    const categoriesInTournament = [...new Map(playersInTournament.map(p => p && [p.category_id, p.categories]).filter(Boolean)).values()];

    container.innerHTML = '';
     if (categoriesInTournament.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No hay jugadores inscritos en este torneo.</p>';
        return;
    }

    categoriesInTournament.forEach(category => {
        let categoryStats = stats.filter(s => s.categoryId === category.id);
        if (categoryStats.length === 0 && playersInTournament.filter(p => p.category_id === category.id).length === 0) return;
        
        const categoryTitle = document.createElement('h3');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = category.name;
        container.appendChild(categoryTitle);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-wrapper';
        // AQUI ESTÁ EL CAMBIO: Pasamos el ID del jugador a la función que crea el HTML
        tableContainer.innerHTML = generateRankingsHTML(categoryStats, playerToHighlight);
        container.appendChild(tableContainer);
    });
}

function calculateStats(players, matches) {
    const stats = players.map(player => ({
        playerId: player.id, name: player.name, categoryId: player.category_id, 
        teamName: player.teams ? player.teams.name : 'N/A',
        teamImageUrl: player.teams ? player.teams.image_url : null,
        pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, gg: 0, gp: 0, bonus: 0, puntos: 0,
    }));

    matches.forEach(match => {
        const p1Stat = stats.find(s => s.playerId === match.player1_id);
        const p2Stat = stats.find(s => s.playerId === match.player2_id);
        if (!p1Stat || !p2Stat) return;
        
        p1Stat.pj++; 
        p2Stat.pj++;
        
        let p1SetsWon = 0, p2SetsWon = 0;
        (match.sets || []).forEach(set => {
            p1Stat.gg += set.p1; 
            p1Stat.gp += set.p2;
            p2Stat.gg += set.p2; 
            p2Stat.gp += set.p1;
            if(set.p1 > set.p2) p1SetsWon++; else p2SetsWon++;
        });

        p1Stat.sg += p1SetsWon; 
        p1Stat.sp += p2SetsWon;
        p2Stat.sg += p2SetsWon; 
        p2Stat.sp += p1SetsWon;

        if (match.winner_id === p1Stat.playerId) {
            p1Stat.pg++; 
            p2Stat.pp++; 
            p1Stat.puntos += 2;
            if (match.bonus_loser) p2Stat.bonus += 1;
        } else {
            p2Stat.pg++; 
            p1Stat.pp++; 
            p2Stat.puntos += 2;
            if (match.bonus_loser) p1Stat.bonus += 1;
        }
    });

    stats.forEach(s => {
        s.puntos += s.bonus; 
        s.difP = s.pg - s.pp;
        s.difS = s.sg - s.sp;
        s.difG = s.gg - s.gp;
        s.parcial = s.pj > 0 ? (s.puntos / s.pj) : 0;
        s.partidosParaPromediar = Math.max(s.pj, 8);
        s.promedio = s.pj > 0 ? (s.puntos / s.partidosParaPromediar) : 0;
    });

    stats.sort((a, b) => {
        if (a.pj === 0 && b.pj > 0) return 1;
        if (b.pj === 0 && a.pj > 0) return -1;
        if (b.promedio !== a.promedio) return b.promedio - a.promedio;
        if (b.difP !== a.difP) return b.difP - a.difP;
        if (b.difS !== a.difS) return b.difS - a.difS;
        if (b.difG !== a.difG) return b.difG - a.difG;
        return b.puntos - a.puntos;
    });

    return stats;
}

function generateRankingsHTML(stats, playerToHighlight = null) {
    let tableHTML = `
        <table class="matches-table ranking-table">
            <thead>
                <tr>
                    <th>Pos.</th>
                    <th>Jugador</th>
                    <th>P+</th>
                    <th>P-</th>
                    <th>Dif.</th>
                    <th class="divider-left">S+</th>
                    <th>S-</th>
                    <th>Dif.</th>
                    <th class="divider-left">G+</th>
                    <th>G-</th>
                    <th>Dif.</th>
                    <th class="divider-left">Bon.</th>
                    <th class="divider-left">Pts.</th>
                    <th class="divider-left">Parcial</th>
                    <th class="divider-left">Prom. %</th>
                </tr>
            </thead>
            <tbody>`;
    
    if (stats.length === 0) {
        tableHTML += '<tr><td colspan="15" style="text-align:center; padding: 2rem;">No hay jugadores en esta categoría.</td></tr>';
    } else {
        stats.forEach((s, index) => {
            const hasPlayed = s.pj > 0;
            const difPClass = s.difP < 0 ? 'negative' : '';
            const difSClass = s.difS < 0 ? 'negative' : '';
            const difGClass = s.difG < 0 ? 'negative' : '';

            // AQUI ESTÁ EL CAMBIO: Se añade la clase de resaltado si los IDs coinciden
            const highlightClass = s.playerId == playerToHighlight ? 'player-highlight' : '';

            tableHTML += `
                <tr class="${highlightClass}">
                    <td class="position">${index + 1}°</td>
                    <td class="player-cell">
                        <div class="player-cell-content">
                            <span>${s.name}</span>
                            ${s.teamImageUrl ? `<img src="${s.teamImageUrl}" class="team-logo-ranking" alt="${s.teamName}">` : ''}
                        </div>
                    </td>
                    <td>${hasPlayed ? s.pg : ''}</td>
                    <td>${hasPlayed ? s.pp : ''}</td>
                    <td><span class="diff-value ${difPClass}">${hasPlayed ? s.difP : ''}</span></td>
                    <td class="divider-left">${hasPlayed ? s.sg : ''}</td>
                    <td>${hasPlayed ? s.sp : ''}</td>
                    <td><span class="diff-value ${difSClass}">${hasPlayed ? s.difS : ''}</span></td>
                    <td class="divider-left">${hasPlayed ? s.gg : ''}</td>
                    <td>${hasPlayed ? s.gp : ''}</td>
                    <td><span class="diff-value ${difGClass}">${hasPlayed ? s.difG : ''}</span></td>
                    <td class="divider-left">${hasPlayed ? s.bonus : ''}</td>
                    <td class="divider-left points">${hasPlayed ? s.puntos : '0'}</td>
                    <td class="divider-left">${hasPlayed ? s.parcial.toFixed(2) : ''}</td>
                    <td class="divider-left promedio">
                        ${s.promedio.toFixed(2)}
                        <span class="prom-divisor">/${s.partidosParaPromediar}</span>
                    </td>
                </tr>`;
        });
    }
    tableHTML += '</tbody></table>';
    return tableHTML;
}