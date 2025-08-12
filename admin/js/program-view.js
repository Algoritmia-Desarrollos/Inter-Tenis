// --- VARIABLES GLOBALES ---
let pendingConfirmations = new Map();
let pendingPlayerChanges = new Map();
let allPlayers = [];

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    if (!slug) {
        document.getElementById('program-content').innerHTML = '<h1>Programa no encontrado</h1><p>El enlace puede ser incorrecto.</p>';
        return;
    }

    const { data: playersData } = await supabase.from('players').select('id, name').order('name');
    if (playersData) {
        allPlayers = playersData;
    }

    await loadProgram(slug);
    
    document.getElementById('save-changes-btn').addEventListener('click', saveAllChanges);
});

async function loadProgram(slug) {
    const container = document.getElementById('program-content');
    container.innerHTML = '<p class="placeholder-text">Cargando programa...</p>';

    const { data: program, error: programError } = await supabase.from('programs').select('title, match_ids').eq('slug', slug).single();

    if (programError || !program) {
        container.innerHTML = `<h1>Programa no encontrado</h1><p>No se encontró un programa con el slug: <strong>${slug}</strong></p>`;
        return;
    }

    if (!program.match_ids || program.match_ids.length === 0) {
        container.innerHTML = `<h1>Programa Vacío</h1><p>Este programa no tiene partidos asociados.</p>`;
        return;
    }

    const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`*, player1:player1_id(id, name), player2:player2_id(id, name), categories(name)`)
        .in('id', program.match_ids);

    if (matchesError) {
        container.innerHTML = `<h1>Error</h1><p>No se pudieron cargar los datos de los partidos.</p>`;
        return;
    }
    
    renderProgram(program.title, matchesData, container);
}

