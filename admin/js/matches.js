// --- CONFIGURACIÓN Y VARIABLES GLOBALES ---
const venueData = { "Centro": 6, "Funes": 6 };
const RENDER_BATCH_SIZE = 40;
let allPlayers = [], allTournaments = [], allCategories = [], allTeams = [];
let allMatchesData = [], filteredMatches = [];
let renderIndex = 0;
let observer;
let selectedMatchIds = new Set();
let currentEditRow = null;

// --- DECLARACIÓN DE TODAS LAS FUNCIONES ---

// SECCIÓN: MANEJADORES DE EVENTOS Y ACCIONES
function handleRowClick(event) {
    if (event.target.closest('.actions-cell')) return;
    const row = event.currentTarget;
    const matchId = parseInt(row.dataset.matchId);
    if (selectedMatchIds.has(matchId)) {
        selectedMatchIds.delete(matchId);
    } else {
        selectedMatchIds.add(matchId);
    }
    row.classList.toggle('selected');
    updateBulkActionUI();
}

function handleSelectAll(event) {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll('#matches-list-tbody tr');
    selectedMatchIds.clear();

    checkboxes.forEach(row => {
        const matchId = parseInt(row.dataset.matchId);
        row.classList.toggle('selected', isChecked);
        if (isChecked) {
            selectedMatchIds.add(matchId);
        }
    });
    updateBulkActionUI();
}

async function handleBulkDelete() {
    if (selectedMatchIds.size === 0) return;
    if (!confirm(`¿Estás seguro de que quieres eliminar ${selectedMatchIds.size} partidos?`)) return;
    showToast(`Eliminando ${selectedMatchIds.size} partidos...`);
    const { error } = await supabase.from('matches').delete().in('id', Array.from(selectedMatchIds));
    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Partidos eliminados.', 'success');
        selectedMatchIds.clear();
        await fetchAllMatches();
        applyFiltersAndRender();
    }
}

async function handleGenerateProgram() {
    const selectedPendingIds = [...selectedMatchIds].filter(id => {
        const match = allMatchesData.find(m => m.id === id);
        return match && !match.winner_id;
    });

    if (selectedPendingIds.length === 0) {
        return showToast('Debes seleccionar al menos un partido pendiente para crear un programa.', 'error');
    }
    
    const title = prompt("Introduce un título para el programa (ej: Programación Fecha 5):");
    if (!title || !title.trim()) return;

    const slug = title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { error } = await supabase.from('programs').insert({ title, slug, match_ids: selectedPendingIds });
    
    if (error) {
        return showToast(`Error al crear el programa: ${error.message}`, 'error');
    }
    
    const programUrl = `${window.location.origin}/public/program.html?slug=${slug}`;
    showToast('Programa creado con éxito.', 'success');
    
    const toastContainer = document.getElementById('toast-container');
    const linkToast = document.createElement('div');
    linkToast.className = 'toast success';
    linkToast.innerHTML = `<div><p style="margin:0;">¡Programa Creado!</p><a href="${programUrl}" target="_blank" style="color:white;text-decoration:underline;">Ver programa</a></div><button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;position:absolute;top:10px;right:10px;">&times;</button>`;
    toastContainer.appendChild(linkToast);
}

