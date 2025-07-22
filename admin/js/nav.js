document.addEventListener('DOMContentLoaded', async () => {
    /*
    // Proteger la página
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && !window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html';
        return;
    }
    */

    const header = document.getElementById('main-header');
    if (!header) return;

    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = [
        { href: 'tournaments.html', text: 'Torneos' },
        { href: 'matches.html', text: 'Partidos' },
        { href: 'players.html', text: 'Jugadores' },
        { href: 'teams.html', text: 'Equipos' },
        { href: 'categories.html', text: 'Categorías' },
        { href: 'rankings.html', text: 'Rankings' }
    ];

    header.innerHTML = `
        <div class="container nav-container">
            <nav class="main-nav">${navLinks.map(link => `<a href="${link.href}" class="nav-link ${currentPage === link.href ? 'active' : ''}">${link.text}</a>`).join('')}</nav>
            <div class="nav-actions">
                <div class="search-container">
                    <input type="text" id="player-search-nav" placeholder="Buscar jugador...">
                    <div id="search-results-nav" class="search-results"></div>
                </div>
                <button id="logout-btn" class="btn btn-danger">Salir</button>
            </div>
        </div>`;

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    // Lógica de la barra de búsqueda
    const searchInput = document.getElementById('player-search-nav');
    const searchResults = document.getElementById('search-results-nav');
    
    searchInput.addEventListener('input', async () => {
        const query = searchInput.value.toLowerCase();
        searchResults.innerHTML = '';
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        
        // --- CORREGIDO: Busca directamente en Supabase ---
        const { data: players } = await supabase.from('players').select('id, name').ilike('name', `%${query}%`);
        
        if (players && players.length > 0) {
            players.forEach(player => {
                const item = document.createElement('a');
                item.href = `player-dashboard.html?id=${player.id}`;
                item.textContent = player.name;
                searchResults.appendChild(item);
            });
            searchResults.style.display = 'block';
        } else {
            searchResults.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.style.display = 'none';
        }
    });
});