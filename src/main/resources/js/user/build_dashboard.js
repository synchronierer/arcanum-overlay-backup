"use strict";

const ARCANUM_GRADES = [
    { grade: 5, label: "mangelhaft", coins: 20 },
    { grade: 4, label: "ausreichend", coins: 40 },
    { grade: 3, label: "befriedigend", coins: 60 },
    { grade: 2, label: "gut", coins: 75 },
    { grade: 1, label: "sehr gut", coins: 90 }
];

document.addEventListener("DOMContentLoaded", initialiseArcanumDashboard);

async function initialiseArcanumDashboard() {
    try {
        const [studentData, subjects] = await Promise.all([
            fetchMyData(),
            fetchMySubjects()
        ]);

        renderStudentProfile(studentData);

        const subjectModels = await Promise.all(
            (Array.isArray(subjects) ? subjects : []).map(
                subject => createSubjectModel(subject, studentData)
            )
        );

        renderSubjects(subjectModels);
        renderSummary(subjectModels);
    } catch (error) {
        console.error("Arcanum-Dashboard konnte nicht geladen werden:", error);
        renderFatalError(
            "Deine Lerndaten konnten gerade nicht geladen werden. " +
            "Bitte lade die Seite erneut."
        );
    }
}

function renderStudentProfile(studentData) {
    const firstName = textValue(studentData?.firstName);
    const lastName = textValue(studentData?.lastName);
    const fullName = `${firstName} ${lastName}`.trim() || "Schülerprofil";

    setText("student-name", fullName);
    setText("student-class", studentData?.schoolClass?.label || "–");
    setText(
        "student-graduation",
        graduationLabel(studentData?.graduationLevel)
    );
    setText("student-initials", createInitials(firstName, lastName));

    const completedTasks = safeArray(studentData?.completedTasks);
    setText(
        "total-coins",
        String(calculateCoins(completedTasks))
    );

    /*
     * Das aktuelle Backend stellt noch keinen Rang-Endpunkt bereit.
     * Deshalb zeigen wir hier bewusst keinen erfundenen Platz an.
     */
    setText("student-rank", "noch offen");
}

async function createSubjectModel(subject, studentData) {
    const completedTasks = safeArray(studentData?.completedTasks);
    const selectedTasks = safeArray(studentData?.selectedTasks);
    const lockedTasks = safeArray(studentData?.lockedTasks);

    const completedForSubject = completedTasks.filter(
        task => taskBelongsToSubject(task, subject)
    );

    const selectedForSubject = selectedTasks.filter(
        task => taskBelongsToSubject(task, subject)
    );

    const lockedForSubject = lockedTasks.filter(
        task => taskBelongsToSubject(task, subject)
    );

    let currentTopic = null;

    try {
        currentTopic = await fetchMyCurrentTopic(subject.id);
    } catch (error) {
        /*
         * Eine leere Sandbox hat noch keine student_topics-Einträge.
         * Das ist ein gültiger Leerzustand und kein Dashboard-Abbruch.
         */
        console.debug(
            `Für ${subject.name} ist noch kein Thema zugewiesen.`,
            error
        );
    }

    const coins = calculateCoins(completedForSubject);
    const currentGrade = calculateCurrentGrade(coins);
    const nextGrade = calculateNextGrade(coins);

    return {
        id: subject.id,
        name: textValue(subject.name) || "Unbenanntes Fach",
        coins,
        currentTopic,
        selectedTasks: selectedForSubject,
        completedTasks: completedForSubject,
        lockedTasks: lockedForSubject,
        currentGrade,
        nextGrade,
        requests: safeArray(
            studentData?.currentRequests?.[subject.id]
        )
    };
}

function renderSubjects(subjectModels) {
    const list = document.getElementById("subject-list");

    if (!list) {
        return;
    }

    list.replaceChildren();

    if (subjectModels.length === 0) {
        const emptyState = document.createElement("article");
        emptyState.className = "arcanum-empty-state";
        emptyState.innerHTML = `
            <div class="arcanum-empty-state__symbol" aria-hidden="true">⌛</div>
            <h3>Noch keine Fächer zugeordnet</h3>
            <p>
                Sobald deiner Klassenstufe Fächer zugeordnet sind,
                erscheinen sie hier.
            </p>
        `;
        list.appendChild(emptyState);
        return;
    }

    subjectModels.forEach(subject => {
        list.appendChild(createSubjectCard(subject));
    });
}

