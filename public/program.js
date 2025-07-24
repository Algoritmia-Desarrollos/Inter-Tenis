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

    const { data: program, error } = await supabase
        .from('programs')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error || !program) {
        container.innerHTML = `<h1>Programa no encontrado</h1><p>No se encontró un programa con el slug: <strong>${slug}</strong></p>`;
        return;
    }

    renderProgram(program, container);
});

function renderProgram(program, container) {
    const matches = program.matches_data;

    const groupedByVenue = matches.reduce((acc, match) => {
        const venue = match.location.split(' - ')[0].trim();
        if (!acc[venue]) { acc[venue] = {}; }
        
        const matchDate = new Date(match.match_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        if (!acc[venue][matchDate]) { acc[venue][matchDate] = []; }

        acc[venue][matchDate].push(match);
        return acc;
    }, {});

    let html = `<h1 class="main-title">${program.title}</h1>`;
    const sortedVenues = Object.keys(groupedByVenue).sort();

    for (const venue of sortedVenues) {
        html += `<h2 class="location-title">${venue}</h2>`;
        
        const days = groupedByVenue[venue];
        for (const day in days) {
            html += `<h3 class="day-title">${day}</h3>`;
            html += '<div class="table-wrapper">';
            html += '<table class="program-table">';
            html += `
                <thead>
                    <tr>
                        <th>Cancha</th>
                        <th>Hora</th>
                        <th>Jugador 1</th>
                        <th></th>
                        <th>Jugador 2</th>
                        <th>Categoría</th>
                        <th>Anotar Resultado</th>
                    </tr>
                </thead>
                <tbody>
            `;
            const dayMatches = days[day].sort((a,b) => a.match_time.localeCompare(b.match_time));
            
            dayMatches.forEach(match => {
                const court = match.location.split(' - ')[1]?.trim() || '-';
                
                const p1Class = match.p1_confirmed ? 'player-confirmed' : 'player-unconfirmed';
                const p2Class = match.p2_confirmed ? 'player-confirmed' : 'player-unconfirmed';
                
                let anotadorHtml = '<span style="color: var(--text-secondary-color);">No disponible</span>';
                if (match.submission_token) {
                    const submitUrl = `submit-result.html?id=${match.id}&token=${match.submission_token}`;
                    anotadorHtml = `<a href="${submitUrl}" class="btn-program" target="_blank">Anotar</a>`;
                }
                
                html += `
                    <tr>
                        <td>${court}</td>
                        <td>${match.match_time ? match.match_time.substring(0, 5) : ''} hs</td>
                        <td class="player-name ${p1Class}">${match.player1.name}</td>
                        <td class="vs-cell">vs</td>
                        <td class="player-name ${p2Class}">${match.player2.name}</td>
                        <td>${match.categories ? match.categories.name : 'N/A'}</td>
                        <td>${anotadorHtml}</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
        }
    }
    container.innerHTML = html;
}