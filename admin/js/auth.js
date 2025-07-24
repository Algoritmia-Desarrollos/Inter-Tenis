document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupButton = document.getElementById('signup-btn');
    const errorMessage = document.getElementById('error-message');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Redirigir si ya hay una sesión activa
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            window.location.href = 'tournaments.html';
        }
    });

    // Manejar el inicio de sesión
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            errorMessage.textContent = 'Error: ' + error.message;
        } else {
            window.location.href = 'tournaments.html';
        }
    });

    // Manejar el registro
    signupButton.addEventListener('click', async () => {
        const { error } = await supabase.auth.signUp({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            errorMessage.textContent = 'Error: ' + error.message;
        } else {
            errorMessage.textContent = '¡Registro exitoso! Revisa tu correo para confirmar la cuenta.';
            errorMessage.style.color = 'var(--success-color)';
        }
    });
});document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupButton = document.getElementById('signup-btn');
    const errorMessage = document.getElementById('error-message');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Redirigir si ya hay una sesión activa
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            window.location.href = 'tournaments.html';
        }
    });

    // Manejar el inicio de sesión
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            errorMessage.textContent = 'Error: ' + error.message;
        } else {
            window.location.href = 'tournaments.html';
        }
    });

    // Manejar el registro
    signupButton.addEventListener('click', async () => {
        const { error } = await supabase.auth.signUp({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            errorMessage.textContent = 'Error: ' + error.message;
        } else {
            errorMessage.textContent = '¡Registro exitoso! Revisa tu correo para confirmar la cuenta.';
            errorMessage.style.color = 'var(--success-color)';
        }
    });
});document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupButton = document.getElementById('signup-btn');
    const errorMessage = document.getElementById('error-message');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Redirigir si ya hay una sesión activa
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            window.location.href = 'tournaments.html';
        }
    });

    // Manejar el inicio de sesión
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            errorMessage.textContent = 'Error: ' + error.message;
        } else {
            window.location.href = 'tournaments.html';
        }
    });

    // Manejar el registro
    signupButton.addEventListener('click', async () => {
        const { error } = await supabase.auth.signUp({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            errorMessage.textContent = 'Error: ' + error.message;
        } else {
            errorMessage.textContent = '¡Registro exitoso! Revisa tu correo para confirmar la cuenta.';
            errorMessage.style.color = 'var(--success-color)';
        }
    });
});