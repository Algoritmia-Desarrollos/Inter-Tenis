// Lógica para la página de equipos (teams.html)
document.addEventListener('DOMContentLoaded', async () => {
    await renderTeamsList();
    // Main form
    document.getElementById('team-form').addEventListener('submit', handleTeamSubmit);
    
    // Bulk actions
    document.getElementById('bulk-delete-btn').addEventListener('click', handleBulkDelete);
    
    // Delete Modal listeners
    document.getElementById('close-modal-btn').addEventListener('click', closeDeleteModal);
    document.getElementById('delete-confirmation-input').addEventListener('input', validateConfirmationInput);

    // Edit Modal listeners
    document.getElementById('close-edit-modal-btn').addEventListener('click', closeEditModal);
    document.getElementById('edit-team-form').addEventListener('submit', handleUpdateTeam);
});

let selectedTeamIds = new Set();
let deleteQueue = [];
let allTeams = []; // Cache for teams data

// --- SELECTION LOGIC ---

function handleItemClick(event) {
    // Don't trigger if a button, a link or the checkbox itself was clicked
    if (event.target.tagName === 'BUTTON' || event.target.tagName === 'A' || event.target.type === 'checkbox') {
        return;
    }
    const checkbox = event.currentTarget.querySelector('.team-checkbox');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        // Manually trigger the change event to update selection state
        checkbox.dispatchEvent(new Event('change'));
    }
}

function updateSelectionState() {
    const bulkActionsContainer = document.getElementById('bulk-actions-container');
    const selectionCounter = document.getElementById('selection-counter');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    
    selectionCounter.textContent = `${selectedTeamIds.size} seleccionados`;
    
    if (selectedTeamIds.size > 0) {
        bulkActionsContainer.style.display = 'flex';
    } else {
        bulkActionsContainer.style.display = 'none';
    }

    if (selectAllCheckbox) {
        const totalCheckboxes = document.querySelectorAll('.team-checkbox').length;
        selectAllCheckbox.checked = totalCheckboxes > 0 && selectedTeamIds.size === totalCheckboxes;
    }
}

function toggleSelection(event) {
    const checkbox = event.target;
    const teamId = parseInt(checkbox.dataset.id, 10);

    if (checkbox.checked) {
        selectedTeamIds.add(teamId);
    } else {
        selectedTeamIds.delete(teamId);
    }
    
    const listItem = checkbox.closest('.list-item');
    listItem.classList.toggle('selected', checkbox.checked);

    updateSelectionState();
}

function toggleSelectAll(event) {
    const checkboxes = document.querySelectorAll('.team-checkbox');
    selectedTeamIds.clear();

    checkboxes.forEach(checkbox => {
        checkbox.checked = event.target.checked;
        const teamId = parseInt(checkbox.dataset.id, 10);
        if (checkbox.checked) {
            selectedTeamIds.add(teamId);
        }
        const listItem = checkbox.closest('.list-item');
        listItem.classList.toggle('selected', checkbox.checked);
    });

    updateSelectionState();
}


// --- CRUD & RENDER ---

async function handleTeamSubmit(event) {
    event.preventDefault();
    const teamNameInput = document.getElementById('team-name');
    const teamImageInput = document.getElementById('team-image');
    const teamName = teamNameInput.value;
    const teamImageFile = teamImageInput.files[0];

    if (teamName.trim() === '') {
        showToast('El nombre del equipo no puede estar vacío.', 'error');
        return;
    }

    let imageUrl = null;

    if (teamImageFile) {
        const fileName = `${Date.now()}-${teamImageFile.name}`;
        const { error: uploadError } = await supabase.storage
            .from('team-images')
            .upload(fileName, teamImageFile);

        if (uploadError) {
            showToast(`Error al subir la imagen: ${uploadError.message}`, 'error');
            return;
        }

        const { data: urlData } = supabase.storage.from('team-images').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from('teams').insert([{ name: teamName, image_url: imageUrl }]);
    
    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Equipo creado con éxito.', 'success');
        teamNameInput.value = '';
        teamImageInput.value = '';
        await renderTeamsList();
    }
}

