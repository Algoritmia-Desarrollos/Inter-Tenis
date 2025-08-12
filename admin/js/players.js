// Lógica para la página de jugadores (players.html)
document.addEventListener('DOMContentLoaded', initializePlayersPage);

let selectedPlayerIds = new Set();
let allCategories = [];
let allTeams = [];

async function initializePlayersPage() {
    await loadInitialData();
    populateSelects();
    await renderPlayersList();
    setupEventListeners();
}

async function loadInitialData() {
    const { data: categoriesData } = await supabase.from('categories').select('*');
    if (categoriesData) allCategories = categoriesData;

    const { data: teamsData } = await supabase.from('teams').select('*');
    if (teamsData) allTeams = teamsData;
}

function populateSelects() {
    const selects = {
        category: document.getElementById('player-category'),
        team: document.getElementById('player-team'),
        categoryFilter: document.getElementById('filter-by-category'),
        teamFilter: document.getElementById('filter-by-team'),
        bulkCategory: document.getElementById('bulk-player-category'),
        bulkTeam: document.getElementById('bulk-player-team')
    };

    // Limpiar y poblar selects
    selects.category.innerHTML = '<option value="">Seleccione categoría</option>';
    allCategories.forEach(cat => selects.category.innerHTML += `<option value="${cat.id}">${cat.name}</option>`);

    selects.team.innerHTML = '<option value="">Seleccione equipo</option>';
    allTeams.forEach(team => selects.team.innerHTML += `<option value="${team.id}">${team.name}</option>`);

    selects.categoryFilter.innerHTML = '<option value="all">Todas las Categorías</option>';
    allCategories.forEach(cat => selects.categoryFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`);

    selects.teamFilter.innerHTML = '<option value="all">Todos los Equipos</option>';
    allTeams.forEach(team => selects.teamFilter.innerHTML += `<option value="${team.id}">${team.name}</option>`);

    selects.bulkCategory.innerHTML = '<option value="">No cambiar</option>';
    allCategories.forEach(cat => selects.bulkCategory.innerHTML += `<option value="${cat.id}">${cat.name}</option>`);

    selects.bulkTeam.innerHTML = '<option value="">No cambiar</option>';
    allTeams.forEach(team => selects.bulkTeam.innerHTML += `<option value="${team.id}">${team.name}</option>`);
}

function setupEventListeners() {
    document.getElementById('player-form').addEventListener('submit', handlePlayerSubmit);
    document.getElementById('cancel-edit-player').addEventListener('click', cancelPlayerEdit);
    document.getElementById('search-player').addEventListener('input', renderPlayersList);
    document.getElementById('filter-by-category').addEventListener('change', renderPlayersList);
    document.getElementById('filter-by-team').addEventListener('change', renderPlayersList);
    document.getElementById('select-all-checkbox').addEventListener('change', handleSelectAll);
    document.getElementById('bulk-delete-btn').addEventListener('click', handleBulkDelete);
    document.getElementById('bulk-edit-btn').addEventListener('click', openBulkEditModal);
    document.querySelector('#bulk-edit-modal .close-button').addEventListener('click', closeBulkEditModal);
    document.getElementById('save-bulk-edit-btn').addEventListener('click', handleBulkEditSave);
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
        ({ error } = await supabase.from('players').update(playerData).eq('id', playerId));
    } else {
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
    container.innerHTML = '<div class="loader"></div>'; // Muestra un loader

    const searchTerm = document.getElementById('search-player').value.toLowerCase();
    const categoryFilter = document.getElementById('filter-by-category').value;
    const teamFilter = document.getElementById('filter-by-team').value;

    let query = supabase.from('players').select('*, categories(name), teams(name, image_url)');

    if (searchTerm) query = query.ilike('name', `%${searchTerm}%`);
    if (categoryFilter !== 'all') query = query.eq('category_id', categoryFilter);
    if (teamFilter !== 'all') query = query.eq('team_id', teamFilter);

    const { data: players, error } = await query.order('name');
    container.innerHTML = '';

    if (error || !players || players.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No se encontraron jugadores.</p>';
        return;
    }

    players.forEach(player => {
        const categoryName = player.categories ? player.categories.name : 'Sin categoría';
        const teamName = player.teams ? player.teams.name : 'Sin equipo';
        const teamImage = player.teams ? player.teams.image_url : null;

        const teamImageHtml = teamImage
            ? `<img src="${teamImage}" alt="${teamName}" class="team-image-small">`
            : `<div class="team-image-placeholder-small"></div>`;

        const div = document.createElement('div');
        div.className = 'list-item player-row';
        div.innerHTML = `
            <div class="player-col-select">
                <input type="checkbox" class="player-checkbox" data-id="${player.id}" ${selectedPlayerIds.has(player.id) ? 'checked' : ''}>
            </div>
            <div class="player-col-name">
                <strong>${player.name}</strong>
            </div>
            <div class="player-col-category">
                ${categoryName}
            </div>
            <div class="player-col-team">
                ${teamImageHtml}
                <span>${teamName}</span>
            </div>
            <div class="player-col-actions actions">
                <button class="btn" onclick='editPlayer(${JSON.stringify(player)})'>Editar</button>
                <button class="btn btn-danger" onclick="deletePlayer(${player.id})">Eliminar</button>
            </div>
        `;
        container.appendChild(div);
    });

    // Añadir listeners a las filas de los jugadores
    document.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Evitar que el clic en los botones de acción active la selección de la fila
            if (e.target.closest('.actions')) {
                return;
            }
            const checkbox = item.querySelector('.player-checkbox');
            const id = parseInt(checkbox.dataset.id);
            const isSelected = !checkbox.checked;
            
            checkbox.checked = isSelected;
            togglePlayerSelection(id, isSelected);
            item.classList.toggle('selected', isSelected);
        });
    });

    updateBulkActionUI();
}

function togglePlayerSelection(playerId, isSelected) {
    if (isSelected) {
        selectedPlayerIds.add(playerId);
    } else {
        selectedPlayerIds.delete(playerId);
    }
    updateBulkActionUI();
}

function updateBulkActionUI() {
    const bulkActionsContainer = document.getElementById('bulk-actions');
    const selectionCounter = document.getElementById('selection-counter');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const visibleCheckboxes = document.querySelectorAll('.player-checkbox');

    if (selectedPlayerIds.size > 0) {
        bulkActionsContainer.style.display = 'flex';
        selectionCounter.textContent = `${selectedPlayerIds.size} seleccionados`;
    } else {
        bulkActionsContainer.style.display = 'none';
    }

    // Sincronizar el checkbox "Seleccionar Todo"
    if (visibleCheckboxes.length > 0 && selectedPlayerIds.size === visibleCheckboxes.length) {
        selectAllCheckbox.checked = true;
    } else {
        selectAllCheckbox.checked = false;
    }
}

function handleSelectAll(event) {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll('.player-checkbox');
    checkboxes.forEach(checkbox => {
        const id = parseInt(checkbox.dataset.id);
        checkbox.checked = isChecked;
        togglePlayerSelection(id, isChecked);
    });
}

async function handleBulkDelete() {
    if (selectedPlayerIds.size === 0) {
        showToast('No hay jugadores seleccionados.', 'error');
        return;
    }
    if (!confirm(`¿Seguro que quieres eliminar ${selectedPlayerIds.size} jugadores?`)) return;

    const playerIdsToDelete = Array.from(selectedPlayerIds);
    const { error } = await supabase.from('players').delete().in('id', playerIdsToDelete);

    if (error) {
        showToast(`Error al eliminar: ${error.message}`, 'error');
    } else {
        showToast(`${playerIdsToDelete.length} jugadores eliminados.`, 'success');
        selectedPlayerIds.clear();
        await renderPlayersList();
    }
}

function openBulkEditModal() {
    if (selectedPlayerIds.size === 0) {
        showToast('No hay jugadores seleccionados para editar.', 'error');
        return;
    }
    document.getElementById('bulk-edit-modal').style.display = 'block';
}

function closeBulkEditModal() {
    document.getElementById('bulk-edit-modal').style.display = 'none';
    document.getElementById('bulk-player-category').value = "";
    document.getElementById('bulk-player-team').value = "";
}

async function handleBulkEditSave() {
    const newCategoryId = document.getElementById('bulk-player-category').value;
    const newTeamId = document.getElementById('bulk-player-team').value;

    if (!newCategoryId && !newTeamId) {
        showToast('Selecciona al menos una categoría o un equipo para actualizar.', 'error');
        return;
    }

    const updates = {};
    if (newCategoryId) updates.category_id = parseInt(newCategoryId);
    if (newTeamId) updates.team_id = parseInt(newTeamId);

    const playerIdsToUpdate = Array.from(selectedPlayerIds);
    const { error } = await supabase.from('players').update(updates).in('id', playerIdsToUpdate);

    if (error) {
        showToast(`Error al actualizar: ${error.message}`, 'error');
    } else {
        showToast(`${playerIdsToUpdate.length} jugadores actualizados.`, 'success');
        selectedPlayerIds.clear();
        closeBulkEditModal();
        await renderPlayersList();
    }
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
    if (!confirm('¿Seguro que quieres eliminar a este jugador?')) return;

    const { error } = await supabase.from('players').delete().eq('id', id);

    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Jugador eliminado.', 'success');
        selectedPlayerIds.delete(id); // Asegurarse de que no quede seleccionado
        await renderPlayersList();
    }
}
