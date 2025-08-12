let currentPlayerId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    currentPlayerId = parseInt(params.get('id'));

    if (!currentPlayerId) {
        document.querySelector('.container').innerHTML = '<h2>Jugador no encontrado</h2><p>Por favor, seleccione un jugador válido desde la barra de búsqueda.</p>';
        return;
    }

    const { data: player, error } = await supabase.from('players').select('*, categories(name), teams(name)').eq('id', currentPlayerId).single();
    
    if (error || !player) {
        document.querySelector('.container').innerHTML = '<h2>Jugador no encontrado</h2>';
        console.error("Error fetching player:", error);
        return;
    }

    await renderDashboard(player);
});

async function renderDashboard(player) {
    document.getElementById('player-name-title').textContent = player.name;
    document.getElementById('player-details-subtitle').textContent = 
        `${player.categories ? player.categories.name : 'Sin Categoría'} - ${player.teams ? player.teams.name : 'Sin Equipo'}`;

    const stats = await calculatePlayerStats(player.id);
    renderPlayerStats(stats);
    renderWinLossChart(stats);

    await renderTournamentsList(player.id);
    await renderMatchesList(player.id, 'all');
}

async function calculatePlayerStats(playerId) {
    const { data: matches, error } = await supabase.from('matches').select('winner_id, player1_id, player2_id').or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
    if (error) return { played: 0, pending: 0, wins: 0, losses: 0, winRate: 0 };
    
    const completed = matches.filter(m => m.winner_id);
    const pending = matches.filter(m => !m.winner_id);
    const wins = completed.filter(m => m.winner_id === playerId).length;
    const losses = completed.length - wins;
    const winRate = completed.length > 0 ? ((wins / completed.length) * 100).toFixed(0) : 0;
    
    return { played: completed.length, pending: pending.length, wins, losses, winRate };
}

function renderPlayerStats(stats) {
    const container = document.getElementById('player-stats');
    container.innerHTML = `
        <div id="stat-played" class="stat-card mini active" onclick="filterMatches('all')">
            <h4>Jugados</h4><p>${stats.played}</p>
        </div>
        <div id="stat-wins" class="stat-card mini" onclick="filterMatches('wins')">
            <h4>Victorias</h4><p class="text-success">${stats.wins}</p>
        </div>
        <div id="stat-losses" class="stat-card mini" onclick="filterMatches('losses')">
            <h4>Derrotas</h4><p class="text-danger">${stats.losses}</p>
        </div>
        <div class="stat-card mini">
            <h4>Pendientes</h4><p class="text-pending">${stats.pending}</p>
        </div>
    `;
}

function renderWinLossChart(stats) {
    const ctx = document.getElementById('win-loss-chart').getContext('2d');
    if (window.winLossChart instanceof Chart) {
        window.winLossChart.destroy();
    }
    // La variable `Chart` ahora existe gracias al orden correcto de los scripts en el HTML
    window.winLossChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Victorias', 'Derrotas'],
            datasets: [{
                data: [stats.wins, stats.losses],
                backgroundColor: ['rgba(48, 209, 88, 0.8)', 'rgba(255, 69, 58, 0.8)'],
                borderColor: ['#30d158', '#ff453a'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#e1e1e1', font: { family: "'Poppins', sans-serif" } } },
                tooltip: { callbacks: { label: (c) => `${c.label || ''}: ${c.parsed || 0}` } }
            },
            cutout: '60%'
        }
    });
}

async function renderTournamentsList(playerId) {
    const container = document.getElementById('tournaments-list');
    container.innerHTML = '';
    const { data: tournamentsData } = await supabase.from('tournament_players').select('tournaments(*, categories(name))').eq('player_id', playerId);
    
    if (!tournamentsData || tournamentsData.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No está inscrito en ningún torneo.</p>';
        return;
    }
    
    tournamentsData.forEach(item => {
        const tournament = item.tournaments;
        if (!tournament) return;
        const link = document.createElement('a');
        // AQUI ESTÁ EL CAMBIO: Se añade el ID del jugador al enlace
        link.href = `rankings.html?tournamentId=${tournament.id}&highlightPlayerId=${playerId}`;
        link.className = 'list-item-simple interactive';
        link.innerHTML = `<span><strong>${tournament.name}</strong> (${tournament.categories.name})</span><span>&rarr;</span>`;
        container.appendChild(link);
    });
}

async function renderMatchesList(playerId, filter = 'all') {
    const container = document.getElementById('matches-list');
    container.innerHTML = '<p class="placeholder-text">Cargando partidos...</p>';
    
    const { data: allMatches } = await supabase.from('matches').select('*, player1:player1_id(name), player2:player2_id(name), tournaments(name)').or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
    
    if (!allMatches) {
        container.innerHTML = '<p class="placeholder-text">No tiene partidos registrados.</p>';
        return;
    }

    const completed = allMatches.filter(m => m.winner_id);
    const pending = allMatches.filter(m => !m.winner_id);

    let filteredCompleted = completed;
    if (filter === 'wins') {
        filteredCompleted = completed.filter(m => m.winner_id === playerId);
    } else if (filter === 'losses') {
        filteredCompleted = completed.filter(m => m.winner_id !== playerId);
    }
    
    pending.sort((a, b) => new Date(b.match_date) - new Date(a.match_date));
    filteredCompleted.sort((a, b) => new Date(b.match_date) - new Date(a.match_date));

    container.innerHTML = '';
    if (pending.length > 0) {
        container.innerHTML += '<h4>Pendientes</h4>';
        pending.forEach(match => container.appendChild(createMatchListItem(match, playerId)));
    }
    if (filteredCompleted.length > 0) {
        container.innerHTML += '<h4 style="margin-top: 1.5rem;">Completados</h4>';
        filteredCompleted.forEach(match => container.appendChild(createMatchListItem(match, playerId)));
    }
    if (pending.length === 0 && filteredCompleted.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No hay partidos para mostrar.</p>';
    }
}

function filterMatches(filterType) {
    document.querySelectorAll('.stat-card.mini[onclick]').forEach(card => card.classList.remove('active'));
    
    if (filterType === 'all') document.getElementById('stat-played').classList.add('active');
    if (filterType === 'wins') document.getElementById('stat-wins').classList.add('active');
    if (filterType === 'losses') document.getElementById('stat-losses').classList.add('active');
    
    renderMatchesList(currentPlayerId, filterType);
}

function createMatchListItem(match, playerId) {
    const opponent = match.player1_id === playerId ? match.player2 : match.player1;
    const tournament = match.tournaments;
    
    const isWinner = match.winner_id === playerId;
    const resultText = match.winner_id ? (isWinner ? 'Victoria' : 'Derrota') : 'Pendiente';
    const resultClass = match.winner_id ? (isWinner ? 'text-success' : 'text-danger') : 'text-pending';
    
    const score = (match.sets || []).map(s => `${s.p1}-${s.p2}`).join(', ');

    const div = document.createElement('div');
    div.className = 'list-item-simple match-history-item';
    div.innerHTML = `
        <div class="match-history-info">
            <span>vs <strong>${opponent ? opponent.name : 'N/A'}</strong></span>
            <small>${tournament ? tournament.name : 'N/A'} - ${new Date(match.match_date).toLocaleDateString()}</small>
        </div>
        <div class="match-history-result">
            <span class="${resultClass}">${resultText}</span>
            ${score ? `<small>${score}</small>` : ''}
        </div>
    `;
    return div;
}