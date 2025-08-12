// --- CONFIGURACIÓN Y VARIABLES GLOBALES ---
const venueData = { "Centro": 6, "Funes": 6 };
let allPlayers = [];
let allTournaments = [];
let allCategories = [];
let allTeams = [];
let pendingConfirmations = new Map();

let allMatchesData = []; // Almacena TODOS los partidos de la BD
let currentPage = 1;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    await fetchDataForForms();
    setupEventListeners();
    await fetchAllMatchesAndRender();
    loadSavedFormData();
});

async function fetchAllMatchesAndRender() {
    const tbody = document.getElementById('matches-list-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="placeholder-text">Cargando todos los partidos...</td></tr>';

    const { data, error } = await supabase
        .from('matches')
        .select(`*, p1_confirmed, p2_confirmed, player1:player1_id(name, team_id), player2:player2_id(name, team_id), winner:winner_id(name), tournaments(name)`)
        .order('match_date', { ascending: false })
        .order('match_time', { ascending: false });

    if (error) {
        console.error("Error fetching all matches:", error);
        allMatchesData = [];
    } else {
        allMatchesData = data || [];
    }
    renderFilteredMatches();
}

function setupEventListeners() {
    const clearDateBtn = document.getElementById('clear-date-filter');
    const datePickerInput = document.getElementById('date-range-picker');

    const datePicker = flatpickr(datePickerInput, {
        mode: "range", dateFormat: "Y-m-d", locale: "es",
        onClose: (selectedDates) => {
            clearDateBtn.style.display = selectedDates.length > 0 ? 'block' : 'none';
            currentPage = 1;
            renderFilteredMatches();
        }
    });
    clearDateBtn.addEventListener('click', () => datePicker.clear());

    document.getElementById('match-form').addEventListener('submit', handleMatchSubmit);
    document.getElementById('match-tournament').addEventListener('change', () => populatePlayerSelectsForMatch(document.getElementById('match-tournament').value, 'match-player1', 'match-player2'));
    document.getElementById('match-venue').addEventListener('change', populateCourtSelect);
    
    const filterInputs = ['match-filter', 'filter-by-category', 'filter-by-team', 'search-player-match', 'items-per-page'];
    filterInputs.forEach(id => {
        const element = document.getElementById(id);
        const eventType = element.tagName === 'INPUT' ? 'input' : 'change';
        element.addEventListener(eventType, () => {
            currentPage = 1;
            renderFilteredMatches();
        });
    });
    
    document.getElementById('select-all-matches').addEventListener('change', handleSelectAll);
    document.getElementById('generate-program-btn').addEventListener('click', handleGenerateProgram);
    document.getElementById('save-confirmations-btn').addEventListener('click', saveConfirmations);
    document.getElementById('close-modal-btn').addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => {
        if (event.target == document.getElementById('edit-match-modal')) closeEditModal();
    });
}

function renderFilteredMatches() {
    const statusFilter = document.getElementById('match-filter').value;
    const categoryFilter = document.getElementById('filter-by-category').value;
    const teamFilter = document.getElementById('filter-by-team').value;
    const searchTerm = document.getElementById('search-player-match').value.toLowerCase();
    
    const datePickerEl = document.querySelector("#date-range-picker");
    let startDate = null, endDate = null;
    if (datePickerEl._flatpickr && datePickerEl._flatpickr.selectedDates.length > 0) {
        startDate = datePickerEl._flatpickr.selectedDates[0];
        endDate = datePickerEl._flatpickr.selectedDates.length > 1 ? datePickerEl._flatpickr.selectedDates[1] : startDate;
    }

    const filteredMatches = allMatchesData.filter(match => {
        const p1Name = match.player1 ? match.player1.name.toLowerCase() : '';
        const p2Name = match.player2 ? match.player2.name.toLowerCase() : '';
        const p1Team = match.player1 ? match.player1.team_id : null;
        const p2Team = match.player2 ? match.player2.team_id : null;

        let matchDate = null;
        if(match.match_date) {
            matchDate = new Date(match.match_date);
            matchDate.setUTCHours(0, 0, 0, 0);
        }
        
        return (statusFilter === 'all' || (statusFilter === 'pending' && !match.winner_id) || (statusFilter === 'completed' && match.winner_id)) &&
               (categoryFilter === 'all' || match.category_id == categoryFilter) &&
               (teamFilter === 'all' || p1Team == teamFilter || p2Team == teamFilter) &&
               (p1Name.includes(searchTerm) || p2Name.includes(searchTerm)) &&
               (!startDate || !matchDate || (matchDate >= startDate && matchDate <= endDate));
    });

    renderTablePage(filteredMatches);
}

