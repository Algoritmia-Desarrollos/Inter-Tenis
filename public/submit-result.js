// --- Conexión a Supabase (puedes usar las mismas credenciales públicas) ---
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
        .select('*, player1:player1_id(name), player2:player2_id(name)')
        .eq('id', matchId)
        .eq('submission_token', token)
        .single();

    if (error || !match) {
        mainContent.innerHTML = '<div class="card"><h2>Enlace no válido</h2><p>El enlace para cargar el resultado es incorrecto o ha expirado.</p></div>';
        return;
    }
    
    if (match.winner_id) {
        mainContent.innerHTML = '<div class="card"><h2>Resultado ya cargado</h2><p>El resultado para este partido ya fue enviado. ¡Gracias!</p></div>';
        return;
    }

    currentMatch = match;
    renderResultForm(match);
});

function renderResultForm(match) {
    mainContent.innerHTML = `
        <div class="card">
            <h1 class="main-title">Cargar Resultado</h1>
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
                        <option value="${match.player1_id}">${match.player1.name}</option>
                        <option value="${match.player2_id}">${match.player2.name}</option>
                    </select>
                </div>
                <div class="form-group-full" style="margin-top: 2rem;">
                    <button type="submit" class="btn">Enviar Resultado</button>
                </div>
            </form>
        </div>
    `;
    addSetInput(); // Añadir el primer set por defecto
    document.getElementById('result-form').addEventListener('submit', handleResultSubmit);
}

function addSetInput() {
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
        <input type="number" min="0" max="10" placeholder="Games" required>
        <span>-</span>
        <input type="number" min="0" max="10" placeholder="Games" required>
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
        const p1Games = parseInt(inputs[0].value);
        const p2Games = parseInt(inputs[1].value);
        if (isNaN(p1Games) || isNaN(p2Games)) {
            alert('Todos los campos de games son obligatorios.');
            return;
        }
        // Asignar games según el ganador seleccionado
        sets.push({
            p1: winnerId === currentMatch.player1_id ? Math.max(p1Games, p2Games) : Math.min(p1Games, p2Games),
            p2: winnerId === currentMatch.player2_id ? Math.max(p1Games, p2Games) : Math.min(p1Games, p2Games)
        });
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