function createSubjectCard(subject) {
    const card = document.createElement("article");
    card.className = "arcanum-subject-card";
    card.dataset.subjectId = String(subject.id);

    const progress = calculateGradeProgress(subject.coins, subject.nextGrade);
    const topicName = subject.currentTopic?.name
        ? textValue(subject.currentTopic.name)
        : "Noch kein Thema zugewiesen";

    const nextGradeText = subject.nextGrade
        ? `${subject.nextGrade.remaining} Münzen bis Note ${subject.nextGrade.grade}`
        : "Höchste Notenstufe erreicht";

    card.innerHTML = `
        <div class="arcanum-subject-card__top">
            <div class="arcanum-subject-icon" aria-hidden="true">
                ${escapeHtml(subjectSymbol(subject.name))}
            </div>

            <div class="arcanum-subject-card__title">
                <h3>${escapeHtml(subject.name)}</h3>
                <p>${escapeHtml(topicName)}</p>
            </div>

            <div class="arcanum-coin-badge">
                <strong>${subject.coins}</strong>
                <span>Münzen</span>
            </div>
        </div>

        <div class="arcanum-progress">
            <div class="arcanum-progress__labels">
                <span>Fortschritt</span>
                <strong>${escapeHtml(nextGradeText)}</strong>
            </div>

            <div
                class="arcanum-progress__track"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="${progress}"
            >
                <span style="width: ${progress}%"></span>
            </div>
        </div>

        <div class="arcanum-current-grade ${subject.currentGrade.cssClass}">
            <span class="arcanum-current-grade__label">
                Aktuelle Bewertung
            </span>

            <strong class="arcanum-current-grade__value">
                ${escapeHtml(subject.currentGrade.display)}
            </strong>
        </div>

        <section
            class="arcanum-subject-actions
                   arcanum-subject-actions--vertical"
            aria-label="Aktionen für ${escapeHtml(subject.name)}"
        >
            <header class="arcanum-subject-actions__heading">
                <span class="arcanum-subject-actions__overline">
                    Aktionen
                </span>

                <strong>Was brauchst du?</strong>
            </header>

            <div class="arcanum-subject-actions__grid">
                <button
                    type="button"
                    class="arcanum-request-button${
                        isSubjectRequestActive(subject, "hilfe")
                            ? " is-active"
                            : ""
                    }"
                    data-subject-request="hilfe"
                    aria-label="Hilfe anfordern"
                    aria-pressed="${
                        isSubjectRequestActive(subject, "hilfe")
                    }"
                >
                    <span
                        class="arcanum-request-button__symbol"
                        aria-hidden="true"
                    >
                        ?
                    </span>

                    <strong class="arcanum-request-button__label">
                        Hilfe
                    </strong>

                    <span
                        class="arcanum-request-button__status"
                        data-request-status
                    >
                        ${
                            isSubjectRequestActive(subject, "hilfe")
                                ? "aktiv"
                                : "inaktiv"
                        }
                    </span>
                </button>

                <button
                    type="button"
                    class="arcanum-request-button${
                        isSubjectRequestActive(subject, "partner")
                            ? " is-active"
                            : ""
                    }"
                    data-subject-request="partner"
                    aria-label="Partnersuche ein- oder ausschalten"
                    aria-pressed="${
                        isSubjectRequestActive(subject, "partner")
                    }"
                >
                    <span
                        class="arcanum-request-button__symbol"
                        aria-hidden="true"
                    >
                        ⇄
                    </span>

                    <strong class="arcanum-request-button__label">
                        Partner
                    </strong>

                    <span
                        class="arcanum-request-button__status"
                        data-request-status
                    >
                        ${
                            isSubjectRequestActive(subject, "partner")
                                ? "aktiv"
                                : "inaktiv"
                        }
                    </span>
                </button>

                <button
                    type="button"
                    class="arcanum-request-button${
                        isSubjectRequestActive(subject, "betreuung")
                            ? " is-active"
                            : ""
                    }"
                    data-subject-request="betreuung"
                    aria-label="Betreuung für ein Experiment anfordern"
                    aria-pressed="${
                        isSubjectRequestActive(subject, "betreuung")
                    }"
                >
                    <span
                        class="arcanum-request-button__symbol"
                        aria-hidden="true"
                    >
                        ⚗
                    </span>

                    <strong class="arcanum-request-button__label">
                        Experiment
                    </strong>

                    <span
                        class="arcanum-request-button__status"
                        data-request-status
                    >
                        ${
                            isSubjectRequestActive(subject, "betreuung")
                                ? "aktiv"
                                : "inaktiv"
                        }
                    </span>
                </button>

                <button
                    type="button"
                    class="arcanum-request-button${
                        isSubjectRequestActive(
                            subject,
                            "gelingensnachweis"
                        )
                            ? " is-active"
                            : ""
                    }"
                    data-subject-request="gelingensnachweis"
                    aria-label="Bereitschaft für den Gelingensnachweis melden"
                    aria-pressed="${
                        isSubjectRequestActive(
                            subject,
                            "gelingensnachweis"
                        )
                    }"
                >
                    <span
                        class="arcanum-request-button__symbol"
                        aria-hidden="true"
                    >
                        ✓
                    </span>

                    <strong class="arcanum-request-button__label">
                        Gelingensnachweis
                    </strong>

                    <span
                        class="arcanum-request-button__status"
                        data-request-status
                    >
                        ${
                            isSubjectRequestActive(
                                subject,
                                "gelingensnachweis"
                            )
                                ? "aktiv"
                                : "inaktiv"
                        }
                    </span>
                </button>
            </div>

            <p class="arcanum-subject-actions__instruction">
                Antippen, um eine Meldung ein- oder auszuschalten.
            </p>

            <p
                class="arcanum-subject-actions__message"
                data-request-message
                aria-live="polite"
            ></p>
        </section>

        <div
            class="arcanum-subject-stats"
            aria-label="Etappenstatus für ${escapeHtml(subject.name)}"
        >
            <button
                type="button"
                class="arcanum-subject-stat-button"
                data-detail-status="current"
            >
                <span class="arcanum-subject-stat-button__label">
                    Aktuell
                </span>
                <strong class="arcanum-subject-stat-button__value">
                    ${formatStageCount(subject.selectedTasks.length)}
                </strong>
                <span class="arcanum-subject-stat-button__action">
                    Anzeigen
                </span>
            </button>

            <button
                type="button"
                class="arcanum-subject-stat-button
                       arcanum-subject-stat-button--completed"
                data-detail-status="completed"
            >
                <span class="arcanum-subject-stat-button__label">
                    Bestanden
                </span>
                <strong class="arcanum-subject-stat-button__value">
                    ${formatStageCount(subject.completedTasks.length)}
                </strong>
                <span class="arcanum-subject-stat-button__action">
                    Münzen anzeigen
                </span>
            </button>

            <button
                type="button"
                class="arcanum-subject-stat-button
                       arcanum-subject-stat-button--locked"
                data-detail-status="locked"
            >
                <span class="arcanum-subject-stat-button__label">
                    Gesperrt
                </span>
                <strong class="arcanum-subject-stat-button__value">
                    ${formatStageCount(subject.lockedTasks.length)}
                </strong>
                <span class="arcanum-subject-stat-button__action">
                    Anzeigen
                </span>
            </button>
        </div>

        <div class="arcanum-subject-actions">
            ${createRequestStatus(subject.requests)}
            <button
                type="button"
                class="arcanum-button arcanum-button--card"
                disabled
                title="Die Fachdetailansicht folgt in einem späteren Schritt."
            >
                Fach öffnen
            </button>
        </div>
    `;

    card.querySelectorAll("[data-detail-status]").forEach(
        button => {
            button.addEventListener("click", () => {
                openTaskDetails(
                    subject,
                    button.dataset.detailStatus
                );
            });
        }
    );

    card.querySelectorAll("[data-subject-request]").forEach(
        button => {
            button.addEventListener("click", async () => {
                await toggleSubjectRequest(
                    subject,
                    button,
                    card
                );
            });
        }
    );

    return card;
}