function renderTablePage(matches) {
    const tbody = document.getElementById('matches-list-tbody');
    tbody.innerHTML = '';
    const itemsPerPageOption = document.getElementById('items-per-page').value;
    const itemsPerPage = itemsPerPageOption === 'all' ? matches.length : parseInt(itemsPerPageOption, 10);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedMatches = matches.slice(startIndex, endIndex);

    if (paginatedMatches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="placeholder-text">No hay partidos que coincidan con los filtros.</td></tr>';
        renderPaginationControls(0, itemsPerPage);
        return;
    }
    
    const fragment = document.createDocumentFragment();
    paginatedMatches.forEach(match => {
        const row = document.createElement('tr');
        row.className = 'expandable-row';
        row.setAttribute('onclick', `openEditModal(${match.id})`);

        const isPending = !match.winner_id;
        const date = new Date(match.match_date + 'T00:00:00');
        const matchDateTime = `${date.toLocaleDateString('es-ES', {weekday: 'long', day: '2-digit', month: 'long'})} ${match.match_time ? match.match_time.substring(0, 5) + 'hs' : ''}`;
        
        const p1Name = match.player1 ? match.player1.name : `<span class="error-text">Jugador no encontrado (ID: ${match.player1_id})</span>`;
        const p2Name = match.player2 ? match.player2.name : `<span class="error-text">Jugador no encontrado (ID: ${match.player2_id})</span>`;
        const winnerName = match.winner ? match.winner.name : (isPending ? 'Pendiente' : 'Completado');

        const p1ConfirmedIcon = match.p1_confirmed ? '<span class="status-icon confirmed">✔</span>' : '<span class="status-icon pending">?</span>';
        const p2ConfirmedIcon = match.p2_confirmed ? '<span class="status-icon confirmed">✔</span>' : '<span class="status-icon pending">?</span>';
        
        const p1Toggle = match.player1 ? `<span class="player-confirm-toggle" onclick="toggleConfirmation(event, ${match.id}, 'p1', ${!match.p1_confirmed})">${p1ConfirmedIcon} <strong>${p1Name}</strong></span>` : p1Name;
        const p2Toggle = match.player2 ? `<span class="player-confirm-toggle" onclick="toggleConfirmation(event, ${match.id}, 'p2', ${!match.p2_confirmed})">${p2ConfirmedIcon} <strong>${p2Name}</strong></span>` : p2Name;

        row.innerHTML = `
            <td>${isPending ? `<input type="checkbox" class="match-checkbox" data-id="${match.id}" onclick="event.stopPropagation()">` : ''}</td>
            <td>${matchDateTime}</td>
            <td>${match.tournaments ? match.tournaments.name : 'N/A'}</td>
            <td>${p1Toggle} vs ${p2Toggle}</td>
            <td>${match.location}</td>
            <td class="${isPending ? 'pending-cell' : 'winner-cell'}">${winnerName}</td>
        `;
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
    renderPaginationControls(matches.length, itemsPerPage);
}

function renderPaginationControls(totalItems, itemsPerPage) {
    const paginationContainer = document.getElementById('pagination-controls');
    paginationContainer.innerHTML = '';
    
    if (itemsPerPage >= totalItems) return;

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const prevButton = document.createElement('button');
    prevButton.textContent = '« Anterior';
    prevButton.className = 'btn btn-secondary';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderFilteredMatches();
        }
    };
    
    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    pageIndicator.style.margin = '0 1rem';
    
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Siguiente »';
    nextButton.className = 'btn btn-secondary';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderFilteredMatches();
        }
    };

    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageIndicator);
    paginationContainer.appendChild(nextButton);
}

// --- TODAS LAS DEMÁS FUNCIONES (SIN CAMBIOS) ---