async function handleGeneratePdf() {
    if (selectedMatchIds.size === 0) return showToast('No hay partidos seleccionados.', 'error');
    showToast('Generando PDF...');

    const selectedMatches = [...selectedMatchIds].map(id => allMatchesData.find(m => m.id === id)).filter(Boolean);
    selectedMatches.sort((a, b) => new Date(a.match_date) - new Date(b.match_date) || a.match_time.localeCompare(b.match_time));

    const groupedByDateAndSede = selectedMatches.reduce((acc, match) => {
        const date = new Date(match.match_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const sede = match.location?.split(' - ')[0] || 'N/A';
        const key = `${sede.toUpperCase()} | ${date}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(match);
        return acc;
    }, {});

    let pdfHtml = `<style>
        body, .pdf-page {
            font-family: Arial, sans-serif;
            background: #181818 !important;
            color: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm;
            min-height: 297mm;
            box-sizing: border-box;
        }
        .pdf-page {
            background: #181818 !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        .day-block {
            margin-bottom: 12px;
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid #f3ca3e;
            background: #181818 !important;
        }
        .header-row {
            display: flex;
            align-items: center;
            background: #f3ca3e;
            color: #222;
            padding: 8px 16px;
            font-size: 24px;
            font-weight: bold;
        }
        .header-row .sede { font-size: 20px; font-weight: bold; margin-right: 24px; }
        .header-row .fecha { flex: 1; text-align: left; }
        .header-row .clima { font-size: 15px; text-align: right; }
        .match-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 15px;
            margin: 0;
            background: #181818 !important;
        }
        .match-table th, .match-table td {
            text-align: center !important;
            vertical-align: middle !important;
            background: #181818 !important;
            color: #fff !important;
        }
        .match-table th {
            background: #222 !important;
            color: #f3ca3e !important;
            font-weight: bold;
            padding: 6px 0;
            border-bottom: 2px solid #f3ca3e;
        }
        .match-table td {
            padding: 8px 4px;
            border-bottom: 1px solid #444;
        }
        .cancha-cell {
            background: #f3ca3e !important;
            color: #222 !important;
            font-weight: bold;
            border-radius: 4px;
            padding: 4px 10px;
            font-size: 16px;
        }
        .hora-cell {
            background: #222 !important;
            color: #f3ca3e !important;
            font-weight: bold;
            font-size: 15px;
            border-radius: 4px;
            padding: 4px 10px;
        }
        .player-cell { font-weight: bold; font-size: 15px; }
        .player-cell.winner { color: #f3ca3e !important; }
        .player-cell.loser { color: #bbb !important; }
        .score-cell { font-size: 15px; font-weight: bold; text-align: center; }
        .score-box {
            display: inline-block;
            min-width: 24px;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
        }
        .score-box-winner { background: #f3ca3e !important; color: #222 !important; }
        .score-box-bonus { background: #8c5c02 !important; color: #fff !important; }
        .score-box-loser { background: #333 !important; color: #fff !important; }
        .sets-cell { font-size: 14px; color: #fff !important; font-weight: bold; }
        .category-cell { color: #e85d04 !important; font-weight: bold; font-size: 14px; }
        .team-logo {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            vertical-align: middle;
            margin-left: 8px;
            background: #333 !important;
        }
    </style>
    <div class="pdf-page">`;

    for (const groupKey in groupedByDateAndSede) {
        const [sede, fecha] = groupKey.split(' | ');
        const climaHtml = `<span class="clima">☀️ 18°/8° 13-14 km/h</span>`;

        pdfHtml += `<div class="day-block">
            <div class="header-row">
                <span class="sede">${sede}</span>
                <span class="fecha">${fecha}</span>
                ${climaHtml}
            </div>
            <table class="match-table">
                <thead>
                    <tr>
                        <th>Cancha</th>
                        <th>Hora</th>
                        <th>Jugador 1</th>
                        <th>Pts</th>
                        <th>Sets</th>
                        <th>Pts</th>
                        <th>Jugador 2</th>
                        <th>Categoría</th>
                    </tr>
                </thead>
                <tbody>
        `;

        groupedByDateAndSede[groupKey].forEach(match => {
            const p1 = allPlayers.find(p => p.id === match.player1_id);
            const p2 = allPlayers.find(p => p.id === match.player2_id);
            const team1 = p1 ? allTeams.find(t => t.id === p1.team_id) : null;
            const team2 = p2 ? allTeams.find(t => t.id === p2.team_id) : null;

            let p1Points = '-';
            let p2Points = '-';
            let p1Class = 'player-cell';
            let p2Class = 'player-cell';
            if (match.winner_id) {
                p1Points = (match.winner_id === match.player1_id) ? 2 : (match.bonus_loser ? 1 : 0);
                p2Points = (match.winner_id === match.player2_id) ? 2 : (match.bonus_loser ? 1 : 0);
                p1Class += (match.winner_id === p1.id) ? ' winner' : ' loser';
                p2Class += (match.winner_id === p2.id) ? ' winner' : ' loser';
            }

            const setsString = match.winner_id ? (match.sets || []).map(s => `${s.p1}/${s.p2}`).join(' ') : 'vs';

            pdfHtml += `
                <tr>
                    <td class="cancha-cell">${match.location?.split(' - ')[1]?.replace('Cancha ','') || ''}</td>
                    <td class="hora-cell">${match.match_time?.substring(0, 5) || ''} hs</td>
                    <td class="${p1Class}">${p1?.name || ''}${team1?.image_url ? `<img src="${team1.image_url}" class="team-logo">` : ''}</td>
                    <td class="score-cell"><span class="score-box ${p1Points === 2 ? 'score-box-winner' : p1Points === 1 ? 'score-box-bonus' : 'score-box-loser'}">${p1Points}</span></td>
                    <td class="sets-cell">${setsString}</td>
                    <td class="score-cell"><span class="score-box ${p2Points === 2 ? 'score-box-winner' : p2Points === 1 ? 'score-box-bonus' : 'score-box-loser'}">${p2Points}</span></td>
                    <td class="${p2Class}">${p2?.name || ''}${team2?.image_url ? `<img src="${team2.image_url}" class="team-logo">` : ''}</td>
                    <td class="category-cell">${allCategories.find(c => c.id === match.category_id)?.name || ''}</td>
                </tr>
            `;
        });

        pdfHtml += `
                </tbody>
            </table>
        </div>`;
    }

    pdfHtml += `</div>`;

    const element = document.createElement('div');
    element.innerHTML = pdfHtml;
    html2pdf(element, {
        margin: 0,
        filename: 'programa_partidos.pdf',
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#181818' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    });
}

// SECCIÓN: RENDERIZADO Y FILTRADO
function applyFiltersAndRender() {
    const statusFilter = document.getElementById('match-filter').value;
    const categoryFilter = document.getElementById('filter-by-category').value;
    const teamFilter = document.getElementById('filter-by-team').value;
    const searchTerm = document.getElementById('search-player-match').value.toLowerCase();
    const datePicker = flatpickr("#date-range-picker").selectedDates;
    
    filteredMatches = allMatchesData.filter(match => {
        const p1Name = match.player1?.name.toLowerCase() || '';
        const p2Name = match.player2?.name.toLowerCase() || '';
        const p1Team = allPlayers.find(p => p.id === match.player1_id)?.team_id;
        const p2Team = allPlayers.find(p => p.id === match.player2_id)?.team_id;
        
        const matchDate = new Date(match.match_date + 'T00:00:00');
        let dateFilterPassed = true;
        if (datePicker.length > 0) {
            const startDate = new Date(datePicker[0]);
            startDate.setHours(0, 0, 0, 0);
            const endDate = datePicker.length > 1 ? new Date(datePicker[1]) : new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            dateFilterPassed = matchDate >= startDate && matchDate <= endDate;
        }

        return dateFilterPassed && (statusFilter === 'all' || (statusFilter === 'pending' && !match.winner_id) || (statusFilter === 'completed' && match.winner_id)) && (categoryFilter === 'all' || match.category_id == categoryFilter) && (teamFilter === 'all' || p1Team == teamFilter || p2Team == teamFilter) && (p1Name.includes(searchTerm) || p2Name.includes(searchTerm));
    });

    const tbody = document.getElementById('matches-list-tbody');
    tbody.innerHTML = '';
    renderIndex = 0;
    if (currentEditRow) {
        currentEditRow.remove();
        currentEditRow = null;
    }
    
    if (observer) observer.disconnect();
    if (filteredMatches.length > 0) {
        renderMoreRows();
        setupIntersectionObserver();
    } else {
        tbody.innerHTML = '<tr><td colspan="10" class="placeholder-text">No hay partidos.</td></tr>';
    }
    updateBulkActionUI();
}

function renderMoreRows() {
    const tbody = document.getElementById('matches-list-tbody');
    const fragment = document.createDocumentFragment();
    const endIndex = Math.min(renderIndex + RENDER_BATCH_SIZE, filteredMatches.length);
    for (let i = renderIndex; i < endIndex; i++) {
        fragment.appendChild(createMatchRow(filteredMatches[i]));
    }
    tbody.appendChild(fragment);
    renderIndex = endIndex;
}

function createMatchRow(match) {
    const row = document.createElement('tr');
    row.dataset.matchId = match.id;
    row.classList.toggle('selected', selectedMatchIds.has(match.id));
    row.addEventListener('click', handleRowClick);

    const [sede, cancha] = match.location?.split(' - ') || ['N/A', ''];
    const time = match.match_time ? match.match_time.substring(0, 5) + ' hs' : '';
    const date = new Date(match.match_date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    const category = allCategories.find(c => c.id === match.category_id)?.name || 'N/A';
    const isPending = !match.winner_id;
    const setsString = isPending ? 'Pendiente' : (match.sets || []).map(s => `${s.p1}-${s.p2}`).join(', ');
    const p1Points = !isPending ? ((match.winner_id === match.player1_id) ? 2 : (match.bonus_loser ? 1 : 0)) : '-';
    const p2Points = !isPending ? ((match.winner_id === match.player2_id) ? 2 : (match.bonus_loser ? 1 : 0)) : '-';

    row.innerHTML = `
        <td class="date-time-cell">
            <strong>${date}</strong><small>${time}</small>
        </td>
        <td>${sede}</td>
        <td>${cancha}</td>
        <td class="player-name-cell ${match.winner_id === match.player1_id ? 'winner-player' : ''}">${match.player1?.name || 'N/A'}</td>
        <td class="points-cell">${p1Points}</td>
        <td class="sets-cell">${setsString}</td>
        <td class="points-cell">${p2Points}</td>
        <td class="player-name-cell ${match.winner_id === match.player2_id ? 'winner-player' : ''}">${match.player2?.name || 'N/A'}</td>
        <td>${category}</td>
        <td class="actions-cell">
            <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); toggleEditForm(${match.id})">Editar</button>
        </td>
    `;
    return row;
}

function setupIntersectionObserver() {
    const sentinel = document.getElementById('sentinel');
    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && renderIndex < filteredMatches.length) {
            renderMoreRows();
        }
    }, { rootMargin: '300px' });
    observer.observe(sentinel);
}

// SECCIÓN: EDICIÓN EN LÍNEA
function toggleEditForm(matchId) {
    if (currentEditRow && currentEditRow.dataset.matchId == matchId) {
        currentEditRow.remove();
        currentEditRow = null;
        return;
    }
    
    if (currentEditRow) {
        currentEditRow.remove();
    }

    const matchRow = document.querySelector(`tr[data-match-id='${matchId}']`);
    if (!matchRow) return;

    const match = allMatchesData.find(m => m.id === matchId);
    
    currentEditRow = document.createElement('tr');
    currentEditRow.className = 'match-details-row';
    currentEditRow.dataset.matchId = matchId;

    const [venue, court] = match.location?.split(' - ') || ['', ''];

    let formHtml = `
        <td colspan="10" class="details-content">
            <form id="inline-edit-form-${matchId}" onsubmit="handleUpdateMatch(event, ${matchId})">
                <div class="form-grid">
                    <div class="form-group"><label>Fecha</label><input type="date" name="match_date" value="${match.match_date}"></div>
                    <div class="form-group"><label>Hora</label><input type="time" name="match_time" value="${match.match_time}"></div>
                    <div class="form-group"><label>Sede</label><select name="venue"><option value="Centro">Centro</option><option value="Funes">Funes</option></select></div>
                    <div class="form-group"><label>Cancha</label><select name="court"></select></div>
                </div>
                <h4>Resultado</h4>
                <div id="sets-container-${matchId}"></div>
                <div class="set-controls"><button type="button" class="btn-icon" onclick="addSetInput(null, ${match.player1_id}, ${match.player2_id}, ${matchId})">+</button></div>
                <div class="form-group">
                    <label>Ganador</label>
                    <select name="winner_id">
                        <option value="">-- Pendiente --</option>
                        <option value="${match.player1_id}">${match.player1.name}</option>
                        <option value="${match.player2_id}">${match.player2.name}</option>
                    </select>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 1rem;">
                    <button type="button" class="btn btn-secondary" onclick="toggleEditForm(${matchId})">Cancelar</button>
                    <button type="submit" class="btn">Guardar</button>
                </div>
            </form>
        </td>`;
    currentEditRow.innerHTML = formHtml;
    
    matchRow.after(currentEditRow);

    const form = document.getElementById(`inline-edit-form-${matchId}`);
    form.elements.venue.value = venue;
    populateCourtSelect(form.elements.venue, form.elements.court, venue);
    form.elements.court.value = court;
    form.elements.winner_id.value = match.winner_id || "";

    if (match.sets) match.sets.forEach(set => addSetInput(set, match.player1_id, match.player2_id, matchId));
}

async function handleUpdateMatch(event, matchId) {
    event.preventDefault();
    showToast('Guardando...');
    const form = event.target;
    
    const sets = Array.from(form.querySelectorAll('.set-input-row')).map(row => ({
        p1: parseInt(row.querySelector('input[data-player="p1"]').value),
        p2: parseInt(row.querySelector('input[data-player="p2"]').value)
    })).filter(set => !isNaN(set.p1) && !isNaN(set.p2));

    const updateData = {
        match_date: form.elements.match_date.value,
        match_time: form.elements.match_time.value,
        location: `${form.elements.venue.value} - ${form.elements.court.value}`,
        winner_id: form.elements.winner_id.value ? parseInt(form.elements.winner_id.value) : null,
        sets: sets.length > 0 ? sets : null,
        bonus_loser: sets.length === 3
    };

    const { data: updatedMatch, error } = await supabase.from('matches').update(updateData).eq('id', matchId).select(`*, player1:player1_id(name), player2:player2_id(name)`).single();

    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Partido actualizado.', 'success');
        const index = allMatchesData.findIndex(m => m.id === matchId);
        if (index !== -1) allMatchesData[index] = updatedMatch;
        
        currentEditRow.remove();
        currentEditRow = null;
        
        const oldRow = document.querySelector(`tr[data-match-id='${matchId}']`);
        if (oldRow) oldRow.replaceWith(createMatchRow(updatedMatch));
    }
}

function addSetInput(set, p1Id, p2Id, matchId) {
    const container = document.getElementById(`sets-container-${matchId}`);
    if (container.children.length >= 3) return;
    const p1Name = allPlayers.find(p => p.id === p1Id)?.name || 'Jugador 1';
    const p2Name = allPlayers.find(p => p.id === p2Id)?.name || 'Jugador 2';
    
    const setRow = document.createElement('div');
    setRow.className = 'set-input-row';
    setRow.innerHTML = `
        <span class="player-name-label">${p1Name}</span>
        <input type="number" min="0" max="10" value="${set ? set.p1 : ''}" data-player="p1" oninput="autoCalculateWinner(${matchId})">
        <span>-</span>
        <input type="number" min="0" max="10" value="${set ? set.p2 : ''}" data-player="p2" oninput="autoCalculateWinner(${matchId})">
        <span class="player-name-label">${p2Name}</span>
        <button type="button" class="btn-icon remove" onclick="this.parentElement.remove(); autoCalculateWinner(${matchId});">−</button>`;
    container.appendChild(setRow);
}

function autoCalculateWinner(matchId) {
    const form = document.getElementById(`inline-edit-form-${matchId}`);
    if (!form) return;
    
    const p1Id = parseInt(form.elements.winner_id.options[1].value);
    const p2Id = parseInt(form.elements.winner_id.options[2].value);
    
    let p1SetsWon = 0, p2SetsWon = 0;
    form.querySelectorAll('.set-input-row').forEach(row => {
        const p1Score = parseInt(row.querySelector('input[data-player="p1"]').value) || 0;
        const p2Score = parseInt(row.querySelector('input[data-player="p2"]').value) || 0;
        if (p1Score > p2Score) p1SetsWon++;
        else if (p2Score > p1Score) p2SetsWon++;
    });

    if (p1SetsWon >= 2) form.elements.winner_id.value = p1Id;
    else if (p2SetsWon >= 2) form.elements.winner_id.value = p2Id;
}

// SECCIÓN: INICIALIZACIÓN Y CONFIGURACIÓN
async function fetchDataForForms() {
    const [players, tournaments, categories, teams] = await Promise.all([
        supabase.from('players').select('*, teams(id, image_url)').order('name'),
        supabase.from('tournaments').select('*, categories(name)').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('teams').select('*').order('name')
    ]);
    allPlayers = players.data || [];
    allTournaments = tournaments.data || [];
    allCategories = categories.data || [];
    allTeams = teams.data || [];
    populateTournamentSelect();
    populateCategoryFilter();
    populateTeamFilter();
}

function populateTournamentSelect() {
    const select = document.getElementById('match-tournament');
    select.innerHTML = '<option value="">Seleccione torneo...</option>';
    allTournaments.forEach(t => {
        select.innerHTML += `<option value="${t.id}">${t.name} (${t.categories?.name || 'N/A'})</option>`;
    });
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

async function populatePlayerSelectsForMatch(tournamentId, p1SelectId, p2SelectId) {
    const p1Select = document.getElementById(p1SelectId);
    const p2Select = document.getElementById(p2SelectId);
    p1Select.innerHTML = '<option value="">Cargando...</option>';
    p2Select.innerHTML = '<option value="">Cargando...</option>';
    p1Select.disabled = true; p2Select.disabled = true;
    if (!tournamentId) return;

    const { data: tournamentPlayers } = await supabase.from('tournament_players').select('players(*)').eq('tournament_id', tournamentId);
    const playersInTournament = (tournamentPlayers || []).map(tp => tp.players).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name));
    
    p1Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    p2Select.innerHTML = '<option value="">Seleccionar jugador</option>';
    if (playersInTournament.length > 0) {
        playersInTournament.forEach(p => {
            const option = `<option value="${p.id}">${p.name}</option>`;
            p1Select.innerHTML += option;
            p2Select.innerHTML += option;
        });
        p1Select.disabled = false;
        p2Select.disabled = false;
    }
}

function populateCourtSelect(venueEl, courtEl, venueValue) {
    const venueSelect = venueEl || document.getElementById('match-venue');
    const courtSelect = courtEl || document.getElementById('match-court');
    const selectedVenue = venueValue || venueSelect.value;
    courtSelect.innerHTML = '<option value="">Seleccione cancha</option>';
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
    const form = event.target;
    const tournamentId = form.elements['match-tournament'].value;
    const player1Id = form.elements['match-player1'].value;
    const player2Id = form.elements['match-player2'].value;
    const date = form.elements['match-date'].value;
    const time = form.elements['match-time'].value;
    const venue = form.elements['match-venue'].value;
    const court = form.elements['match-court'].value;

    if (!tournamentId || !player1Id || !player2Id || !date || !time || !venue || !court || player1Id === player2Id) {
        return showToast('Todos los campos son obligatorios.', 'error');
    }

    const location = `${venue} - ${court}`;
    const tournament = allTournaments.find(t => t.id == tournamentId);

    const { error } = await supabase.from('matches').insert([{
        tournament_id: parseInt(tournamentId), player1_id: parseInt(player1Id), player2_id: parseInt(player2Id),
        category_id: tournament.category_id, match_date: date, match_time: time, location: location,
        submission_token: crypto.randomUUID()
    }]);

    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Partido creado con éxito.', 'success');
        await fetchAllMatches();
        applyFiltersAndRender();
        form.reset();
    }
}

function updateBulkActionUI() {
    const container = document.getElementById('floating-actions-container');
    const counter = document.getElementById('floating-selection-counter');
    const programBtn = document.getElementById('floating-program-btn');

    if (selectedMatchIds.size > 0) {
        container.style.display = 'flex';
        counter.textContent = `${selectedMatchIds.size} seleccionados`;
        const hasPending = [...selectedMatchIds].some(id => !allMatchesData.find(m => m.id === id)?.winner_id);
        programBtn.disabled = !hasPending;
    } else {
        container.style.display = 'none';
    }
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    loader.style.display = 'flex';
    
    await Promise.all([fetchDataForForms(), fetchAllMatches()]);
    
    setupEventListeners();
    
    applyFiltersAndRender();
    loader.style.display = 'none';
});

function setupEventListeners() {
    // Filtros y búsqueda
    document.getElementById('match-filter').addEventListener('change', applyFiltersAndRender);
    document.getElementById('filter-by-category').addEventListener('change', applyFiltersAndRender);
    document.getElementById('filter-by-team').addEventListener('change', applyFiltersAndRender);
    document.getElementById('search-player-match').addEventListener('input', applyFiltersAndRender);

    // Selección múltiple
    const selectAllEl = document.getElementById('select-all-matches');
    if (selectAllEl) selectAllEl.addEventListener('change', handleSelectAll);

    // Acciones flotantes
    const deleteBtn = document.getElementById('floating-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', handleBulkDelete);

    const programBtn = document.getElementById('floating-program-btn');
    if (programBtn) programBtn.addEventListener('click', handleGenerateProgram);

    const pdfBtn = document.getElementById('floating-pdf-btn');
    if (pdfBtn) pdfBtn.addEventListener('click', handleGeneratePdf);

    // Formulario de creación de partido
    const matchForm = document.getElementById('match-form');
    if (matchForm) matchForm.addEventListener('submit', handleMatchSubmit);

    // Sede y cancha en formulario de partido
    const venueEl = document.getElementById('match-venue');
    if (venueEl) venueEl.addEventListener('change', function() {
        populateCourtSelect();
    });

    // Torneo y jugadores en formulario de partido
    const tournamentEl = document.getElementById('match-tournament');
    if (tournamentEl) tournamentEl.addEventListener('change', function() {
        populatePlayerSelectsForMatch(
            this.value,
            'match-player1',
            'match-player2'
        );
    });
}

async function fetchAllMatches() {
    const { data, error } = await supabase
        .from('matches')
        .select('*, player1:player1_id(name), player2:player2_id(name)')
        .order('match_date', { ascending: true });
    if (error) {
        showToast(`Error al cargar partidos: ${error.message}`, 'error');
        allMatchesData = [];
    } else {
        allMatchesData = data || [];
    }
}