const ARCANUM_TASK_DETAIL_CONFIG = {
    current: {
        label: "Aktuell",
        description:
            "Etappen, die derzeit bearbeitet werden.",
        getTasks: subject => subject.selectedTasks,
        empty:
            "In diesem Fach wird aktuell keine Etappe bearbeitet."
    },
    completed: {
        label: "Bestanden",
        description:
            "Bestandene Etappen und die dafür gutgeschriebenen Münzen.",
        getTasks: subject => subject.completedTasks,
        empty:
            "In diesem Fach wurde noch keine Etappe bestanden."
    },
    locked: {
        label: "Gesperrt",
        description:
            "Etappen, die derzeit nicht bearbeitet werden können.",
        getTasks: subject => subject.lockedTasks,
        empty:
            "In diesem Fach gibt es keine gesperrten Etappen."
    }
};

function openTaskDetails(subject, status) {
    const config = ARCANUM_TASK_DETAIL_CONFIG[status];

    if (!config) {
        return;
    }

    const tasks = safeArray(config.getTasks(subject));
    const groups = groupTasksByTopic(tasks);
    const dialog = ensureTaskDetailsDialog();

    const title = dialog.querySelector(
        "[data-task-dialog-title]"
    );
    const subtitle = dialog.querySelector(
        "[data-task-dialog-subtitle]"
    );
    const summary = dialog.querySelector(
        "[data-task-dialog-summary]"
    );
    const content = dialog.querySelector(
        "[data-task-dialog-content]"
    );

    title.textContent = `${subject.name} · ${config.label}`;
    subtitle.textContent = config.description;

    const totalCoins = calculateCoins(tasks);
    const coinDescription = status === "completed"
        ? `${totalCoins} Münzen gutgeschrieben`
        : `${totalCoins} mögliche Münzen`;

    summary.textContent =
        `${formatStageCount(tasks.length)} · ${coinDescription}`;

    if (groups.length === 0) {
        content.innerHTML = `
            <div class="arcanum-task-dialog__empty">
                <p>${escapeHtml(config.empty)}</p>
            </div>
        `;
    } else {
        content.innerHTML = groups
            .map(group => createTaskGroupHtml(group, status))
            .join("");
    }

    if (typeof dialog.showModal === "function") {
        if (!dialog.open) {
            dialog.showModal();
        }
    } else {
        dialog.setAttribute("open", "");
    }
}