async function fetchDataForForms() {
    const { data: playersData } = await supabase.from('players').select('*').order('name');
    const { data: tournamentsData } = await supabase.from('tournaments').select('*, categories(name)').order('created_at', { ascending: false });
    const { data: categoriesData } = await supabase.from('categories').select('*').order('name');
    const { data: teamsData } = await supabase.from('teams').select('*').order('name');
    
    allPlayers = playersData || [];
    allTournaments = tournamentsData || [];
    allCategories = categoriesData || [];
    allTeams = teamsData || [];

    populateTournamentSelect();
    populateCategoryFilter();
    populateTeamFilter();
}

function loadSavedFormData() {
    const savedVenue = localStorage.getItem('lastVenue');
    const savedCourt = localStorage.getItem('lastCourt');
    const savedTournament = localStorage.getItem('lastTournament');
    const savedDate = localStorage.getItem('lastDate');
    const savedTime = localStorage.getItem('lastTime');

    if (savedTournament) document.getElementById('match-tournament').value = savedTournament;
    if (savedDate) document.getElementById('match-date').value = savedDate;
    if (savedTime) document.getElementById('match-time').value = savedTime;

    if (savedVenue) {
        const venueSelect = document.getElementById('match-venue');
        venueSelect.value = savedVenue;
        populateCourtSelect();
        if (savedCourt) {
            document.getElementById('match-court').value = savedCourt;
        }
    }
}

function populateTournamentSelect() {
    const select = document.getElementById('match-tournament');
    select.innerHTML = '<option value="">Seleccione torneo...</option>';
    allTournaments.forEach(t => {
        const categoryName = t.categories ? t.categories.name : 'Sin Cat.';
        select.innerHTML += `<option value="${t.id}">${t.name} (${categoryName})</option>`;
    });
    populatePlayerSelectsForMatch(select.value, 'match-player1', 'match-player2');
}

async function populatePlayerSelectsForMatch(tournamentId, p1SelectId, p2SelectId) {
    const p1Select = document.getElementById(p1SelectId);
    const p2Select = document.getElementById(p2SelectId);
    
    p1Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    p2Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    p1Select.disabled = true; p2Select.disabled = true;
    
    if (!tournamentId) return;

    const { data: tournamentPlayers } = await supabase.from('tournament_players').select('players(*)').eq('tournament_id', tournamentId);
    const playersInTournament = (tournamentPlayers || []).map(tp => tp.players).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name));

    if (playersInTournament.length > 0) {
        playersInTournament.forEach(p => {
            const option = `<option value="${p.id}">${p.name}</option>`;
            p1Select.innerHTML += option;
            p2Select.innerHTML += option;
        });
        p1Select.disabled = false; p2Select.disabled = false;
    }
}

function populateCourtSelect() {
    const venueSelect = document.getElementById('match-venue');
    const courtSelect = document.getElementById('match-court');
    const selectedVenue = venueSelect.value;
    courtSelect.innerHTML = '<option value="" disabled selected>Seleccione cancha</option>';

    if (selectedVenue && venueData[selectedVenue]) {
        courtSelect.disabled = false;
        for (let i = 1; i <= venueData[selectedVenue]; i++) {
            courtSelect.innerHTML += `<option value="Cancha ${i}">Cancha ${i}</option>`;
        }
    } else {
        courtSelect.disabled = true;
    }
}

async function handleMatchSubmit(event) {
    event.preventDefault();
    const tournamentId = document.getElementById('match-tournament').value;
    const player1Id = document.getElementById('match-player1').value;
    const player2Id = document.getElementById('match-player2').value;
    const date = document.getElementById('match-date').value;
    const time = document.getElementById('match-time').value;
    const venue = document.getElementById('match-venue').value;
    const court = document.getElementById('match-court').value;

    if (!tournamentId || !player1Id || !player2Id || !date || !time || !venue || !court || player1Id === player2Id) {
        return showToast('Todos los campos son obligatorios y los jugadores deben ser diferentes.', 'error');
    }

    const location = `${venue} - ${court}`;
    const tournament = allTournaments.find(t => t.id == tournamentId);

    const { data: newMatch, error } = await supabase.from('matches').insert([{
        tournament_id: parseInt(tournamentId), player1_id: parseInt(player1Id), player2_id: parseInt(player2Id),
        category_id: tournament.category_id, match_date: date, match_time: time, location: location,
        submission_token: crypto.randomUUID()
    }]).select('*, p1_confirmed, p2_confirmed, player1:player1_id(name, team_id), player2:player2_id(name, team_id), winner:winner_id(name), tournaments(name)').single();

    if (error) {
        showToast(`Error al crear el partido: ${error.message}`, 'error');
    } else {
        showToast('Partido creado con éxito.', 'success');
        allMatchesData.unshift(newMatch);
        renderFilteredMatches();
        document.getElementById('match-player1').value = '';
        document.getElementById('match-player2').value = '';
        localStorage.setItem('lastTournament', tournamentId);
        localStorage.setItem('lastDate', date);
        localStorage.setItem('lastTime', time);
        localStorage.setItem('lastVenue', venue);
        localStorage.setItem('lastCourt', court);
        document.getElementById('match-player1').focus();
    }
}

