document.addEventListener('DOMContentLoaded', () => {
    renderProgramsList();
    document.getElementById('search-program').addEventListener('input', renderProgramsList);
});

async function renderProgramsList() {
    const tbody = document.getElementById('programs-list-tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="placeholder-text">Cargando programas...</td></tr>';

    const searchTerm = document.getElementById('search-program').value.toLowerCase();

    const { data: programs, error } = await supabase
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="3" class="placeholder-text">Error al cargar los programas.</td></tr>';
        return;
    }

    const filteredPrograms = programs.filter(p => p.title.toLowerCase().includes(searchTerm));

    if (filteredPrograms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="placeholder-text">No se encontraron programas.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    filteredPrograms.forEach(program => {
        const row = document.createElement('tr');
        const programUrl = `${window.location.origin}/public/program.html?slug=${program.slug}`;
        const creationDate = new Date(program.created_at).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        row.innerHTML = `
            <td><strong>${program.title}</strong></td>
            <td>${creationDate}</td>
            <td class="actions-cell">
                <a href="${programUrl}" class="btn" target="_blank">Ver Programa</a>
            </td>
        `;
        tbody.appendChild(row);
    });
}