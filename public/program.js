const SUPABASE_URL = 'https://vulzfuwesigberabbbhx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1bHpmdXdlc2lnYmVyYWJiYmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMTExOTEsImV4cCI6MjA2ODc4NzE5MX0.5ndfB7FxvW6B4UVny198BiVlw-1BhJ98Xg_iyAEiFQw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const container = document.getElementById('program-container');

    if (!slug) {
        container.innerHTML = '<h1>Programa no encontrado</h1><p>El enlace puede ser incorrecto.</p>';
        return;
    }

    const { data: program, error: programError } = await supabase
        .from('programs')
        .select('title, match_ids')
        .eq('slug', slug)
        .single();

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
        .select(`*, player1:player1_id(name), player2:player2_id(name)`)
        .in('id', program.match_ids);

    if (matchesError) {
        container.innerHTML = `<h1>Error</h1><p>No se pudieron cargar los datos de los partidos.</p>`;
        return;
    }

    renderProgram(program.title, matchesData, container);
});

function renderProgram(title, matches, container) {
    const groupedByVenue = matches.reduce((acc, match) => {
        const venue = match.location.split(' - ')[0].trim();
        if (!acc[venue]) { acc[venue] = {}; }
        
        const matchDate = new Date(match.match_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        if (!acc[venue][matchDate]) { acc[venue][matchDate] = []; }

        acc[venue][matchDate].push(match);
        return acc;
    }, {});

    let html = `<h1 class="main-title">${title}</h1>`;
    const sortedVenues = Object.keys(groupedByVenue).sort();

    for (const venue of sortedVenues) {
        html += `<h2 class="location-title">${venue}</h2>`;
        
        const days = groupedByVenue[venue];
        for (const day in days) {
            html += `<h3 class="day-title">${day}</h3>`;

            // --- VISTA DE TABLA PARA ESCRITORIO ---
            html += '<div class="table-wrapper desktop-only">';
            html += '<table class="program-table">';
            html += `
                <thead>
                    <tr>
                        <th>Cancha</th>
                        <th>Hora</th>
                        <th>Jugador 1</th>
                        <th></th>
                        <th>Jugador 2</th>
                    </tr>
                </thead>
                <tbody>
            `;
            const dayMatches = days[day].sort((a,b) => a.match_time.localeCompare(b.match_time));
            
            dayMatches.forEach(match => {
                const court = match.location.split(' - ')[1]?.trim() || '-';
                const p1Class = match.p1_confirmed ? 'player-confirmed' : 'player-unconfirmed';
                const p2Class = match.p2_confirmed ? 'player-confirmed' : 'player-unconfirmed';
                
                html += `
                    <tr>
                        <td>${court}</td>
                        <td>${match.match_time ? match.match_time.substring(0, 5) : ''} hs</td>
                        <td class="player-name ${p1Class}">${match.player1.name}</td>
                        <td class="vs-cell">vs</td>
                        <td class="player-name ${p2Class}">${match.player2.name}</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';


            // --- VISTA DE TARJETAS PARA MÓVIL ---
            html += '<div class="program-grid mobile-only">';
            dayMatches.forEach(match => {
                 const court = match.location.split(' - ')[1]?.trim() || '-';
                 const time = match.match_time ? match.match_time.substring(0, 5) + ' hs' : '';
                 const p1Class = match.p1_confirmed ? 'player-confirmed' : 'player-unconfirmed';
                 const p2Class = match.p2_confirmed ? 'player-confirmed' : 'player-unconfirmed';

                html += `
                    <div class="match-card">
                        <div class="match-meta">
                            <span>${court}</span>
                            <span>${time}</span>
                        </div>
                        <div class="match-players">
                            <div class="player ${p1Class}">${match.player1.name}</div>
                            <div class="vs">vs</div>
                            <div class="player ${p2Class}">${match.player2.name}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
    }
    container.innerHTML = html;
}