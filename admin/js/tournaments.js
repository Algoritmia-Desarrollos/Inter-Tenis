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
    const { data: tournaments, error } = await supabase
        .from('tournaments')
        .select('*, categories(name), tournament_players(count)')
        .order('name', { foreignTable: 'categories', ascending: true })
        .order('created_at', { ascending: false });
    
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
                <div class="sublist-header">
                    <h4>Jugadores Disponibles</h4>
                    <button class="btn btn-secondary btn-small" onclick="addAllPlayers()">Inscribir Todos &rarr;</button>
                </div>
                <div id="available-players"></div>
            </div>
            <div class="player-sublist">
                <div class="sublist-header">
                    <h4>Jugadores Inscritos (${currentEditingState.enrolledPlayers.length})</h4>
                    <button class="btn btn-secondary btn-small" onclick="removeAllPlayers()">&larr; Sacar Todos</button>
                </div>
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
    const { data: tournament, error } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
    if (error || !tournament) {
        showToast('Error al cargar el torneo.', 'error');
        return;
    }

    // Carga de datos en paralelo para mejorar el rendimiento
    const [playersResponse, enrolledLinksResponse] = await Promise.all([
        supabase.from('players').select('*').eq('category_id', tournament.category_id),
        supabase.from('tournament_players').select('player_id').eq('tournament_id', tournamentId)
    ]);

    if (playersResponse.error || enrolledLinksResponse.error) {
        showToast('Error al cargar datos de jugadores.', 'error');
        return;
    }

    const allPlayers = playersResponse.data || [];
    const enrolledIds = (enrolledLinksResponse.data || []).map(e => e.player_id);

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
    
    // Construcción de HTML en una sola operación para mejorar rendimiento
    let availableHtml = '';
    currentEditingState.availablePlayers.forEach(p => {
        availableHtml += `<div class="player-management-item"><span>${p.name}</span><button class="btn" onclick="addPlayer(${p.id})">Añadir &rarr;</button></div>`;
    });
    availableContainer.innerHTML = availableHtml || '<p class="placeholder-text">No hay jugadores disponibles.</p>';

    let enrolledHtml = '';
    currentEditingState.enrolledPlayers.forEach(p => {
        enrolledHtml += `<div class="player-management-item"><button class="btn btn-secondary" onclick="removePlayer(${p.id})">&larr; Sacar</button><span>${p.name}</span></div>`;
    });
    enrolledContainer.innerHTML = enrolledHtml || '<p class="placeholder-text">No hay jugadores inscritos.</p>';
}

function addPlayer(playerId) {
    const player = currentEditingState.availablePlayers.find(p => p.id === playerId);
    if (!player) return;
    currentEditingState.enrolledPlayers.push(player);
    currentEditingState.availablePlayers = currentEditingState.availablePlayers.filter(p => p.id !== playerId);
    renderPlayerLists();
    updateEnrolledCount();
}

function addAllPlayers() {
    if (currentEditingState.availablePlayers.length === 0) return;
    currentEditingState.enrolledPlayers.push(...currentEditingState.availablePlayers);
    currentEditingState.availablePlayers = [];
    renderPlayerLists();
    updateEnrolledCount();
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
    updateEnrolledCount();
}

function removeAllPlayers() {
    if (currentEditingState.enrolledPlayers.length === 0) return;
    if (confirm('¿Estás seguro de que quieres sacar a todos los jugadores inscritos?')) {
        currentEditingState.availablePlayers.push(...currentEditingState.enrolledPlayers);
        currentEditingState.enrolledPlayers = [];
        renderPlayerLists();
        updateEnrolledCount();
    }
}

function updateEnrolledCount() {
    const enrolledCountTitle = document.querySelector('.player-sublist:last-child h4');
    if (enrolledCountTitle) {
        enrolledCountTitle.textContent = `Jugadores Inscritos (${currentEditingState.enrolledPlayers.length})`;
    }
}

async function handleSaveChanges() {
    const { tournament, enrolledPlayers } = currentEditingState;
    tournament.name = document.getElementById('tournament-name').value;
    tournament.category_id = document.getElementById('tournament-category').value;

    if (!tournament.name.trim() || !tournament.category_id) {
        return showToast('Nombre y categoría son obligatorios.', 'error');
    }
    if (enrolledPlayers.length < 2) {
        return showToast('Debe haber al menos 2 jugadores inscritos.', 'error');
    }

    try {
        let currentTournamentId = tournament.id;
        const tournamentData = { name: tournament.name, category_id: tournament.category_id };

        if (currentTournamentId) { // Si el ID existe, actualizamos el torneo
            const { error: updateError } = await supabase
                .from('tournaments')
                .update(tournamentData)
                .eq('id', currentTournamentId);
            if (updateError) throw updateError;
        } else { // Si no hay ID, creamos un nuevo torneo
            const { data: newTournament, error: insertError } = await supabase
                .from('tournaments')
                .insert(tournamentData)
                .select('id')
                .single();
            if (insertError) throw insertError;
            currentTournamentId = newTournament.id;
        }

        // Sincronizar jugadores inscritos
        const playersToInsert = enrolledPlayers.map(p => ({ tournament_id: currentTournamentId, player_id: p.id }));
        
        // Transacción para eliminar los antiguos e insertar los nuevos
        const { error: deleteError } = await supabase.from('tournament_players').delete().eq('tournament_id', currentTournamentId);
        if (deleteError) throw deleteError;

        const { error: insertPlayersError } = await supabase.from('tournament_players').insert(playersToInsert);
        if (insertPlayersError) throw insertPlayersError;

        showToast('Torneo guardado con éxito.', 'success');
        await loadTournamentForEditing(currentTournamentId); // Recargar con los datos actualizados

    } catch (error) {
        showToast(`Error al guardar el torneo: ${error.message}`, 'error');
    }
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
