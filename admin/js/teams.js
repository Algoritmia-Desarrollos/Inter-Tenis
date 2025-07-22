// Lógica para la página de equipos (teams.html)
document.addEventListener('DOMContentLoaded', async () => {
    await renderTeamsList();
    document.getElementById('team-form').addEventListener('submit', handleTeamSubmit);
});

async function handleTeamSubmit(event) {
    event.preventDefault();
    const teamNameInput = document.getElementById('team-name');
    const teamName = teamNameInput.value;
    
    if (teamName.trim() === '') {
        showToast('El nombre del equipo no puede estar vacío.', 'error');
        return;
    }

    const { error } = await supabase.from('teams').insert([{ name: teamName }]);
    
    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Equipo creado con éxito.', 'success');
        teamNameInput.value = '';
        await renderTeamsList();
    }
}

async function renderTeamsList() {
    const container = document.getElementById('teams-list');
    container.innerHTML = '<h3>Lista de Equipos</h3>';

    const { data: teams, error } = await supabase.from('teams').select('*').order('name');
    if (error || !teams) return;

    if (teams.length === 0) {
        container.innerHTML += '<p class="placeholder-text">Aún no se han creado equipos.</p>';
        return;
    }

    teams.forEach(team => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <span>${team.name}</span>
            <div class="actions">
                <button class="btn btn-danger" onclick="deleteTeam(${team.id})">Eliminar</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function deleteTeam(id) {
    if (!confirm('¿Seguro? Los jugadores de este equipo quedarán sin asignar.')) return;
    
    // Desvincular jugadores del equipo antes de borrarlo.
    // Esto es opcional, pero previene errores si tienes reglas de borrado restrictivas.
    await supabase.from('players').update({ team_id: null }).eq('team_id', id);
    
    const { error } = await supabase.from('teams').delete().eq('id', id);

    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Equipo eliminado.', 'success');
        await renderTeamsList();
    }
}