function populateCategoryFilter() {
    const select = document.getElementById('filter-by-category');
    select.innerHTML = '<option value="all">Todas las categorías</option>';
    allCategories.forEach(cat => select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`);
}

function populateTeamFilter() {
    const select = document.getElementById('filter-by-team');
    select.innerHTML = '<option value="all">Todos los equipos</option>';
    allTeams.forEach(team => select.innerHTML += `<option value="${team.id}">${team.name}</option>`);
}

function toggleConfirmation(event, matchId, playerKey, newStatus) {
    event.stopPropagation();
    const toggleSpan = event.currentTarget;
    const icon = toggleSpan.querySelector('.status-icon');
    icon.textContent = newStatus ? '✔' : '?';
    icon.className = `status-icon ${newStatus ? 'confirmed' : 'pending'}`;
    toggleSpan.setAttribute('onclick', `toggleConfirmation(event, ${matchId}, '${playerKey}', ${!newStatus})`);
    const confirmationKey = `${playerKey}_confirmed`;
    if (!pendingConfirmations.has(matchId)) pendingConfirmations.set(matchId, {});
    pendingConfirmations.get(matchId)[confirmationKey] = newStatus;
    document.getElementById('save-confirmations-btn').style.display = 'block';
}

async function saveConfirmations() {
    const saveBtn = document.getElementById('save-confirmations-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    const updatePromises = Array.from(pendingConfirmations.entries()).map(([id, changes]) =>
        supabase.from('matches').update(changes).eq('id', id)
    );

    try {
        await Promise.all(updatePromises);
        showToast('Confirmaciones guardadas con éxito.', 'success');
        for (const [id, changes] of pendingConfirmations.entries()) {
            const matchIndex = allMatchesData.findIndex(m => m.id === id);
            if(matchIndex !== -1) Object.assign(allMatchesData[matchIndex], changes);
        }
        pendingConfirmations.clear();
        saveBtn.style.display = 'none';
        renderFilteredMatches();
    } catch (error) {
        showToast(`Error al guardar: ${error.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cambios de Asistencia';
    }
}

async function openEditModal(matchId) {
    const modal = document.getElementById('edit-match-modal');
    const modalBody = document.getElementById('modal-body-content');
    modalBody.innerHTML = '<p class="placeholder-text">Cargando datos del partido...</p>';
    modal.style.display = 'block';

    const { data: match, error } = await supabase.from('matches').select('*, tournament_id, p1_confirmed, p2_confirmed, player1:player1_id(name), player2:player2_id(name)').eq('id', matchId).single();
    if (error) {
        modalBody.innerHTML = '<p class="placeholder-text">Error al cargar el partido.</p>';
        return;
    }

    const [venue, court] = match.location ? match.location.split(' - ') : ['',''];
    const isPending = !match.winner_id;
    modalBody.innerHTML = `
        <form id="edit-match-form">
            <input type="hidden" id="edit-match-id" value="${match.id}">
            <h4>Detalles del Partido</h4>
            <div class="form-grid">
                <div class="form-group"><label>Jugador 1</label><select id="edit-player1"></select></div>
                <div class="form-group"><label>Jugador 2</label><select id="edit-player2"></select></div>
                <div class="form-group"><label>Fecha</label><input type="date" id="edit-date" value="${match.match_date}"></div>
                <div class="form-group"><label>Hora</label><input type="time" id="edit-time" value="${match.match_time}"></div>
                <div class="form-group"><label>Sede</label><select id="edit-venue"><option value="Centro">Centro</option><option value="Funes">Funes</option></select></div>
                <div class="form-group"><label>Cancha</label><select id="edit-court"></select></div>
            </div>
            <div class="confirmation-section">
                <h4>Confirmación de Asistencia</h4>
                <div class="checkbox-group">
                    <label><input type="checkbox" id="p1-confirmed" ${match.p1_confirmed ? 'checked' : ''}> ${match.player1.name}</label>
                    <label><input type="checkbox" id="p2-confirmed" ${match.p2_confirmed ? 'checked' : ''}> ${match.player2.name}</label>
                </div>
            </div>
            ${isPending ? `<button type="button" class="btn btn-secondary" style="margin-top: 1rem;" onclick="toggleResultSection(this)">Cargar/Modificar Resultado</button>` : ''}
            <div id="result-section" class="result-section" ${isPending ? 'style="display:none;"' : ''}>
                <h4>Resultado del Partido</h4>
                <div id="sets-container"></div>
                <div class="set-controls"><button type="button" class="btn-icon" onclick="addSetInput(null, ${match.player1_id}, ${match.player2_id})">+</button></div>
                <div class="form-group">
                    <label>Ganador</label>
                    <select id="edit-winner">
                        <option value="">-- Sin Ganador (Pendiente) --</option>
                        <option value="${match.player1_id}">${match.player1.name}</option>
                        <option value="${match.player2_id}">${match.player2.name}</option>
                    </select>
                </div>
            </div>
            <div style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center;">
                <button type="button" class="btn btn-danger" onclick="handleDeleteMatch(${match.id})">Eliminar Partido</button>
                <div>
                    <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Cancelar</button>
                    <button type="submit" class="btn">Guardar Cambios</button>
                </div>
            </div>
        </form>`;

    await populatePlayerSelectsForMatch(match.tournament_id, 'edit-player1', 'edit-player2');
    document.getElementById('edit-player1').value = match.player1_id;
    document.getElementById('edit-player2').value = match.player2_id;
    document.getElementById('edit-winner').value = match.winner_id || "";
    document.getElementById('edit-venue').value = venue;
    const editCourtSelect = document.getElementById('edit-court');
    const numCourts = venueData[venue] || 6;
    editCourtSelect.innerHTML = '';
    for (let i = 1; i <= numCourts; i++) editCourtSelect.innerHTML += `<option value="Cancha ${i}">Cancha ${i}</option>`;
    editCourtSelect.value = court;
    if (match.sets) match.sets.forEach(set => addSetInput(set, match.player1_id, match.player2_id));
    document.getElementById('edit-match-form').addEventListener('submit', handleUpdateMatch);
}

function toggleResultSection(button) {
    const section = document.getElementById('result-section');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
    button.textContent = section.style.display === 'none' ? 'Cargar/Modificar Resultado' : 'Ocultar Resultado';
    if (section.style.display === 'block' && document.getElementById('sets-container').childElementCount === 0) {
        const p1Id = document.getElementById('edit-player1').value;
        const p2Id = document.getElementById('edit-player2').value;
        addSetInput(null, parseInt(p1Id), parseInt(p2Id));
    }
}

function closeEditModal() {
    document.getElementById('edit-match-modal').style.display = 'none';
}

async function handleUpdateMatch(event) {
    event.preventDefault();
    showToast('Guardando cambios...');
    const matchId = parseInt(document.getElementById('edit-match-id').value, 10);
    const winnerId = document.getElementById('edit-winner').value;
    const sets = Array.from(document.querySelectorAll('#sets-container .set-input-row')).map(row => ({
        p1: parseInt(row.querySelector('input[data-player="p1"]').value, 10),
        p2: parseInt(row.querySelector('input[data-player="p2"]').value, 10)
    })).filter(set => !isNaN(set.p1) && !isNaN(set.p2));
    
    const updateData = {
        player1_id: parseInt(document.getElementById('edit-player1').value),
        player2_id: parseInt(document.getElementById('edit-player2').value),
        match_date: document.getElementById('edit-date').value,
        match_time: document.getElementById('edit-time').value,
        location: `${document.getElementById('edit-venue').value} - ${document.getElementById('edit-court').value}`,
        winner_id: winnerId ? parseInt(winnerId) : null,
        sets: sets.length > 0 ? sets : null,
        bonus_loser: sets.length === 3,
        p1_confirmed: document.getElementById('p1-confirmed').checked,
        p2_confirmed: document.getElementById('p2-confirmed').checked,
    };

    const { data: updatedMatch, error } = await supabase.from('matches').update(updateData).eq('id', matchId).select('*, p1_confirmed, p2_confirmed, player1:player1_id(name, team_id), player2:player2_id(name, team_id), winner:winner_id(name), tournaments(name)').single();

    if (error) {
        showToast(`Error al actualizar: ${error.message}`, 'error');
    } else {
        showToast('Partido actualizado con éxito.', 'success');
        closeEditModal();
        const matchIndex = allMatchesData.findIndex(m => m.id === updatedMatch.id);
        if (matchIndex !== -1) allMatchesData[matchIndex] = updatedMatch;
        renderFilteredMatches();
    }
}

async function handleDeleteMatch(matchId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este partido?')) return;
    closeEditModal();
    showToast('Eliminando partido...');
    const { error } = await supabase.from('matches').delete().eq('id', matchId);
    if (error) {
        showToast(`Error al eliminar: ${error.message}`, 'error');
    } else {
        showToast('Partido eliminado con éxito.', 'success');
        allMatchesData = allMatchesData.filter(m => m.id !== matchId);
        renderFilteredMatches();
    }
}

function addSetInput(set, p1Id, p2Id) {
    const container = document.getElementById('sets-container');
    if (container.children.length >= 3) return;
    const p1 = allPlayers.find(p => p.id === p1Id);
    const p2 = allPlayers.find(p => p.id === p2Id);
    if (!p1 || !p2) return;
    const setRow = document.createElement('div');
    setRow.className = 'set-input-row';
    setRow.innerHTML = `
        <span class="player-name-label">${p1.name}</span>
        <input type="number" min="0" max="10" placeholder="-" value="${set ? set.p1 : ''}" data-player="p1" required>
        <span>-</span>
        <input type="number" min="0" max="10" placeholder="-" value="${set ? set.p2 : ''}" data-player="p2" required>
        <span class="player-name-label" style="text-align: right;">${p2.name}</span>
        <button type="button" class="btn-icon remove" onclick="this.parentElement.remove()">−</button>`;
    container.appendChild(setRow);
}

async function handleGenerateProgram() {
    const selectedIds = Array.from(document.querySelectorAll('.match-checkbox:checked')).map(cb => parseInt(cb.dataset.id));
    if (selectedIds.length === 0) return showToast('Debes seleccionar al menos un partido.', 'error');
    const title = prompt("Introduce un título para el programa (ej. 'Programación Fecha 1'):");
    if (!title || title.trim() === '') return showToast('Creación cancelada.', 'info');
    const slug = title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { data: existingProgram } = await supabase.from('programs').select('id').eq('slug', slug).single();
    if (existingProgram) return showToast('Ya existe un programa con un título similar.', 'error');
    const { error } = await supabase.from('programs').insert({ title, slug, match_ids: selectedIds });
    if (error) return showToast(`Error al crear el programa: ${error.message}`, 'error');
    showToast('Programa creado con éxito.', 'success');
    const programUrl = `${window.location.origin}/public/program.html?slug=${slug}`;
    const toastContainer = document.getElementById('toast-container');
    const linkToast = document.createElement('div');
    linkToast.className = 'toast success';
    linkToast.innerHTML = `<div><p style="margin:0;">¡Programa Creado!</p><a href="${programUrl}" target="_blank" style="color:white;text-decoration:underline;">Ver programa</a></div><button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;position:absolute;top:10px;right:10px;">&times;</button>`;
    toastContainer.appendChild(linkToast);
    document.getElementById('select-all-matches').checked = false;
    handleSelectAll({ target: { checked: false } });
}

function updateProgramButtonState() {
    const selectedCount = document.querySelectorAll('.match-checkbox:checked').length;
    const btn = document.getElementById('generate-program-btn');
    btn.disabled = selectedCount === 0;
    btn.textContent = selectedCount > 0 ? `Crear Programa (${selectedCount})` : 'Crear Programa';
}

function handleSelectAll(event) {
    document.querySelectorAll('.match-checkbox').forEach(checkbox => checkbox.checked = event.target.checked);
    updateProgramButtonState();
}
