document.addEventListener('DOMContentLoaded', async () => {
    await renderCategoriesList();
    document.getElementById('category-form').addEventListener('submit', handleCategorySubmit);
    document.getElementById('bulk-delete-btn').addEventListener('click', handleBulkDelete);

    // Delete Modal listeners
    document.getElementById('close-modal-btn').addEventListener('click', closeDeleteModal);
    document.getElementById('delete-confirmation-input').addEventListener('input', validateConfirmationInput);

    // Edit Modal listeners
    document.getElementById('close-edit-modal-btn').addEventListener('click', closeEditModal);
    document.getElementById('edit-category-form').addEventListener('submit', handleUpdateCategory);
});

let selectedCategoryIds = new Set();
let deleteQueue = [];
let allCategories = []; // Cache for categories data

// --- SELECTION LOGIC ---

function handleItemClick(event) {
    if (event.target.tagName === 'BUTTON' || event.target.tagName === 'A' || event.target.type === 'checkbox') {
        return;
    }
    const checkbox = event.currentTarget.querySelector('.category-checkbox');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
    }
}

function updateSelectionState() {
    const bulkActionsContainer = document.getElementById('bulk-actions-container');
    const selectionCounter = document.getElementById('selection-counter');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    
    selectionCounter.textContent = `${selectedCategoryIds.size} seleccionadas`;
    
    if (selectedCategoryIds.size > 0) {
        bulkActionsContainer.style.display = 'flex';
    } else {
        bulkActionsContainer.style.display = 'none';
    }

    if (selectAllCheckbox) {
        const totalCheckboxes = document.querySelectorAll('.category-checkbox').length;
        selectAllCheckbox.checked = totalCheckboxes > 0 && selectedCategoryIds.size === totalCheckboxes;
    }
}

function toggleSelection(event) {
    const checkbox = event.target;
    const categoryId = parseInt(checkbox.dataset.id, 10);

    if (checkbox.checked) {
        selectedCategoryIds.add(categoryId);
    } else {
        selectedCategoryIds.delete(categoryId);
    }
    
    const listItem = checkbox.closest('.list-item');
    listItem.classList.toggle('selected', checkbox.checked);

    updateSelectionState();
}

function toggleSelectAll(event) {
    const checkboxes = document.querySelectorAll('.category-checkbox');
    selectedCategoryIds.clear();

    checkboxes.forEach(checkbox => {
        checkbox.checked = event.target.checked;
        const categoryId = parseInt(checkbox.dataset.id, 10);
        if (checkbox.checked) {
            selectedCategoryIds.add(categoryId);
        }
        const listItem = checkbox.closest('.list-item');
        listItem.classList.toggle('selected', checkbox.checked);
    });

    updateSelectionState();
}

// --- CRUD & RENDER ---

async function handleCategorySubmit(event) {
    event.preventDefault();
    const categoryNameInput = document.getElementById('category-name');
    const categoryName = categoryNameInput.value;
    if (categoryName.trim() === '') {
        showToast('El nombre de la categoría no puede estar vacío.', 'error');
        return;
    }

    const { error } = await supabase.from('categories').insert([{ name: categoryName }]);
    
    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Categoría creada con éxito.', 'success');
        categoryNameInput.value = '';
        await renderCategoriesList();
    }
}

async function renderCategoriesList() {
    const container = document.getElementById('categories-list');
    container.innerHTML = 'Cargando...';

    const { data: categories, error } = await supabase.from('categories').select('*').order('name');
    
    if (error) {
        container.innerHTML = '<p class="placeholder-text">Error al cargar las categorías.</p>';
        return;
    }

    allCategories = categories; // Cache the data
    container.innerHTML = '';

    if (categories.length === 0) {
        container.innerHTML = '<h3>Lista de Categorías</h3><p class="placeholder-text">Aún no se han creado categorías.</p>';
        return;
    }

    const header = document.createElement('div');
    header.className = 'list-item list-header';
    header.innerHTML = `
        <input type="checkbox" id="select-all-checkbox" title="Seleccionar todas">
        <span class="category-info-header">Categoría</span>
        <span class="actions-header">Acciones</span>
    `;
    container.appendChild(header);
    document.getElementById('select-all-checkbox').addEventListener('change', toggleSelectAll);

    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.classList.toggle('selected', selectedCategoryIds.has(cat.id));
        div.addEventListener('click', handleItemClick);

        div.innerHTML = `
            <input type="checkbox" class="category-checkbox" data-id="${cat.id}" ${selectedCategoryIds.has(cat.id) ? 'checked' : ''}>
            <div class="category-info">
                <span>${cat.name}</span>
            </div>
            <div class="actions">
                <button class="btn btn-secondary" onclick="openEditModal(${cat.id})">Editar</button>
                <button class="btn btn-danger" onclick="initiateDelete([${cat.id}])">Eliminar</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.category-checkbox').forEach(checkbox => {
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
    initiateDelete(Array.from(selectedCategoryIds));
}

async function executeDelete() {
    const idsToDelete = deleteQueue;
    if (idsToDelete.length === 0) return;

    await supabase.from('players').update({ category_id: null }).in('category_id', idsToDelete);
    const { error: deleteError } = await supabase.from('categories').delete().in('id', idsToDelete);

    if (deleteError) {
        showToast(`Error al eliminar categorías: ${deleteError.message}`, 'error');
    } else {
        showToast(`${idsToDelete.length} categoría(s) eliminada(s) con éxito.`, 'success');
    }

    selectedCategoryIds.clear();
    deleteQueue = [];
    closeDeleteModal();
    await renderCategoriesList();
}

// --- EDIT LOGIC ---

function openEditModal(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) {
        showToast('No se pudo encontrar la categoría.', 'error');
        return;
    }

    document.getElementById('edit-category-id').value = category.id;
    document.getElementById('edit-category-name').value = category.name;

    document.getElementById('edit-category-modal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('edit-category-modal').style.display = 'none';
}

async function handleUpdateCategory(event) {
    event.preventDefault();
    const id = document.getElementById('edit-category-id').value;
    const newName = document.getElementById('edit-category-name').value;

    if (newName.trim() === '') {
        showToast('El nombre de la categoría no puede estar vacío.', 'error');
        return;
    }

    const { error } = await supabase.from('categories').update({ name: newName }).eq('id', id);

    if (error) {
        showToast(`Error al actualizar la categoría: ${error.message}`, 'error');
    } else {
        showToast('Categoría actualizada con éxito.', 'success');
        closeEditModal();
        await renderCategoriesList();
    }
}

// --- MODAL LOGIC (DELETE) ---

function openDeleteModal() {
    const modal = document.getElementById('delete-confirmation-modal');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const confirmationText = document.getElementById('confirmation-text-key');
    
    const key = deleteQueue.length > 1 ? `ELIMINAR ${deleteQueue.length} CATEGORIAS` : 'ELIMINAR';
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
