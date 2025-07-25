// --- VARIABLES GLOBALES ---
let pendingConfirmations = new Map();
let currentProgramMatches = [];

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    if (!slug) {
        document.getElementById('program-container').innerHTML = '<h1>Programa no encontrado</h1><p>El enlace puede ser incorrecto.</p>';
        return;
    }

    await loadProgram(slug);
    
    document.getElementById('save-confirmations-btn').addEventListener('click', saveConfirmations);
});

async function loadProgram(slug) {
    const container = document.getElementById('program-container');
    container.innerHTML = '<p class="placeholder-text">Cargando programa...</p>';

    // 1. Obtener el programa y los IDs de los partidos
    const { data: program, error: programError } = await supabase.from('programs').select('title, match_ids').eq('slug', slug).single();

    if (programError || !program) {
        container.innerHTML = `<h1>Programa no encontrado</h1><p>No se encontró un programa con el slug: <strong>${slug}</strong></p>`;
        return;
    }

    if (!program.match_ids || program.match_ids.length === 0) {
        container.innerHTML = `<h1>Programa Vacío</h1><p>Este programa no tiene partidos asociados.</p>`;
        return;
    }

    // 2. Obtener los datos actualizados de los partidos usando los IDs
    const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`*, player1:player1_id(name), player2:player2_id(name), categories(name)`)
        .in('id', program.match_ids);

    if (matchesError) {
        container.innerHTML = `<h1>Error</h1><p>No se pudieron cargar los datos de los partidos.</p>`;
        return;
    }

    currentProgramMatches = matchesData;
    renderProgram(program.title, currentProgramMatches, container);
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

    let html = `<h1 class="main-title" style="text-align: center; margin-bottom: 2rem;">${title}</h1>`;
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
                const p1Icon = match.p1_confirmed ? '✓' : '?';
                const p1Class = match.p1_confirmed ? 'confirmed' : 'pending';
                const p2Icon = match.p2_confirmed ? '✓' : '?';
                const p2Class = match.p2_confirmed ? 'confirmed' : 'pending';

                html += `
                    <tr data-match-id="${match.id}">
                        <td>${match.match_time ? match.match_time.substring(0, 5) : ''} hs</td>
                        <td class="player-cell">
                            <span class="player-confirm-toggle" onclick="toggleConfirmation(this, ${match.id}, 'p1', ${!match.p1_confirmed})">
                                <span class="status-icon ${p1Class}">${p1Icon}</span>
                                ${match.player1.name}
                            </span>
                        </td>
                        <td class="player-cell">
                            <span class="player-confirm-toggle" onclick="toggleConfirmation(this, ${match.id}, 'p2', ${!match.p2_confirmed})">
                                <span class="status-icon ${p2Class}">${p2Icon}</span>
                                ${match.player2.name}
                            </span>
                        </td>
                        <td>${match.categories ? match.categories.name : 'N/A'}</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
        }
    }
    container.innerHTML = html;
}

function toggleConfirmation(element, matchId, playerKey, newStatus) {
    // Actualizar UI
    const icon = element.querySelector('.status-icon');
    icon.textContent = newStatus ? '✓' : '?';
    icon.classList.toggle('confirmed', newStatus);
    icon.classList.toggle('pending', !newStatus);
    
    // Actualizar el handler del evento
    element.setAttribute('onclick', `toggleConfirmation(this, ${matchId}, '${playerKey}', ${!newStatus})`);

    // Guardar cambio pendiente
    const confirmationKey = `${playerKey}_confirmed`;
    if (!pendingConfirmations.has(matchId)) {
        pendingConfirmations.set(matchId, {});
    }
    pendingConfirmations.get(matchId)[confirmationKey] = newStatus;

    document.getElementById('save-confirmations-btn').style.display = 'block';
}

async function saveConfirmations() {
    const saveBtn = document.getElementById('save-confirmations-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    const updatePromises = [];
    for (const [id, changes] of pendingConfirmations.entries()) {
        const promise = supabase.from('matches').update(changes).eq('id', id);
        updatePromises.push(promise);
    }

    try {
        const results = await Promise.all(updatePromises);
        const error = results.find(res => res.error);
        if (error) throw error.error;

        showToast('Confirmaciones guardadas con éxito.', 'success');
        pendingConfirmations.clear();
        saveBtn.style.display = 'none';

        // Opcional: recargar para ver los cambios reflejados si hay dudas.
        // La UI ya está actualizada, pero esto re-confirma desde la DB.
        setTimeout(() => {
            location.reload();
        }, 1000);

    } catch (error) {
        showToast(`Error al guardar: ${error.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cambios de Asistencia';
    }
}