async function renderTeamsList() {
    const container = document.getElementById('teams-list');
    container.innerHTML = 'Cargando...'; // Loading state

    const { data: teams, error } = await supabase.from('teams').select('*').order('name');
    
    if (error) {
        container.innerHTML = '<p class="placeholder-text">Error al cargar los equipos.</p>';
        return;
    }
    
    allTeams = teams; // Cache the data
    container.innerHTML = ''; // Clear loading state

    if (teams.length === 0) {
        container.innerHTML = '<h3>Lista de Equipos</h3><p class="placeholder-text">Aún no se han creado equipos.</p>';
        return;
    }

    const header = document.createElement('div');
    header.className = 'list-item list-header';
    header.innerHTML = `
        <input type="checkbox" id="select-all-checkbox" title="Seleccionar todos">
        <span class="team-info-header">Equipo</span>
        <span class="actions-header">Acciones</span>
    `;
    container.appendChild(header);
    document.getElementById('select-all-checkbox').addEventListener('change', toggleSelectAll);

    teams.forEach(team => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.classList.toggle('selected', selectedTeamIds.has(team.id));
        div.addEventListener('click', handleItemClick);

        const imageHtml = team.image_url 
            ? `<img src="${team.image_url}" alt="Imagen del equipo ${team.name}" class="team-image">`
            : '<div class="team-image-placeholder"></div>';

        div.innerHTML = `
            <input type="checkbox" class="team-checkbox" data-id="${team.id}" ${selectedTeamIds.has(team.id) ? 'checked' : ''}>
            <div class="team-info">
                ${imageHtml}
                <span>${team.name}</span>
            </div>
            <div class="actions">
                <button class="btn btn-secondary" onclick="openEditModal(${team.id})">Editar</button>
                <button class="btn btn-danger" onclick="initiateDelete([${team.id}])">Eliminar</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.team-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', toggleSelection);
    });
    
    updateSelectionState();
}

// --- DELETE LOGIC ---

function initiateDelete(ids) {
    if (ids.length === 0) return;
    deleteQueue = ids;
    openDeleteModal();
}

function handleBulkDelete() {
    initiateDelete(Array.from(selectedTeamIds));
}

async function executeDelete() {
    const idsToDelete = deleteQueue;
    if (idsToDelete.length === 0) return;

    const teamsToDelete = allTeams.filter(t => idsToDelete.includes(t.id));
    const imagePathsToDelete = teamsToDelete
        .filter(t => t.image_url)
        .map(t => new URL(t.image_url).pathname.split('/').pop());

    if (imagePathsToDelete.length > 0) {
        await supabase.storage.from('team-images').remove(imagePathsToDelete);
    }

    await supabase.from('players').update({ team_id: null }).in('team_id', idsToDelete);
    const { error: deleteTeamError } = await supabase.from('teams').delete().in('id', idsToDelete);

    if (deleteTeamError) {
        showToast(`Error al eliminar equipos: ${deleteTeamError.message}`, 'error');
    } else {
        showToast(`${idsToDelete.length} equipo(s) eliminado(s) con éxito.`, 'success');
    }

    selectedTeamIds.clear();
    deleteQueue = [];
    closeDeleteModal();
    await renderTeamsList();
}

// --- EDIT LOGIC ---

function openEditModal(id) {
    const team = allTeams.find(t => t.id === id);
    if (!team) {
        showToast('No se pudo encontrar el equipo.', 'error');
        return;
    }

    document.getElementById('edit-team-id').value = team.id;
    document.getElementById('edit-team-name').value = team.name;
    document.getElementById('edit-team-image').value = ''; // Clear file input

    document.getElementById('edit-team-modal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('edit-team-modal').style.display = 'none';
}

async function handleUpdateTeam(event) {
    event.preventDefault();
    const id = document.getElementById('edit-team-id').value;
    const newName = document.getElementById('edit-team-name').value;
    const newImageFile = document.getElementById('edit-team-image').files[0];

    if (newName.trim() === '') {
        showToast('El nombre del equipo no puede estar vacío.', 'error');
        return;
    }

    const updateData = { name: newName };
    let oldImageUrl = null;

    if (newImageFile) {
        const team = allTeams.find(t => t.id == id);
        oldImageUrl = team ? team.image_url : null;

        const fileName = `${Date.now()}-${newImageFile.name}`;
        const { error: uploadError } = await supabase.storage
            .from('team-images')
            .upload(fileName, newImageFile);

        if (uploadError) {
            showToast(`Error al subir la nueva imagen: ${uploadError.message}`, 'error');
            return;
        }
        const { data: urlData } = supabase.storage.from('team-images').getPublicUrl(fileName);
        updateData.image_url = urlData.publicUrl;
    }

    const { error: updateError } = await supabase.from('teams').update(updateData).eq('id', id);

    if (updateError) {
        showToast(`Error al actualizar el equipo: ${updateError.message}`, 'error');
    } else {
        if (oldImageUrl) {
            const oldImagePath = new URL(oldImageUrl).pathname.split('/').pop();
            await supabase.storage.from('team-images').remove([oldImagePath]);
        }
        showToast('Equipo actualizado con éxito.', 'success');
        closeEditModal();
        await renderTeamsList();
    }
}


// --- MODAL LOGIC (DELETE) ---

function openDeleteModal() {
    const modal = document.getElementById('delete-confirmation-modal');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const confirmationText = document.getElementById('confirmation-text-key');
    
    const key = deleteQueue.length > 1 ? `ELIMINAR ${deleteQueue.length} EQUIPOS` : 'ELIMINAR';
    confirmationText.textContent = key;

    modal.style.display = 'block';
    document.getElementById('delete-confirmation-input').value = '';
    confirmBtn.disabled = true;
    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.disabled = true;
    newConfirmBtn.addEventListener('click', executeDelete);
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-confirmation-modal');
    modal.style.display = 'none';
    deleteQueue = [];
}

function validateConfirmationInput() {
    const input = document.getElementById('delete-confirmation-input');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const confirmationText = document.getElementById('confirmation-text-key').textContent;
    
    if (input.value === confirmationText) {
        confirmBtn.disabled = false;
    } else {
        confirmBtn.disabled = true;
    }
}
