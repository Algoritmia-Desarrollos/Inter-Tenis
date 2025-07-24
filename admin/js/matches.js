// --- CONFIGURACIÓN Y VARIABLES GLOBALES ---
const venueData = { "Centro": 6, "Funes": 6 };
let allPlayers = [];
let allTournaments = [];
let allCategories = [];

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    await fetchDataForForms();
    await renderMatchesList();
    
    setupEventListeners();
    loadSavedFormData();
});

async function fetchDataForForms() {
    const { data: playersData } = await supabase.from('players').select('*').order('name');
    const { data: tournamentsData } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    const { data: categoriesData } = await supabase.from('categories').select('*').order('name');
    
    allPlayers = playersData || [];
    allTournaments = tournamentsData || [];
    allCategories = categoriesData || [];

    populateTournamentSelect();
    populateCategoryFilter();
}

function setupEventListeners() {
    // Formulario de creación
    document.getElementById('match-form').addEventListener('submit', handleMatchSubmit);
    document.getElementById('match-tournament').addEventListener('change', () => populatePlayerSelectsForMatch(document.getElementById('match-tournament').value, 'match-player1', 'match-player2'));
    document.getElementById('match-venue').addEventListener('change', populateCourtSelect);

    // Filtros de la lista
    document.getElementById('match-filter').addEventListener('change', renderMatchesList);
    document.getElementById('filter-by-category').addEventListener('change', renderMatchesList);
    document.getElementById('search-player-match').addEventListener('input', renderMatchesList);
    
    // Programa de partidos
    document.getElementById('select-all-matches').addEventListener('change', handleSelectAll);
    document.getElementById('generate-program-btn').addEventListener('click', handleGenerateProgram);

    // Modal
    document.getElementById('close-modal-btn').addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => {
        if (event.target == document.getElementById('edit-match-modal')) {
            closeEditModal();
        }
    });
}

// --- LÓGICA DEL FORMULARIO DE CREACIÓN ---

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
    select.innerHTML = '<option value="">Seleccione torneo</option>';
    allTournaments.forEach(t => {
        select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
    populatePlayerSelectsForMatch(document.getElementById('match-tournament').value, 'match-player1', 'match-player2');
}

async function populatePlayerSelectsForMatch(tournamentId, p1SelectId, p2SelectId) {
    const p1Select = document.getElementById(p1SelectId);
    const p2Select = document.getElementById(p2SelectId);
    
    const selectedP1 = p1Select ? p1Select.value : null;
    const selectedP2 = p2Select ? p2Select.value : null;

    p1Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    p2Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    
    if (!tournamentId) return;

    const { data: tournamentPlayers } = await supabase
        .from('tournament_players')
        .select('players(*)')
        .eq('tournament_id', tournamentId);
    
    const playersInTournament = (tournamentPlayers || []).map(tp => tp.players).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name));

    playersInTournament.forEach(p => {
        const option = `<option value="${p.id}">${p.name}</option>`;
        p1Select.innerHTML += option;
        p2Select.innerHTML += option;
    });

    if (selectedP1) p1Select.value = selectedP1;
    if (selectedP2) p2Select.value = selectedP2;
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

    const { error } = await supabase.from('matches').insert([{
        tournament_id: parseInt(tournamentId),
        player1_id: parseInt(player1Id),
        player2_id: parseInt(player2Id),
        category_id: tournament.category_id,
        match_date: date,
        match_time: time,
        location: location,
        submission_token: crypto.randomUUID()
    }]);

    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Partido creado con éxito.', 'success');
        await renderMatchesList();
        
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

// --- LÓGICA DE LA LISTA DE PARTIDOS ---

function populateCategoryFilter() {
    const select = document.getElementById('filter-by-category');
    select.innerHTML = '<option value="all">Todas las categorías</option>';
    allCategories.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
}

