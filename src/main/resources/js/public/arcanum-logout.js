"use strict";

document.addEventListener("DOMContentLoaded", () => {
    performArcanumLogout();
});

async function performArcanumLogout() {
    const message = document.getElementById("arcanum-logout-message");

    try {
        const response = await fetch("/logout", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            redirect: "follow"
        });

        if (response.status === 429) {
            await wait(1800);

            await fetch("/logout", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                redirect: "follow"
            });
        }
    } catch (error) {
        console.warn(
            "Arcanum: Der Logout-Aufruf konnte nicht bestätigt werden.",
            error
        );

        if (message) {
            message.textContent =
                "Du wurdest abgemeldet. Du kannst dich später wieder anmelden.";
        }
    }
}

function wait(milliseconds) {
    return new Promise(resolve => {
        window.setTimeout(resolve, milliseconds);
    });
}
