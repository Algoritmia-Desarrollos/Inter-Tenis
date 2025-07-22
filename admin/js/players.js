// Lógica para la página de jugadores (players.html)
document.addEventListener('DOMContentLoaded', async () => {
    await populateSelects(); 
    await renderPlayersList();

    // Event Listeners
    document.getElementById('player-form').addEventListener('submit', handlePlayerSubmit);
    document.getElementById('cancel-edit-player').addEventListener('click', cancelPlayerEdit);
    document.getElementById('search-player').addEventListener('input', renderPlayersList);
    document.getElementById('filter-by-category').addEventListener('change', renderPlayersList);
    document.getElementById('filter-by-team').addEventListener('change', renderPlayersList);
});

async function populateSelects() {
    const categorySelect = document.getElementById('player-category');
    const teamSelect = document.getElementById('player-team');
    const categoryFilter = document.getElementById('filter-by-category');
    const teamFilter = document.getElementById('filter-by-team');

    categorySelect.innerHTML = '<option value="">Seleccione categoría</option>';
    teamSelect.innerHTML = '<option value="">Seleccione equipo</option>';
    categoryFilter.innerHTML = '<option value="all">Todas las Categorías</option>';
    teamFilter.innerHTML = '<option value="all">Todos los Equipos</option>';

    const { data: categories } = await supabase.from('categories').select('*');
    if (categories) {
        categories.forEach(cat => {
            const option = `<option value="${cat.id}">${cat.name}</option>`;
            categorySelect.innerHTML += option;
            categoryFilter.innerHTML += option;
        });
    }

    const { data: teams } = await supabase.from('teams').select('*');
    if (teams) {
        teams.forEach(team => {
            const option = `<option value="${team.id}">${team.name}</option>`;
            teamSelect.innerHTML += option;
            teamFilter.innerHTML += option;
        });
    }
}

async function handlePlayerSubmit(event) {
    event.preventDefault();
    const playerId = document.getElementById('player-id').value;
    const playerName = document.getElementById('player-name').value;
    const categoryId = parseInt(document.getElementById('player-category').value);
    const teamId = parseInt(document.getElementById('player-team').value);
    
    if (playerName.trim() === '' || !categoryId || !teamId) {
        showToast('Nombre, categoría y equipo son obligatorios.', 'error');
        return;
    }

    const playerData = { name: playerName, category_id: categoryId, team_id: teamId };
    let error;

    if (playerId) {
        // Actualizar jugador existente
        ({ error } = await supabase.from('players').update(playerData).eq('id', playerId));
    } else {
        // Crear nuevo jugador
        ({ error } = await supabase.from('players').insert([playerData]));
    }

    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Jugador guardado con éxito.', 'success');
        await renderPlayersList();
        cancelPlayerEdit();
    }
}

async function renderPlayersList() {
    const container = document.getElementById('players-list');
    container.innerHTML = '';

    const searchTerm = document.getElementById('search-player').value.toLowerCase();
    const categoryFilter = document.getElementById('filter-by-category').value;
    const teamFilter = document.getElementById('filter-by-team').value;

    let query = supabase.from('players').select('*, categories(name), teams(name)');

    // Aplicar filtros
    if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
    }
    if (categoryFilter !== 'all') {
        query = query.eq('category_id', categoryFilter);
    }
    if (teamFilter !== 'all') {
        query = query.eq('team_id', teamFilter);
    }

    const { data: players, error } = await query.order('name');

    if (error || !players || players.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No se encontraron jugadores.</p>';
        return;
    }
    
    players.forEach(player => {
        const categoryName = player.categories ? player.categories.name : 'Sin categoría';
        const teamName = player.teams ? player.teams.name : 'Sin equipo';
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <span><strong>${player.name}</strong><br><small style="color: var(--text-secondary-color);">${categoryName} - ${teamName}</small></span>
            <div class="actions">
                <button class="btn" onclick='editPlayer(${JSON.stringify(player)})'>Editar</button>
                <button class="btn btn-danger" onclick="deletePlayer(${player.id})">Eliminar</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function editPlayer(player) {
    document.getElementById('player-id').value = player.id;
    document.getElementById('player-name').value = player.name;
    document.getElementById('player-category').value = player.category_id;
    document.getElementById('player-team').value = player.team_id;
    document.getElementById('cancel-edit-player').style.display = 'inline-block';
    window.scrollTo(0, 0);
}

function cancelPlayerEdit() {
    document.getElementById('player-form').reset();
    document.getElementById('player-id').value = '';
    document.getElementById('cancel-edit-player').style.display = 'none';
}

async function deletePlayer(id) {
    if (!confirm('¿Seguro?')) return;
    
    const { error } = await supabase.from('players').delete().eq('id', id);

    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Jugador eliminado.', 'success');
        await renderPlayersList();
    }
}