function renderProgram(title, matches, container) {
    const groupedByVenue = matches.reduce((acc, match) => {
        const venue = match.location.split(' - ')[0].trim();
        if (!acc[venue]) { acc[venue] = {}; }
        const matchDate = new Date(match.match_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        if (!acc[venue][matchDate]) { acc[venue][matchDate] = []; }
        acc[venue][matchDate].push(match);
        return acc;
    }, {});
    
    const playerOptions = allPlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    let html = `
    <div class="program-header">
        <h1 class="main-title">${title}</h1>
        <a href="programs.html" class="btn btn-secondary btn-back">← Volver a Programas</a>
    </div>`;
    const sortedVenues = Object.keys(groupedByVenue).sort();

    for (const venue of sortedVenues) {
        html += `<h2 class="location-title">${venue}</h2>`;
        const days = groupedByVenue[venue];
        for (const day in days) {
            html += `<h3 class="day-title">${day}</h3>`;
            html += '<div class="table-wrapper">';
            html += '<table class="styled-table program-view-table">';
            html += `
                <thead>
                    <tr>
                        <th>Cancha</th>
                        <th>Hora</th>
                        <th>Jugador 1</th>
                        <th>Jugador 2</th>
                        <th>Categoría</th>
                    </tr>
                </thead>
                <tbody>
            `;
            const dayMatches = days[day].sort((a,b) => a.match_time.localeCompare(b.match_time));
            
            dayMatches.forEach(match => {
                const court = match.location.split(' - ')[1]?.trim() || '-';
                const p1_confirmed = match.p1_confirmed;
                const p2_confirmed = match.p2_confirmed;

                html += `
                    <tr data-match-id="${match.id}">
                        <td data-label="Cancha">${court}</td>
                        <td data-label="Hora">${match.match_time ? match.match_time.substring(0, 5) : ''} hs</td>
                        <td data-label="Jugador 1" class="player-cell">
                            <div class="player-select-wrapper">
                                <span class="player-confirm-toggle" title="Confirmar Asistencia" onclick="toggleConfirmation(this, ${match.id}, 'p1', ${!p1_confirmed})">
                                    <span class="status-icon ${p1_confirmed ? 'confirmed' : 'pending'}">${p1_confirmed ? '✓' : '?'}</span>
                                </span>
                                <select class="player-select" data-match-id="${match.id}" data-player-slot="p1" onchange="handlePlayerChange(event)">
                                    <option value="${match.player1.id}" selected>${match.player1.name}</option>
                                    ${playerOptions}
                                </select>
                            </div>
                        </td>
                        <td data-label="Jugador 2" class="player-cell">
                             <div class="player-select-wrapper">
                                <span class="player-confirm-toggle" title="Confirmar Asistencia" onclick="toggleConfirmation(this, ${match.id}, 'p2', ${!p2_confirmed})">
                                    <span class="status-icon ${p2_confirmed ? 'confirmed' : 'pending'}">${p2_confirmed ? '✓' : '?'}</span>
                                </span>
                                <select class="player-select" data-match-id="${match.id}" data-player-slot="p2" onchange="handlePlayerChange(event)">
                                    <option value="${match.player2.id}" selected>${match.player2.name}</option>
                                    ${playerOptions}
                                </select>
                             </div>
                        </td>
                        <td data-label="Categoría">${match.categories ? match.categories.name : 'N/A'}</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
        }
    }
    container.innerHTML = html;
}

function handlePlayerChange(event) {
    const select = event.target;
    const matchId = parseInt(select.dataset.matchId);
    const playerSlot = select.dataset.playerSlot;
    const newPlayerId = parseInt(select.value);

    const key = playerSlot === 'p1' ? 'player1_id' : 'player2_id';

    if (!pendingPlayerChanges.has(matchId)) {
        pendingPlayerChanges.set(matchId, {});
    }
    pendingPlayerChanges.get(matchId)[key] = newPlayerId;

    document.getElementById('save-changes-btn').style.display = 'block';
}

function toggleConfirmation(element, matchId, playerKey, newStatus) {
    const icon = element.querySelector('.status-icon');
    icon.textContent = newStatus ? '✓' : '?';
    icon.classList.toggle('confirmed', newStatus);
    icon.classList.toggle('pending', !newStatus);
    
    element.setAttribute('onclick', `toggleConfirmation(this, ${matchId}, '${playerKey}', ${!newStatus})`);

    const confirmationKey = `${playerKey}_confirmed`;
    if (!pendingConfirmations.has(matchId)) {
        pendingConfirmations.set(matchId, {});
    }
    pendingConfirmations.get(matchId)[confirmationKey] = newStatus;

    document.getElementById('save-changes-btn').style.display = 'block';
}

async function saveAllChanges() {
    const saveBtn = document.getElementById('save-changes-btn');
    
    const hasPlayerChanges = pendingPlayerChanges.size > 0;
    const hasConfirmationChanges = pendingConfirmations.size > 0;

    if (!hasPlayerChanges && !hasConfirmationChanges) {
        showToast('No hay cambios para guardar.', 'info');
        return;
    }

    if (!confirm('¿Estás seguro de que quieres guardar todos los cambios de jugadores y asistencias?')) {
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    const allChanges = new Map();

    pendingPlayerChanges.forEach((changes, id) => {
        if (!allChanges.has(id)) allChanges.set(id, {});
        Object.assign(allChanges.get(id), changes);
    });
    pendingConfirmations.forEach((changes, id) => {
        if (!allChanges.has(id)) allChanges.set(id, {});
        Object.assign(allChanges.get(id), changes);
    });

    const updatePromises = [];
    for (const [id, changes] of allChanges.entries()) {
        const promise = supabase.from('matches').update(changes).eq('id', id);
        updatePromises.push(promise);
    }

    try {
        const results = await Promise.all(updatePromises);
        const errorResult = results.find(res => res.error);
        if (errorResult) throw errorResult.error;

        showToast('Cambios guardados con éxito.', 'success');
        pendingConfirmations.clear();
        pendingPlayerChanges.clear();
        saveBtn.style.display = 'none';

        setTimeout(() => {
            location.reload();
        }, 1000);

    } catch (error) {
        showToast(`Error al guardar: ${error.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cambios';
    }
}