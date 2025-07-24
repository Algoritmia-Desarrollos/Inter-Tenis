// --- Conexión a Supabase para la página pública ---
const SUPABASE_URL = 'https://vulzfuwesigberabbbhx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1bHpmdXdlc2lnYmVyYWJiYmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMTExOTEsImV4cCI6MjA2ODc4NzE5MX0.5ndfB7FxvW6B4UVny198BiVlw-1BhJ98Xg_iyAEiFQw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const mainContent = document.getElementById('main-content');
let currentMatch = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get('id');
    const token = params.get('token');

    if (!matchId || !token) {
        mainContent.innerHTML = '<div class="card"><h2>Enlace no válido</h2><p>El enlace para cargar el resultado es incorrecto o ha expirado.</p></div>';
        return;
    }

    const { data: match, error } = await supabase
        .from('matches')
        .select('*, player1:player1_id(id, name), player2:player2_id(id, name)')
        .eq('id', matchId)
        .eq('submission_token', token)
        .single();

    if (error || !match) {
        mainContent.innerHTML = '<div class="card"><h2>Enlace no válido o partido no encontrado</h2><p>Verifica que el enlace sea correcto.</p></div>';
        return;
    }
    
    currentMatch = match;
    renderResultForm(match);
});

function renderResultForm(match) {
    const title = match.winner_id ? 'Editar Resultado' : 'Cargar Resultado';
    mainContent.innerHTML = `
        <div class="card">
            <h1 class="main-title">${title}</h1>
            <p style="text-align: center; color: var(--text-secondary-color); margin-top: -2rem; margin-bottom: 2rem;">
                ${match.player1.name} vs ${match.player2.name}
            </p>
            <form id="result-form">
                <div id="sets-container" class="sets-container"></div>
                <div class="set-controls">
                    <button type="button" class="btn-icon" onclick="addSetInput()">+</button>
                </div>
                <hr style="border-color: var(--border-color); margin: 1rem 0;">
                <div class="form-group">
                    <label>¿Quién ganó el partido?</label>
                    <select id="winner-select" class="filter-input" required>
                        <option value="" disabled selected>Selecciona al ganador...</option>
                        <option value="${match.player1.id}">${match.player1.name}</option>
                        <option value="${match.player2.id}">${match.player2.name}</option>
                    </select>
                </div>
                <div class="form-group-full" style="margin-top: 2rem;">
                    <button type="submit" class="btn">Enviar Resultado</button>
                </div>
            </form>
        </div>
    `;
    renderSetInputs(match);
    document.getElementById('result-form').addEventListener('submit', handleResultSubmit);
}

function renderSetInputs(match) {
    const container = document.getElementById('sets-container');
    container.innerHTML = '';
    const sets = match.sets && match.sets.length > 0 ? match.sets : [{ p1: '', p2: '' }];

    sets.forEach((set, index) => {
        addSetInput(set.p1, set.p2);
    });

    if (match.winner_id) {
        document.getElementById('winner-select').value = match.winner_id;
    }
}

function addSetInput(p1_score = '', p2_score = '') {
    const container = document.getElementById('sets-container');
    if (container.children.length >= 3) {
        alert('Máximo 3 sets por partido.');
        return;
    }
    const setCount = container.children.length + 1;
    const setRow = document.createElement('div');
    setRow.className = 'set-input-row';
    setRow.innerHTML = `
        <span>Set ${setCount}:</span>
        <label>${currentMatch.player1.name}</label>
        <input type="number" min="0" max="10" placeholder="Games" value="${p1_score}" data-player-id="${currentMatch.player1.id}" required>
        <span>-</span>
        <input type="number" min="0" max="10" placeholder="Games" value="${p2_score}" data-player-id="${currentMatch.player2.id}" required>
        <label>${currentMatch.player2.name}</label>
        ${setCount > 1 ? `<button type="button" class="btn-icon remove" onclick="this.parentElement.remove()">−</button>` : ''}
    `;
    container.appendChild(setRow);
}

async function handleResultSubmit(event) {
    event.preventDefault();
    const winnerId = parseInt(document.getElementById('winner-select').value);
    const sets = [];
    const setRows = document.querySelectorAll('.set-input-row');
    
    for (const row of setRows) {
        const inputs = row.querySelectorAll('input[type="number"]');
        const games1 = parseInt(inputs[0].value);
        const games2 = parseInt(inputs[1].value);

        if (isNaN(games1) || isNaN(games2)) {
            alert('Todos los campos de games son obligatorios.');
            return;
        }
        sets.push({ p1: games1, p2: games2 });
    }

    if (sets.length === 0) {
        alert('Debe haber al menos un set.');
        return;
    }

    const { error } = await supabase.from('matches').update({ 
        winner_id: winnerId, 
        sets: sets,
        bonus_loser: sets.length === 3 
    }).eq('id', currentMatch.id);

    if (error) {
        mainContent.innerHTML = `<div class="card"><h2>Error</h2><p>No se pudo guardar el resultado. Por favor, contacta al administrador.</p><p><small>${error.message}</small></p></div>`;
    } else {
        mainContent.innerHTML = '<div class="card"><h2>¡Gracias!</h2><p>El resultado ha sido enviado correctamente.</p></div>';
    }
}