async function renderMatchesList() {
    const tbody = document.getElementById('matches-list-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="placeholder-text">Cargando...</td></tr>';
    
    const statusFilter = document.getElementById('match-filter').value;
    const categoryFilter = document.getElementById('filter-by-category').value;
    const searchTerm = document.getElementById('search-player-match').value.toLowerCase();

    let query = supabase.from('matches').select(`*, player1:player1_id(name), player2:player2_id(name), winner:winner_id(name), tournaments(name)`);
    if (statusFilter === 'pending') query = query.is('winner_id', null);
    if (statusFilter === 'completed') query = query.not('winner_id', 'is', null);
    if (categoryFilter !== 'all') query = query.eq('category_id', categoryFilter);
    
    const { data: matches, error } = await query.order('match_date', { ascending: true }).order('match_time', { ascending: true });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="placeholder-text">Error al cargar los partidos.</td></tr>';
        return;
    }
    
    const filteredMatches = matches.filter(match => {
        if (!match.player1 || !match.player2) return false;
        return (match.player1.name.toLowerCase().includes(searchTerm) || match.player2.name.toLowerCase().includes(searchTerm));
    });

    tbody.innerHTML = '';
    if (filteredMatches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="placeholder-text">No hay partidos que coincidan.</td></tr>';
        return;
    }

    filteredMatches.forEach(match => {
        const isPending = !match.winner_id;
        const date = new Date(match.match_date + 'T00:00:00');
        const matchDateTime = `${date.toLocaleDateString('es-ES', {weekday: 'long', day: '2-digit', month: 'long'})} ${match.match_time ? match.match_time.substring(0, 5) + 'hs' : ''}`;
        
        const row = document.createElement('tr');
        row.className = 'expandable-row';
        row.setAttribute('onclick', `openEditModal(${match.id})`);
        
        const checkboxCell = isPending ? `<td><input type="checkbox" class="match-checkbox" data-id="${match.id}" onclick="event.stopPropagation()"></td>` : '<td></td>';

        row.innerHTML = `
            ${checkboxCell}
            <td>${matchDateTime}</td>
            <td>${match.tournaments ? match.tournaments.name : 'N/A'}</td>
            <td><strong>${match.player1.name}</strong> vs <strong>${match.player2.name}</strong></td>
            <td>${match.location}</td>
            <td class="${isPending ? 'pending-cell' : 'winner-cell'}">${isPending ? 'Pendiente' : match.winner.name}</td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll('.match-checkbox').forEach(box => {
        box.addEventListener('change', updateProgramButtonState);
    });
    updateProgramButtonState();
}

// --- LÓGICA DE LA VENTANA MODAL DE EDICIÓN ---

async function openEditModal(matchId) {
    const modal = document.getElementById('edit-match-modal');
    const modalBody = document.getElementById('modal-body-content');
    modalBody.innerHTML = '<p class="placeholder-text">Cargando datos del partido...</p>';
    modal.style.display = 'block';

    const { data: match, error } = await supabase.from('matches').select('*, tournament_id, player1:player1_id(name), player2:player2_id(name)').eq('id', matchId).single();
    if (error) {
        modalBody.innerHTML = '<p class="placeholder-text">Error al cargar el partido.</p>';
        return;
    }

    const [venue, court] = match.location.split(' - ');

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

            <div class="result-section">
                <h4>Resultado del Partido</h4>
                <div id="sets-container"></div>
                <div class="set-controls"><button type="button" class="btn-icon" onclick="addSetInput(null, ${match.player1_id}, ${match.player2_id}, true)">+</button></div>
                <div class="form-group">
                    <label>Ganador</label>
                    <select id="edit-winner">
                        <option value="">-- Sin Ganador (Pendiente) --</option>
                        <option value="${match.player1_id}">${match.player1.name}</option>
                        <option value="${match.player2_id}">${match.player2.name}</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Cancelar</button>
                <button type="submit" class="btn">Guardar Cambios</button>
            </div>
        </form>
    `;

    await populatePlayerSelectsForMatch(match.tournament_id, 'edit-player1', 'edit-player2');
    document.getElementById('edit-player1').value = match.player1_id;
    document.getElementById('edit-player2').value = match.player2_id;
    document.getElementById('edit-winner').value = match.winner_id || "";
    document.getElementById('edit-venue').value = venue;
    
    const editCourtSelect = document.getElementById('edit-court');
    const numCourts = venueData[venue] || 6;
    for (let i = 1; i <= numCourts; i++) {
        editCourtSelect.innerHTML += `<option value="Cancha ${i}">Cancha ${i}</option>`;
    }
    editCourtSelect.value = court;

    (match.sets && match.sets.length > 0 ? match.sets : [{p1:'', p2:''}]).forEach(set => addSetInput(set, match.player1_id, match.player2_id, true));

    document.getElementById('edit-match-form').addEventListener('submit', handleUpdateMatch);
}

function closeEditModal() {
    document.getElementById('edit-match-modal').style.display = 'none';
}

async function handleUpdateMatch(event) {
    event.preventDefault();
    showToast('Guardando cambios...');

    const matchId = document.getElementById('edit-match-id').value;
    const winnerId = document.getElementById('edit-winner').value;
    const venue = document.getElementById('edit-venue').value;
    const court = document.getElementById('edit-court').value;

    const sets = [];
    document.querySelectorAll('#sets-container .set-input-row').forEach(row => {
        const p1 = row.querySelector('input[data-player="p1"]').value;
        const p2 = row.querySelector('input[data-player="p2"]').value;
        if (p1 !== '' && p2 !== '') {
            sets.push({ p1: parseInt(p1), p2: parseInt(p2) });
        }
    });
    
    const updateData = {
        player1_id: parseInt(document.getElementById('edit-player1').value),
        player2_id: parseInt(document.getElementById('edit-player2').value),
        match_date: document.getElementById('edit-date').value,
        match_time: document.getElementById('edit-time').value,
        location: `${venue} - ${court}`,
        winner_id: winnerId ? parseInt(winnerId) : null,
        sets: sets.length > 0 ? sets : null,
        bonus_loser: sets.length === 3
    };

    const { error } = await supabase.from('matches').update(updateData).eq('id', matchId);

    if (error) {
        showToast(`Error al actualizar: ${error.message}`, 'error');
    } else {
        showToast('Partido actualizado con éxito.', 'success');
        closeEditModal();
        renderMatchesList();
    }
}

function addSetInput(set, p1Id, p2Id) {
    const container = document.getElementById('sets-container');
    if (container.children.length >= 3) return;
    
    const p1 = allPlayers.find(p => p.id === p1Id);
    const p2 = allPlayers.find(p => p.id === p2Id);
    
    if (!p1 || !p2) return; // Salir si los jugadores no se encuentran

    const setRow = document.createElement('div');
    setRow.className = 'set-input-row';
    setRow.innerHTML = `
        <span class="player-name-label">${p1.name}</span>
        <input type="number" min="0" max="10" placeholder="-" value="${set ? set.p1 : ''}" data-player="p1" required>
        <span>-</span>
        <input type="number" min="0" max="10" placeholder="-" value="${set ? set.p2 : ''}" data-player="p2" required>
        <span class="player-name-label" style="text-align: right;">${p2.name}</span>
        <button type="button" class="btn-icon remove" onclick="this.parentElement.remove()">−</button>
    `;
    container.appendChild(setRow);
}

// --- LÓGICA PARA GENERAR PROGRAMAS ---
async function handleGenerateProgram() {
    const selectedIds = Array.from(document.querySelectorAll('.match-checkbox:checked')).map(cb => parseInt(cb.dataset.id));
    
    if (selectedIds.length === 0) return showToast('Debes seleccionar al menos un partido.', 'error');

    const title = prompt("Introduce un título para el programa (ej. 'Programación Fecha 1'):");
    if (!title || title.trim() === '') return showToast('La creación del programa fue cancelada.', 'info');

    const slug = title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { data: existingProgram } = await supabase.from('programs').select('id').eq('slug', slug).single();
    if (existingProgram) return showToast('Ya existe un programa con un título similar. Elige otro.', 'error');

    const { data: matchesData, error: matchesError } = await supabase.from('matches')
        .select(`*, player1:player1_id(name), player2:player2_id(name), tournaments(name), categories(name)`)
        .in('id', selectedIds);

    if (matchesError) return showToast(`Error al obtener datos: ${matchesError.message}`, 'error');
    
    const { data: newProgram, error: insertError } = await supabase.from('programs').insert({ title, slug, matches_data: matchesData }).select();

    if (insertError) return showToast(`Error al guardar el programa: ${insertError.message}`, 'error');
    if (!newProgram || newProgram.length === 0) return showToast('Hubo un problema desconocido al crear el programa.', 'error');

    showToast('Programa creado con éxito.', 'success');
    
    const programUrl = `${window.location.origin}/public/program.html?slug=${slug}`;
    
    const toastContainer = document.getElementById('toast-container');
    const linkToast = document.createElement('div');
    linkToast.className = 'toast success';
    linkToast.style.animation = 'slideInToast 0.4s ease-out forwards';
    linkToast.innerHTML = `
        <div>
            <p style="margin: 0 0 5px 0;">¡Programa Creado!</p>
            <a href="${programUrl}" target="_blank" style="color: white; text-decoration: underline;">Click aquí para ver el programa</a>
        </div>
        <button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; font-size: 20px; cursor:pointer; position: absolute; top: 10px; right: 10px;">&times;</button>
    `;
    toastContainer.appendChild(linkToast);
    
    document.getElementById('select-all-matches').checked = false;
    handleSelectAll({ target: { checked: false } });
}

function updateProgramButtonState() {
    const selected = document.querySelectorAll('.match-checkbox:checked').length;
    const btn = document.getElementById('generate-program-btn');
    btn.disabled = selected === 0;
    btn.textContent = selected > 0 ? `Crear Programa (${selected})` : 'Crear Programa';
}

function handleSelectAll(event) {
    const isChecked = event.target.checked;
    document.querySelectorAll('.match-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    updateProgramButtonState();
}