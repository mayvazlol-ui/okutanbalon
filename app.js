// Corrected app.js

function getTurkiyeZamani() {
    const utcOffset = 3; // UTC+3 for Turkey
    const date = new Date();
    const turkiyeZamani = new Date(date.getTime() + utcOffset * 60 * 60 * 1000);
    return turkiyeZamani;
}

function login(username, password) {
    // Perform login and return user session
    // Ensure all inputs are sanitized to prevent XSS
    const sanitizedUsername = username.replace(/[<>]/g, '');
    const sanitizedPassword = password.replace(/[<>]/g, '');
    // Logic for authentication
}

function logout() {
    // Logic for logging out the user
}

const rozetEmlari = {
    haftalik_1: [],
    haftalik_2: [],
    haftalik_3: []
};

// Example usage
console.log(getTurkiyeZamani());