// Variable para mantener el estado del editor
let currentEditingState = {
    tournament: null,
    enrolledPlayers: [],
    availablePlayers: []
};

document.addEventListener('DOMContentLoaded', async () => {
    await renderTournamentsList();
    renderEditor(); // Renderiza el estado inicial (placeholder)

    document.getElementById('new-tournament-btn').addEventListener('click', () => {
        currentEditingState = { tournament: { id: null, name: '', category_id: '' }, enrolledPlayers: [], availablePlayers: [] };
        renderEditor();
    });
});

async function renderTournamentsList(activeTournamentId = null) {
    const container = document.getElementById('tournaments-list');
    container.innerHTML = '';
    const { data: tournaments, error } = await supabase.from('tournaments').select('*, categories(name), tournament_players(count)').order('created_at', { ascending: false });
    
    if (error || !tournaments || tournaments.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No hay torneos creados.</p>';
        return;
    }

    tournaments.forEach(t => {
        const div = document.createElement('div');
        div.className = `list-item ${t.id === activeTournamentId ? 'active' : ''}`;
        div.onclick = () => loadTournamentForEditing(t.id);
        
        const categoryName = t.categories ? t.categories.name : 'N/A';
        const playerCount = t.tournament_players[0] ? t.tournament_players[0].count : 0;
        
        div.innerHTML = `
            <div>
                <strong>${t.name}</strong>
                <div class="list-item-info">${categoryName} - ${playerCount} jugadores</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderEditor() {
    const container = document.getElementById('tournament-editor-content');
    const isNew = !currentEditingState.tournament || !currentEditingState.tournament.id;

    if (!currentEditingState.tournament) {
        container.innerHTML = `<div class="editor-placeholder">Selecciona un torneo para editar o crea uno nuevo.</div>`;
        return;
    }

    container.innerHTML = `
        <h3>${isNew ? 'Crear Nuevo Torneo' : 'Editando Torneo'}</h3>
        <form id="tournament-form" class="form-grid">
            <div class="form-group">
                <label for="tournament-name">Nombre del Torneo</label>
                <input type="text" id="tournament-name" value="${currentEditingState.tournament.name || ''}" required>
            </div>
            <div class="form-group">
                <label for="tournament-category">Categoría</label>
                <select id="tournament-category" required></select>
            </div>
        </form>
        <div class="player-management-grid">
            <div class="player-sublist">
                <h4>Jugadores Disponibles</h4>
                <div id="available-players"></div>
            </div>
            <div class="player-sublist">
                <h4>Jugadores Inscritos (${currentEditingState.enrolledPlayers.length})</h4>
                <div id="enrolled-players"></div>
            </div>
        </div>
        <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
            <button class="btn" onclick="handleSaveChanges()">Guardar Cambios</button>
            ${!isNew ? `<button class="btn btn-danger" onclick="deleteTournament(${currentEditingState.tournament.id})">Eliminar Torneo</button>` : ''}
        </div>
    `;

    populateEditorSelects();
    renderPlayerLists();
}

async function populateEditorSelects() {
    const select = document.getElementById('tournament-category');
    select.innerHTML = '<option value="">Seleccione</option>';
    const { data: categories } = await supabase.from('categories').select('*');
    if (categories) {
        categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    select.value = currentEditingState.tournament.category_id;
    select.onchange = handleCategoryChange;
}

async function loadTournamentForEditing(tournamentId) {
    const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
    if (!tournament) return;

    const { data: allPlayers } = await supabase.from('players').select('*').eq('category_id', tournament.category_id);
    const { data: enrolledLinks } = await supabase.from('tournament_players').select('player_id').eq('tournament_id', tournamentId);
    const enrolledIds = enrolledLinks.map(e => e.player_id);

    currentEditingState = {
        tournament,
        enrolledPlayers: allPlayers.filter(p => enrolledIds.includes(p.id)),
        availablePlayers: allPlayers.filter(p => !enrolledIds.includes(p.id))
    };

    renderEditor();
    await renderTournamentsList(tournamentId);
}

async function handleCategoryChange(event) {
    const categoryId = event.target.value;
    currentEditingState.tournament.category_id = categoryId;
    currentEditingState.enrolledPlayers = []; 

    if (categoryId) {
        const { data: players } = await supabase.from('players').select('*').eq('category_id', categoryId);
        currentEditingState.availablePlayers = players || [];
    } else {
        currentEditingState.availablePlayers = [];
    }
    renderPlayerLists();
}

function renderPlayerLists() {
    const availableContainer = document.getElementById('available-players');
    const enrolledContainer = document.getElementById('enrolled-players');
    availableContainer.innerHTML = '';
    enrolledContainer.innerHTML = '';

    currentEditingState.availablePlayers.forEach(p => {
        availableContainer.innerHTML += `<div class="player-management-item"><span>${p.name}</span><button class="btn" onclick="addPlayer(${p.id})">Añadir &rarr;</button></div>`;
    });
    currentEditingState.enrolledPlayers.forEach(p => {
        enrolledContainer.innerHTML += `<div class="player-management-item"><button class="btn btn-secondary" onclick="removePlayer(${p.id})">&larr; Sacar</button><span>${p.name}</span></div>`;
    });
}

function addPlayer(playerId) {
    const player = currentEditingState.availablePlayers.find(p => p.id === playerId);
    if (!player) return;
    currentEditingState.enrolledPlayers.push(player);
    currentEditingState.availablePlayers = currentEditingState.availablePlayers.filter(p => p.id !== playerId);
    renderPlayerLists();
}

async function removePlayer(playerId) {
    const { data: matches } = await supabase.from('matches').select('id', { count: 'exact' }).eq('tournament_id', currentEditingState.tournament.id).or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
    if (matches && matches.length > 0) {
        if (!confirm(`¡ADVERTENCIA!\n\nEste jugador ya ha jugado ${matches.length} partido(s). Si lo sacas, se perderá su progreso.\n\n¿Continuar?`)) {
            return;
        }
    }
    const player = currentEditingState.enrolledPlayers.find(p => p.id === playerId);
    if (!player) return;
    currentEditingState.availablePlayers.push(player);
    currentEditingState.enrolledPlayers = currentEditingState.enrolledPlayers.filter(p => p.id !== playerId);
    renderPlayerLists();
}

async function handleSaveChanges() {
    const { tournament, enrolledPlayers } = currentEditingState;
    tournament.name = document.getElementById('tournament-name').value;
    tournament.category_id = document.getElementById('tournament-category').value;

    if (!tournament.name.trim() || !tournament.category_id) return showToast('Nombre y categoría son obligatorios.', 'error');
    if (enrolledPlayers.length < 2) return showToast('Debe haber al menos 2 jugadores inscritos.', 'error');

    const tournamentData = { name: tournament.name, category_id: tournament.category_id };
    let currentTournamentId = tournament.id;
    
    if (tournament.id) { // Editando
        const { error } = await supabase.from('tournaments').update(tournamentData).eq('id', tournament.id);
        if (error) return showToast(`Error al guardar: ${error.message}`, 'error');
    } else { // Creando
        const { data: newTournament, error } = await supabase.from('tournaments').insert(tournamentData).select().single();
        if (error || !newTournament) return showToast(`Error al crear: ${error ? error.message : 'No se pudo crear el torneo.'}`, 'error');
        currentTournamentId = newTournament.id;
    }
    
    await supabase.from('tournament_players').delete().eq('tournament_id', currentTournamentId);
    const playersToInsert = enrolledPlayers.map(p => ({ tournament_id: currentTournamentId, player_id: p.id }));
    const { error: insertError } = await supabase.from('tournament_players').insert(playersToInsert);
    
    if(insertError) return showToast(`Error al inscribir jugadores: ${insertError.message}`, 'error');
    
    showToast('Torneo guardado con éxito.', 'success');
    await loadTournamentForEditing(currentTournamentId); // Recargar datos editados
}

async function deleteTournament(id) {
    if (!confirm('¿Seguro? Se eliminará el torneo y todos sus partidos.')) return;
    const { error } = await supabase.from('tournaments').delete().eq('id', id);
    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Torneo eliminado.', 'success');
        currentEditingState = { tournament: null, enrolledPlayers: [], availablePlayers: [] };
        await renderTournamentsList();
        renderEditor();
    }
}