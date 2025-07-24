// Lógica para la página de partidos (matches.html)
document.addEventListener('DOMContentLoaded', async () => {
    await populateTournamentSelect();
    await populateFilters();
    await renderMatchesList();
    
    document.getElementById('match-tournament').addEventListener('change', populatePlayerSelectsForMatch);
    document.getElementById('match-player1').addEventListener('change', handlePlayerSelectionChange);
    document.getElementById('match-player2').addEventListener('change', handlePlayerSelectionChange);
    document.getElementById('match-form').addEventListener('submit', handleMatchSubmit);
    
    document.getElementById('match-filter').addEventListener('change', renderMatchesList);
    document.getElementById('search-player-match').addEventListener('input', renderMatchesList);
    document.getElementById('filter-by-category').addEventListener('change', renderMatchesList);
    document.getElementById('filter-by-team').addEventListener('change', renderMatchesList);
});

async function populateTournamentSelect() {
    const select = document.getElementById('match-tournament');
    select.innerHTML = '<option value="">Seleccione torneo</option>';
    const { data: tournaments } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    if (tournaments) {
        tournaments.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
        });
    }
    await populatePlayerSelectsForMatch();
}

async function populateFilters() {
    const categoryFilter = document.getElementById('filter-by-category');
    const teamFilter = document.getElementById('filter-by-team');
    categoryFilter.innerHTML = '<option value="all">Todas las Categorías</option>';
    teamFilter.innerHTML = '<option value="all">Todos los Equipos</option>';
    const { data: categories } = await supabase.from('categories').select('*');
    if (categories) {
        categories.forEach(cat => {
            categoryFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    const { data: teams } = await supabase.from('teams').select('*');
    if (teams) {
        teams.forEach(team => {
            teamFilter.innerHTML += `<option value="${team.id}">${team.name}</option>`;
        });
    }
}

async function populatePlayerSelectsForMatch() {
    const tournamentId = document.getElementById('match-tournament').value;
    const p1Select = document.getElementById('match-player1');
    const p2Select = document.getElementById('match-player2');
    p1Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    p2Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    if (tournamentId) {
        const { data: tournamentPlayers } = await supabase.from('tournament_players').select('players(id, name)').eq('tournament_id', tournamentId);
        if (tournamentPlayers) {
            tournamentPlayers.forEach(tp => {
                if(tp.players) {
                    const option = `<option value="${tp.players.id}">${tp.players.name}</option>`;
                    p1Select.innerHTML += option;
                    p2Select.innerHTML += option;
                }
            });
        }
    }
}

async function handlePlayerSelectionChange() {
    const tournamentId = document.getElementById('match-tournament').value;
    const p1Select = document.getElementById('match-player1');
    const p2Select = document.getElementById('match-player2');
    const selectedP1 = p1Select.value;
    const selectedP2 = p2Select.value;
    if (!tournamentId) return;
    const { data: tournamentPlayers } = await supabase.from('tournament_players').select('players(id, name)').eq('tournament_id', tournamentId);
    if (!tournamentPlayers) return;
    const playersInTournament = tournamentPlayers.map(tp => tp.players).filter(Boolean);
    p2Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    playersInTournament.forEach(player => {
        if (player.id != selectedP1) {
            p2Select.innerHTML += `<option value="${player.id}">${player.name}</option>`;
        }
    });
    p2Select.value = selectedP2;
    p1Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    playersInTournament.forEach(player => {
        if (player.id != selectedP2) {
             p1Select.innerHTML += `<option value="${player.id}">${player.name}</option>`;
        }
    });
    p1Select.value = selectedP1;
}

async function handleMatchSubmit(event) {
    event.preventDefault();
    const tournamentId = parseInt(document.getElementById('match-tournament').value);
    const player1Id = parseInt(document.getElementById('match-player1').value);
    const player2Id = parseInt(document.getElementById('match-player2').value);
    const date = document.getElementById('match-date').value;
    const time = document.getElementById('match-time').value;
    const location = document.getElementById('match-location').value;
    if (!tournamentId || !player1Id || !player2Id || !date || !time || player1Id === player2Id || !location.trim()) {
        return showToast('Todos los campos son obligatorios.', 'error');
    }
    const { data: tournament } = await supabase.from('tournaments').select('category_id').eq('id', tournamentId).single();
    if (!tournament) return showToast('Error: Torneo no encontrado.', 'error');
    const { error } = await supabase.from('matches').insert([{ 
        tournament_id: tournamentId, player1_id: player1Id, player2_id: player2Id, 
        category_id: tournament.category_id, match_date: date, match_time: time, location: location
    }]);
    if(error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Partido creado con éxito.', 'success');
        await renderMatchesList();
        event.target.reset();
        await populatePlayerSelectsForMatch();
    }
}

async function renderMatchesList() {
    const tbody = document.getElementById('matches-list-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="placeholder-text">Cargando...</td></tr>';
    const statusFilter = document.getElementById('match-filter').value;
    const searchTerm = document.getElementById('search-player-match').value.toLowerCase();
    const categoryFilter = document.getElementById('filter-by-category').value;
    const teamFilter = document.getElementById('filter-by-team').value;

    let query = supabase.from('matches').select(`id, match_date, match_time, location, winner_id, submission_token, player1:player1_id(name, team_id), player2:player2_id(name, team_id), winner:winner_id(name), tournaments(name)`);
    if (statusFilter === 'pending') query = query.is('winner_id', null);
    if (statusFilter === 'completed') query = query.not('winner_id', 'is', null);
    if (categoryFilter !== 'all') query = query.eq('category_id', categoryFilter);

    const { data: matches, error } = await query.order('match_date', { ascending: false }).order('match_time', { ascending: false });
    if (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="placeholder-text">Error al cargar los partidos.</td></tr>';
        return;
    }

    let filteredMatches = matches;
    if (teamFilter !== 'all' || searchTerm) {
        filteredMatches = matches.filter(match => {
            const p1 = match.player1; const p2 = match.player2;
            if (!p1 || !p2) return false;
            const matchesTeam = teamFilter !== 'all' ? p1.team_id == teamFilter || p2.team_id == teamFilter : true;
            const matchesSearch = searchTerm ? p1.name.toLowerCase().includes(searchTerm) || p2.name.toLowerCase().includes(searchTerm) : true;
            return matchesTeam && matchesSearch;
        });
    }
    
    tbody.innerHTML = '';
    if (filteredMatches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="placeholder-text">No hay partidos que coincidan.</td></tr>';
        return;
    }

    filteredMatches.forEach(match => {
        const matchDateTime = `${new Date(match.match_date).toLocaleDateString()} ${match.match_time ? match.match_time.substring(0, 5) : ''}`;
        const mainRow = document.createElement('tr');
        mainRow.innerHTML = `
            <td>${matchDateTime}</td>
            <td>${match.tournaments.name}</td>
            <td><strong>${match.player1.name}</strong> vs <strong>${match.player2.name}</strong></td>
            <td>${match.location}</td>
            <td class="${match.winner ? 'winner-cell' : 'pending-cell'}">${match.winner ? match.winner.name : 'Pendiente'}</td>
            <td class="actions-cell">
                <button class="btn btn-secondary" onclick="shareMatchLink(${match.id}, '${match.submission_token}')">Compartir</button>
                <button class="btn btn-secondary" onclick="editMatchResult(${match.id}, '${match.submission_token}')">${match.winner ? 'Editar' : 'Cargar'}</button>
                <button class="btn btn-danger" onclick="deleteMatch(${match.id})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(mainRow);
    });
}

function shareMatchLink(matchId, token) {
    const url = `${window.location.origin.replace('/admin', '')}/submit-result.html?id=${matchId}&token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('¡Enlace para cargar resultado copiado!');
    }).catch(err => {
        showToast('Error al copiar el enlace.', 'error');
    });
}

// --- NUEVA FUNCIÓN: Abre la página de carga en una nueva pestaña ---
function editMatchResult(matchId, token) {
    const url = `${window.location.origin.replace('/admin', '')}/submit-result.html?id=${matchId}&token=${token}`;
    window.open(url, '_blank');
}

async function deleteMatch(id) {
    if (!confirm('¿Seguro que quieres eliminar este partido?')) return;
    const { error } = await supabase.from('matches').delete().eq('id', id);
    if(error) showToast(`Error: ${error.message}`, 'error');
    else {
        showToast('Partido eliminado.', 'success');
        await renderMatchesList();
    }
}