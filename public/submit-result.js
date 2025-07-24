// --- Conexión a Supabase ---
const SUPABASE_URL = 'https://vulzfuwesigberabbbhx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1bHpmdXdlc2lnYmVyYWJiYmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMTExOTEsImV4cCI6MjA2ODc4NzE5MX0.5ndfB7FxvW6B4UVny198BiVlw-1BhJ98Xg_iyAEiFQw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const mainContent = document.getElementById('main-content');
let currentMatch = null;
let submissionState = {
    winnerId: null,
    sets: []
};

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get('id');
    const token = params.get('token');

    if (!matchId || !token) {
        return renderError("Enlace no válido", "El enlace para cargar el resultado es incorrecto o ha expirado.");
    }

    const { data: match, error } = await supabase
        .from('matches')
        .select('*, player1:player1_id(id, name), player2:player2_id(id, name)')
        .eq('id', matchId)
        .eq('submission_token', token)
        .single();

    if (error || !match) {
        return renderError("Enlace no válido o partido no encontrado", "Verifica que el enlace sea correcto.");
    }
    
    currentMatch = match;
    
    if (match.winner_id) {
        submissionState.winnerId = match.winner_id;
        submissionState.sets = match.sets;
        renderConfirmationStep(true);
    } else {
        renderWinnerStep();
    }
});

// --- PASO 1: Renderizar Selección de Ganador ---
function renderWinnerStep() {
    submissionState.winnerId = null;
    submissionState.sets = [];
    mainContent.innerHTML = `
        <div class="card interactive-card animate-fade-in">
            <div class="step-header">
                <span class="step-indicator">Paso 1 de 3</span>
                <h2>¿Quién ganó el partido?</h2>
                <p>${currentMatch.player1.name} vs ${currentMatch.player2.name}</p>
            </div>
            <div class="winner-selection">
                <button class="player-button" onclick="selectWinner(${currentMatch.player1.id})">${currentMatch.player1.name}</button>
                <button class="player-button" onclick="selectWinner(${currentMatch.player2.id})">${currentMatch.player2.name}</button>
            </div>
        </div>
    `;
}

function selectWinner(winnerId) {
    submissionState.winnerId = winnerId;
    renderSetsStep();
}

// --- PASO 2: Renderizar Carga de Sets (Lógica Inteligente) ---
function renderSetsStep() {
    const currentSetNumber = submissionState.sets.length + 1;

    mainContent.innerHTML = `
        <div class="card interactive-card animate-fade-in">
            <div class="step-header">
                <span class="step-indicator">Paso 2 de 3</span>
                <h2>Resultado del Set ${currentSetNumber}</h2>
            </div>
            <div class="set-input-grid">
                <label>${currentMatch.player1.name}</label>
                <select id="p1-score">${createScoreOptions()}</select>
                <span>-</span>
                <select id="p2-score">${createScoreOptions()}</select>
                <label>${currentMatch.player2.name}</label>
            </div>
            <div class="step-actions">
                <button class="btn btn-secondary" onclick="goBackToWinnerSelection()">← Volver</button>
                <button class="btn" onclick="collectSet()">Siguiente &rarr;</button>
            </div>
        </div>
    `;
    document.getElementById('p1-score').focus();
}

function createScoreOptions() {
    let options = '';
    for (let i = 0; i <= 6; i++) {
        options += `<option value="${i}">${i}</option>`;
    }
    return options;
}

function goBackToWinnerSelection() {
    if (submissionState.sets.length > 0) {
        submissionState.sets.pop();
        renderSetsStep();
    } else {
        renderWinnerStep();
    }
}

function collectSet() {
    const p1Score = parseInt(document.getElementById('p1-score').value);
    const p2Score = parseInt(document.getElementById('p2-score').value);

    // Validaciones
    if (p1Score === p2Score && p1Score >= 6) {
        alert("Resultado de set inválido. En un tie-break, los marcadores no pueden ser iguales.");
        return;
    }
    if (Math.max(p1Score, p2Score) < 6 || Math.abs(p1Score - p2Score) < 2) {
        if (!confirm("El resultado del set parece inusual. ¿Estás seguro de que es correcto?")) return;
    }

    submissionState.sets.push({ p1: p1Score, p2: p2Score });

    // --- LÓGICA INTELIGENTE ---
    if (submissionState.sets.length >= 2) {
        let p1SetsWon = 0;
        let p2SetsWon = 0;
        submissionState.sets.forEach(set => {
            if (set.p1 > set.p2) p1SetsWon++;
            else p2SetsWon++;
        });

        // Si alguien ganó 2 sets, o si ya se jugaron 3, termina.
        if (p1SetsWon === 2 || p2SetsWon === 2 || submissionState.sets.length === 3) {
            renderConfirmationStep();
        } else {
            renderSetsStep(); // Pide el siguiente set
        }
    } else {
        renderSetsStep(); // Pide el siguiente set
    }
}

// --- PASO 3: Renderizar Confirmación ---
function renderConfirmationStep(isEditing = false) {
    const winnerName = submissionState.winnerId == currentMatch.player1.id ? currentMatch.player1.name : currentMatch.player2.name;
    const setsHtml = submissionState.sets.map(set => `<span>${set.p1} - ${set.p2}</span>`).join(' , ');

    mainContent.innerHTML = `
        <div class="card interactive-card animate-fade-in">
            <div class="step-header">
                <span class="step-indicator">Paso 3 de 3</span>
                <h2>Revisar y Confirmar</h2>
            </div>
            <div class="summary">
                <div class="summary-item">
                    <span>Ganador Seleccionado:</span>
                    <strong>${winnerName}</strong>
                </div>
                <div class="summary-item">
                    <span>Resultado Final (Sets):</span>
                    <strong>${setsHtml}</strong>
                </div>
            </div>
            <div class="step-actions">
                <button class="btn btn-secondary" onclick="goBackToWinnerSelection()">← Corregir Sets</button>
                <button class="btn" onclick="handleResultSubmit()">Confirmar y Enviar</button>
            </div>
        </div>
    `;
}

// --- Lógica Final: Enviar a Supabase ---
async function handleResultSubmit() {
    mainContent.innerHTML = `<div class="card"><p class="placeholder-text">Enviando resultado...</p></div>`;

    const { error } = await supabase.from('matches').update({ 
        winner_id: submissionState.winnerId, 
        sets: submissionState.sets,
        bonus_loser: submissionState.sets.length === 3 
    }).eq('id', currentMatch.id);

    if (error) {
        renderError("Error al guardar", "No se pudo guardar el resultado.", error.message);
    } else {
        // --- AQUÍ ESTÁ LA MODIFICACIÓN ---
        mainContent.innerHTML = `
            <div class="card interactive-card animate-fade-in" style="text-align: center;">
                <h2>¡Gracias!</h2>
                <p>El resultado ha sido enviado correctamente.</p>
                <a href="http://127.0.0.1:5500/" class="btn" style="margin-top: 1rem;">Volver a la Página Principal</a>
            </div>`;
    }
}

// --- Funciones de Utilidad ---
function renderError(title, message, details = '') {
    mainContent.innerHTML = `<div class="card"><h2>${title}</h2><p>${message}</p>${details ? `<p><small>${details}</small></p>` : ''}</div>`;
}