function ensureTaskDetailsDialog() {
    let dialog = document.getElementById(
        "arcanum-task-details-dialog"
    );

    if (dialog) {
        return dialog;
    }

    dialog = document.createElement("dialog");
    dialog.id = "arcanum-task-details-dialog";
    dialog.className = "arcanum-task-dialog";

    dialog.innerHTML = `
        <div class="arcanum-task-dialog__panel">
            <header class="arcanum-task-dialog__header">
                <div>
                    <p class="arcanum-eyebrow">Etappenübersicht</p>
                    <h2 data-task-dialog-title>Etappen</h2>
                    <p
                        class="arcanum-task-dialog__subtitle"
                        data-task-dialog-subtitle
                    ></p>
                </div>

                <button
                    type="button"
                    class="arcanum-task-dialog__close"
                    data-task-dialog-close
                    aria-label="Etappenübersicht schließen"
                >
                    ×
                </button>
            </header>

            <div
                class="arcanum-task-dialog__summary"
                data-task-dialog-summary
            ></div>

            <div
                class="arcanum-task-dialog__content"
                data-task-dialog-content
            ></div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector("[data-task-dialog-close]")
        .addEventListener("click", () => dialog.close());

    dialog.addEventListener("click", event => {
        if (event.target === dialog) {
            dialog.close();
        }
    });

    return dialog;
}

function groupTasksByTopic(tasks) {
    const groups = new Map();

    safeArray(tasks).forEach(task => {
        const topic = (
            typeof task?.topic === "object" &&
            task.topic !== null
        )
            ? task.topic
            : null;

        const topicId =
            topic?.id ??
            task?.topicId ??
            task?.topic ??
            "ohne-thema";

        const topicName =
            textValue(topic?.name) ||
            (
                topicId !== "ohne-thema"
                    ? `Thema ${topicId}`
                    : "Ohne Thema"
            );

        const topicNumber = Number(topic?.number);

        const key = String(topicId);

        if (!groups.has(key)) {
            groups.set(key, {
                id: topicId,
                name: topicName,
                number: Number.isFinite(topicNumber)
                    ? topicNumber
                    : Number.MAX_SAFE_INTEGER,
                tasks: []
            });
        }

        groups.get(key).tasks.push(task);
    });

    return [...groups.values()]
        .map(group => ({
            ...group,
            tasks: [...group.tasks].sort(compareTasksForDetails)
        }))
        .sort((left, right) => {
            if (left.number !== right.number) {
                return left.number - right.number;
            }

            return left.name.localeCompare(
                right.name,
                "de",
                { sensitivity: "base" }
            );
        });
}

function compareTasksForDetails(left, right) {
    const levelDifference =
        Number(left?.niveau || 99) -
        Number(right?.niveau || 99);

    if (levelDifference !== 0) {
        return levelDifference;
    }

    return textValue(left?.name).localeCompare(
        textValue(right?.name),
        "de",
        { sensitivity: "base" }
    );
}

function createTaskGroupHtml(group, status) {
    const groupCoins = calculateCoins(group.tasks);

    const groupCoinText = status === "completed"
        ? `${groupCoins} Münzen`
        : `${groupCoins} mögliche Münzen`;

    const taskRows = group.tasks
        .map(task => createTaskDetailRowHtml(task, status))
        .join("");

    return `
        <section class="arcanum-task-group">
            <header class="arcanum-task-group__header">
                <div>
                    <span class="arcanum-task-group__overline">
                        Thema
                    </span>
                    <h3>${escapeHtml(group.name)}</h3>
                </div>

                <div class="arcanum-task-group__summary">
                    <span>${formatStageCount(group.tasks.length)}</span>
                    <strong>${escapeHtml(groupCoinText)}</strong>
                </div>
            </header>

            <ul class="arcanum-task-group__list">
                ${taskRows}
            </ul>
        </section>
    `;
}

function createTaskDetailRowHtml(task, status) {
    const coins = calculateTaskCoins(task);
    const level = getNiveauInformation(task?.niveau);

    const coinText = coins > 0
        ? (
            status === "completed"
                ? `${coins} Münzen`
                : `${coins} mögliche Münzen`
        )
        : "Münzwert noch offen";

    return `
        <li class="arcanum-task-row">
            <div class="arcanum-task-row__main">
                <span
                    class="arcanum-niveau-badge
                           arcanum-niveau-badge--${level.cssClass}"
                >
                    ${escapeHtml(level.label)}
                </span>

                <strong class="arcanum-task-row__name">
                    ${escapeHtml(
                        textValue(task?.name) || "Unbenannte Etappe"
                    )}
                </strong>
            </div>

            <span class="arcanum-task-row__coins">
                ${escapeHtml(coinText)}
            </span>
        </li>
    `;
}

function getNiveauInformation(niveau) {
    switch (Number(niveau)) {
        case 1:
            return {
                label: "Wanderer",
                cssClass: "wanderer"
            };

        case 2:
            return {
                label: "Bergsteiger",
                cssClass: "bergsteiger"
            };

        case 3:
            return {
                label: "Gipfelstürmer",
                cssClass: "gipfelstuermer"
            };

        default:
            return {
                label: "Niveau offen",
                cssClass: "offen"
            };
    }
}

function formatStageCount(count) {
    const value = Number(count) || 0;

    return value === 1
        ? "1 Etappe"
        : `${value} Etappen`;
}


let arcanumCurrentStudentPromise = null;

const ARCANUM_REQUEST_TEXTS = {
    hilfe: {
        active: "aktiv",
        inactive: "inaktiv",
        enabled: "Hilfe wurde angefordert.",
        disabled: "Die Hilfeanforderung wurde zurückgenommen."
    },
    partner: {
        active: "aktiv",
        inactive: "inaktiv",
        enabled: "Die Partnersuche wurde aktiviert.",
        disabled: "Die Partnersuche wurde beendet."
    },
    betreuung: {
        active: "aktiv",
        inactive: "inaktiv",
        enabled: "Experimentbetreuung wurde angefordert.",
        disabled:
            "Die Anforderung für Experimentbetreuung " +
            "wurde zurückgenommen."
    },
    gelingensnachweis: {
        active: "aktiv",
        inactive: "inaktiv",
        enabled:
            "Die Bereitschaft für den Gelingensnachweis " +
            "wurde gemeldet.",
        disabled:
            "Die Bereitschaft für den Gelingensnachweis " +
            "wurde zurückgenommen."
    }
};

function isSubjectRequestActive(subject, type) {
    return safeArray(subject?.requests).includes(type);
}

async function getArcanumCurrentStudent() {
    if (!arcanumCurrentStudentPromise) {
        arcanumCurrentStudentPromise = fetch("/mydata", {
            credentials: "same-origin"
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(
                        `Schülerdaten konnten nicht geladen werden ` +
                        `(${response.status}).`
                    );
                }

                return response.json();
            })
            .catch(error => {
                arcanumCurrentStudentPromise = null;
                throw error;
            });
    }

    return arcanumCurrentStudentPromise;
}

async function toggleSubjectRequest(subject, button, card) {
    const type = button.dataset.subjectRequest;
    const texts = ARCANUM_REQUEST_TEXTS[type];

    if (!type || !texts || button.disabled) {
        return;
    }

    const wasActive = isSubjectRequestActive(subject, type);
    const message = card.querySelector(
        "[data-request-message]"
    );

    button.disabled = true;
    button.classList.add("is-loading");

    if (message) {
        message.textContent = "Wird gespeichert …";
        message.classList.remove(
            "is-success",
            "is-error"
        );
    }

    try {
        const student = await getArcanumCurrentStudent();

        const body = {
            subjectId: Number(subject.id),
            subjectRequest: type,
            studentId: Number(student.id)
        };

        if (wasActive) {
            body.remove = true;
        }

        const response = await fetch("/subject-request", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(
                `Die Meldung konnte nicht gespeichert werden ` +
                `(${response.status}).`
            );
        }

        const requests = safeArray(subject.requests);

        if (wasActive) {
            subject.requests = requests.filter(
                request => request !== type
            );
        } else {
            subject.requests = [
                ...new Set([...requests, type])
            ];
        }

        const isActive = !wasActive;

        updateSubjectRequestButton(
            button,
            type,
            isActive
        );

        if (message) {
            message.textContent = isActive
                ? texts.enabled
                : texts.disabled;

            message.classList.add("is-success");
        }
    } catch (error) {
        console.error(
            "Arcanum: Fachmeldung konnte nicht geändert werden.",
            error
        );

        if (message) {
            message.textContent =
                "Die Meldung konnte nicht gespeichert werden. " +
                "Bitte versuche es erneut.";

            message.classList.add("is-error");
        }
    } finally {
        button.disabled = false;
        button.classList.remove("is-loading");
    }
}

function updateSubjectRequestButton(button, type, isActive) {
    const texts = ARCANUM_REQUEST_TEXTS[type];
    const status = button.querySelector(
        "[data-request-status]"
    );

    button.classList.toggle("is-active", isActive);
    button.setAttribute(
        "aria-pressed",
        String(isActive)
    );

    if (status && texts) {
        status.textContent = isActive
            ? texts.active
            : texts.inactive;
    }
}

function createRequestStatus(requests) {
    if (!requests.length) {
        return `
            <p class="arcanum-request-status">
                Keine offenen Hilfsanfragen
            </p>
        `;
    }

    return `
        <p class="arcanum-request-status arcanum-request-status--active">
            ${requests.length} offene
            ${requests.length === 1 ? "Anfrage" : "Anfragen"}
        </p>
    `;
}

function renderSummary(subjectModels) {
    const totalCoins = subjectModels.reduce(
        (sum, subject) => sum + subject.coins,
        0
    );

    const activeSubjects = subjectModels.filter(
        subject => subject.currentTopic
    ).length;

    setText(
        "dashboard-summary",
        subjectModels.length === 0
            ? "Für deine Klassenstufe sind noch keine Fächer eingerichtet."
            : `${subjectModels.length} Fächer · ` +
              `${activeSubjects} mit aktueller Etappe · ` +
              `${totalCoins} erreichte Münzen`
    );
}



function calculateTaskCoins(task) {
    /*
     * Übergangslogik bis das Backend einen eigenen Münzwert
     * pro Etappe bereitstellt:
     *
     * 1 Prozentpunkt = 1 Münze.
     *
     * Das aktuelle Backend liefert ratio üblicherweise als
     * Dezimalanteil, beispielsweise 0.075 für 7,5 Prozent.
     * Jede bestandene Etappe wird einzeln auf eine ganze
     * Münze kaufmännisch gerundet.
     */

    const explicitCoins = Number(
        task?.coins ??
        task?.coinValue ??
        task?.muenzen
    );

    if (Number.isFinite(explicitCoins) && explicitCoins >= 0) {
        return Math.round(explicitCoins);
    }

    const ratio = Number(task?.ratio);

    if (!Number.isFinite(ratio) || ratio <= 0) {
        return 0;
    }

    const percentagePoints = ratio <= 1
        ? ratio * 100
        : ratio;

    return Math.max(0, Math.round(percentagePoints));
}

function calculateCoins(tasks) {
    return safeArray(tasks).reduce(
        (sum, task) => sum + calculateTaskCoins(task),
        0
    );
}

function calculateCurrentGrade(coins) {
    const reachedGrade = [...ARCANUM_GRADES]
        .reverse()
        .find(item => coins >= item.coins);

    if (!reachedGrade) {
        return {
            grade: null,
            display: "Noch unter Note 5",
            cssClass: "arcanum-current-grade--below"
        };
    }

    return {
        grade: reachedGrade.grade,
        display: `Note ${reachedGrade.grade} · ${reachedGrade.label}`,
        cssClass: `arcanum-current-grade--${reachedGrade.grade}`
    };
}

function calculateNextGrade(coins) {
    const threshold = ARCANUM_GRADES.find(item => coins < item.coins);

    if (!threshold) {
        return null;
    }

    return {
        ...threshold,
        remaining: threshold.coins - coins
    };
}

function calculateGradeProgress(coins, nextGrade) {
    if (!nextGrade) {
        return 100;
    }

    const currentIndex = ARCANUM_GRADES.findIndex(
        item => item.grade === nextGrade.grade
    );

    const previousThreshold = currentIndex > 0
        ? ARCANUM_GRADES[currentIndex - 1].coins
        : 0;

    const range = nextGrade.coins - previousThreshold;
    const progressWithinRange = coins - previousThreshold;

    return Math.max(
        0,
        Math.min(100, Math.round((progressWithinRange / range) * 100))
    );
}

function taskBelongsToSubject(task, subject) {
    const taskSubject =
        task?.topic?.subject ??
        task?.subject ??
        task?.topic?.subjectId;

    if (typeof taskSubject === "object" && taskSubject !== null) {
        return Number(taskSubject.id) === Number(subject.id);
    }

    return Number(taskSubject) === Number(subject.id);
}

function subjectSymbol(name) {
    const normalised = String(name || "").toLocaleLowerCase("de");

    if (normalised.includes("deutsch")) return "D";
    if (normalised.includes("englisch")) return "E";
    if (normalised.includes("mathematik")) return "M";
    if (normalised.includes("natur")) return "N";
    if (normalised.includes("gesellschaft")) return "G";
    if (normalised.includes("geschichte")) return "G";
    if (normalised.includes("biologie")) return "B";
    if (normalised.includes("chemie")) return "C";
    if (normalised.includes("physik")) return "P";
    if (normalised.includes("religion")) return "R";
    if (normalised.includes("musik")) return "♪";

    return String(name || "?").trim().charAt(0).toLocaleUpperCase("de") || "?";
}

function graduationLabel(level) {
    /*
     * Für das Arcanum-Frontend lautet die Einstiegsgraduierung verbindlich
     * „Starter“. Weitere Bezeichnungen ergänzen wir später anhand des
     * endgültigen Graduierungssystems.
     */
    if (Number(level) <= 1 || level === undefined || level === null) {
        return "Starter";
    }

    return `Stufe ${level}`;
}

function createInitials(firstName, lastName) {
    const initials = [firstName, lastName]
        .filter(Boolean)
        .map(value => String(value).trim().charAt(0))
        .join("")
        .toLocaleUpperCase("de");

    return initials || "?";
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function textValue(value) {
    return value === null || value === undefined ? "" : String(value);
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = textValue(value);
    return element.innerHTML;
}

function renderFatalError(message) {
    const list = document.getElementById("subject-list");
    const errorBox = document.getElementById("dashboard-error");

    if (list) {
        list.replaceChildren();
    }

    if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
    }

    setText("dashboard-summary", "Lerndaten konnten nicht geladen werden.");
}
