document.addEventListener('DOMContentLoaded', async () => {
    await renderCategoriesList();
    document.getElementById('category-form').addEventListener('submit', handleCategorySubmit);
});

async function handleCategorySubmit(event) {
    event.preventDefault();
    const categoryNameInput = document.getElementById('category-name');
    const categoryName = categoryNameInput.value;
    if (categoryName.trim() === '') return;

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
    container.innerHTML = '<h3>Lista de Categorías</h3>';

    const { data: categories, error } = await supabase.from('categories').select('*').order('name');
    if (error || !categories) return;

    if (categories.length === 0) {
        container.innerHTML += '<p class="placeholder-text">Aún no se han creado categorías.</p>';
        return;
    }

    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `<span>${cat.name}</span><button class="btn btn-danger" onclick="deleteCategory(${cat.id})">Eliminar</button>`;
        container.appendChild(div);
    });
}

async function deleteCategory(id) {
    if (!confirm('¿Seguro?')) return;
    
    const { error } = await supabase.from('categories').delete().eq('id', id);

    if (error) {
        showToast('Error al eliminar. Asegúrate que la categoría no esté en uso.', 'error');
    } else {
        showToast('Categoría eliminada.', 'success');
        await renderCategoriesList();
    }
}