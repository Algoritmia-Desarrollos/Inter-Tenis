document.addEventListener('DOMContentLoaded', () => {
    renderProgramsList();
    document.getElementById('search-program').addEventListener('input', renderProgramsList);
    document.getElementById('select-all-programs').addEventListener('change', handleSelectAll);
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelectedPrograms);
});

async function renderProgramsList() {
    const tbody = document.getElementById('programs-list-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="placeholder-text">Cargando programas...</td></tr>';

    const searchTerm = document.getElementById('search-program').value.toLowerCase();

    // 1. Obtener todos los programas
    const { data: programs, error: programsError } = await supabase
        .from('programs')
        .select('id, title, slug, created_at, match_ids')
        .order('created_at', { ascending: false });

    if (programsError) {
        tbody.innerHTML = `<tr><td colspan="7" class="placeholder-text">Error al cargar los programas: ${programsError.message}</td></tr>`;
        return;
    }

    // 2. Recopilar todos los IDs de partidos de todos los programas
    const allMatchIds = [...new Set(programs.flatMap(p => p.match_ids || []))];

    // 3. Obtener todos los partidos necesarios en una sola consulta
    let matchesById = {};
    if (allMatchIds.length > 0) {
        const { data: matchesData, error: matchesError } = await supabase
            .from('matches')
            .select('id, player1_id, player2_id, p1_confirmed, p2_confirmed, match_date')
            .in('id', allMatchIds);
        
        if (matchesError) {
            tbody.innerHTML = `<tr><td colspan="7" class="placeholder-text">Error al cargar los datos de los partidos.</td></tr>`;
            return;
        }
        matchesById = matchesData.reduce((acc, match) => {
            acc[match.id] = match;
            return acc;
        }, {});
    }

    const filteredPrograms = programs.filter(p => p.title.toLowerCase().includes(searchTerm));

    if (filteredPrograms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="placeholder-text">No se encontraron programas.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    filteredPrograms.forEach(program => {
        const row = document.createElement('tr');
        const programAdminUrl = `program-view.html?slug=${program.slug}`;
        const programPublicUrl = `${window.location.origin}/public/program.html?slug=${program.slug}`;
        const creationDate = new Date(program.created_at).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const programMatches = (program.match_ids || []).map(id => matchesById[id]).filter(Boolean);
        
        const playerIds = new Set();
        let confirmedCount = 0;
        programMatches.forEach(match => {
            playerIds.add(match.player1_id);
            playerIds.add(match.player2_id);
            if (match.p1_confirmed) confirmedCount++;
            if (match.p2_confirmed) confirmedCount++;
        });
        const playerCount = playerIds.size;
        const totalSlots = programMatches.length * 2;

        let dateRange = 'N/A';
        if (programMatches.length > 0) {
            const dates = programMatches.map(m => new Date(m.match_date + 'T00:00:00'));
            const minDate = new Date(Math.min.apply(null, dates));
            const maxDate = new Date(Math.max.apply(null, dates));
            const formatDate = (date) => date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            dateRange = minDate.getTime() === maxDate.getTime() ? formatDate(minDate) : `${formatDate(minDate)} - ${formatDate(maxDate)}`;
        }

        const attendanceClass = totalSlots > 0 && confirmedCount === totalSlots ? 'status-all-confirmed' : 'status-pending';

        row.innerHTML = `
            <td><input type="checkbox" class="program-checkbox" data-id="${program.id}"></td>
            <td><strong>${program.title}</strong></td>
            <td>${playerCount} jugadores</td>
            <td class="confirmation-status ${attendanceClass}"><strong>${confirmedCount} / ${totalSlots}</strong></td>
            <td>${dateRange}</td>
            <td>${creationDate}</td>
            <td class="actions-cell">
                <a href="${programAdminUrl}" class="btn" target="_blank">Ver</a>
                <button class="btn btn-secondary" onclick="copyToClipboard('${programPublicUrl}')">Link Público</button>
                <button class="btn btn-danger" onclick="deleteProgram('${program.id}', '${program.title}')">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll('.program-checkbox').forEach(box => {
        box.addEventListener('change', updateDeleteButtonState);
    });
    updateDeleteButtonState();
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Enlace copiado al portapapeles.', 'success');
    }, (err) => {
        showToast('Error al copiar el enlace.', 'error');
    });
}

async function deleteProgram(programId, programTitle) {
    if (!confirm(`¿Estás seguro de que quieres eliminar el programa "${programTitle}"?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }
    showToast('Eliminando programa...', 'info');

    const { error } = await supabase.from('programs').delete().eq('id', programId);

    if (error) {
        showToast(`Error al eliminar: ${error.message}`, 'error');
    } else {
        showToast('Programa eliminado con éxito.', 'success');
        await renderProgramsList();
    }
}

async function deleteSelectedPrograms() {
    const selectedCheckboxes = document.querySelectorAll('.program-checkbox:checked');
    const programIdsToDelete = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);

    if (programIdsToDelete.length === 0) {
        return showToast('No hay programas seleccionados.', 'error');
    }
    
    if (!confirm(`¿Estás seguro de que quieres eliminar ${programIdsToDelete.length} programa(s)?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    showToast(`Eliminando ${programIdsToDelete.length} programa(s)...`, 'info');

    const { error } = await supabase.from('programs').delete().in('id', programIdsToDelete);

    if (error) {
        showToast(`Error al eliminar los programas: ${error.message}`, 'error');
    } else {
        showToast('Programas eliminados con éxito.', 'success');
        document.getElementById('select-all-programs').checked = false;
        await renderProgramsList();
    }
}

function updateDeleteButtonState() {
    const selectedCount = document.querySelectorAll('.program-checkbox:checked').length;
    const deleteBtn = document.getElementById('delete-selected-btn');

    if (selectedCount > 0) {
        deleteBtn.textContent = `Eliminar Seleccionados (${selectedCount})`;
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }
}

function handleSelectAll(event) {
    const isChecked = event.target.checked;
    document.querySelectorAll('.program-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    updateDeleteButtonState();
}
