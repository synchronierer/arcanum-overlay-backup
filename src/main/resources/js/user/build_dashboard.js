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
    initialiseAvatarSelector(studentData);

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

            <div
                class="arcanum-partner-results"
                data-partner-results
                aria-live="polite"
                hidden
            ></div>
        </section>

        <div
            class="arcanum-subject-stats"
            aria-label="Etappenstatus für ${escapeHtml(subject.name)}"
        >
            <button
                type="button"
                class="arcanum-subject-stat-button
                       arcanum-subject-stat-button--open"
                data-detail-status="open"
            >
                <span class="arcanum-subject-stat-button__label">
                    Offen
                </span>

                <strong class="arcanum-subject-stat-button__value">
                    Etappen
                </strong>

                <span class="arcanum-subject-stat-button__action">
                    Anzeigen und beginnen
                </span>
            </button>

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
    if (status === "open") {
        openAvailableTaskDetails(subject);
        return;
    }

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

    const taskDialogContent = dialog.querySelector(
        "[data-task-dialog-content]"
    );

    if (
        taskDialogContent &&
        taskDialogContent.dataset.taskActionsBound !== "true"
    ) {
        taskDialogContent.addEventListener(
            "click",
            handleTaskActionClick
        );

        taskDialogContent.dataset.taskActionsBound = "true";
    }

    return dialog;
}


async function fetchOpenTasksForSubject(subject) {
    const student = await getArcanumCurrentStudent();

    const studentId = extractEntityId(student?.id);
    const subjectId = extractEntityId(subject?.id);

    if (studentId === null || subjectId === null) {
        throw new Error(
            "Schüler- oder Fachdaten fehlen."
        );
    }

    const topicResponse = await fetch("/current-topic", {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            subjectId
        })
    });

    if (!topicResponse.ok) {
        throw new Error(
            `Das aktuelle Thema konnte nicht geladen werden ` +
            `(${topicResponse.status}).`
        );
    }

    const topic = await topicResponse.json();

    if (!topic) {
        return {
            topic: null,
            tasks: []
        };
    }

    const taskIds = [
        ...new Set(
            safeArray(topic.tasks)
                .map(task => extractEntityId(task))
                .filter(taskId => taskId !== null)
        )
    ];

    if (taskIds.length === 0) {
        return {
            topic,
            tasks: []
        };
    }

    const tasksResponse = await fetch("/tasks", {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            ids: taskIds,
            studentId
        })
    });

    if (!tasksResponse.ok) {
        throw new Error(
            `Die Etappen konnten nicht geladen werden ` +
            `(${tasksResponse.status}).`
        );
    }

    const payload = await tasksResponse.json();

    const allTasks = Array.isArray(payload)
        ? payload
        : safeArray(
            payload?.tasks ??
            payload?.results
        );

    const unavailableIds = new Set();

    [
        ...safeArray(subject.selectedTasks),
        ...safeArray(subject.completedTasks),
        ...safeArray(subject.lockedTasks)
    ].forEach(task => {
        const taskId = extractEntityId(task?.id ?? task);

        if (taskId !== null) {
            unavailableIds.add(taskId);
        }
    });

    const tasks = allTasks
        .filter(task => {
            const taskId = extractEntityId(
                task?.id ?? task
            );

            return (
                taskId !== null &&
                !unavailableIds.has(taskId)
            );
        })
        .map(task => ({
            ...task,
            topic: (
                task?.topic &&
                typeof task.topic === "object"
            )
                ? task.topic
                : topic
        }));

    return {
        topic,
        tasks
    };
}

async function openAvailableTaskDetails(subject) {
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

    title.textContent = `${subject.name} · Offen`;

    subtitle.textContent =
        "Noch nicht begonnene Etappen des aktuellen Themas.";

    summary.textContent =
        "Offene Etappen werden geladen …";

    content.innerHTML = `
        <div class="arcanum-task-dialog__empty">
            <p>Etappen werden geladen …</p>
        </div>
    `;

    if (typeof dialog.showModal === "function") {
        if (!dialog.open) {
            dialog.showModal();
        }
    } else {
        dialog.setAttribute("open", "");
    }

    try {
        const result = await fetchOpenTasksForSubject(
            subject
        );

        const topicName = textValue(
            result.topic?.name
        ).trim();

        if (result.tasks.length === 0) {
            summary.textContent = topicName
                ? `Keine offene Etappe im Thema „${topicName}“.`
                : "Für dieses Fach ist kein aktuelles Thema festgelegt.";

            content.innerHTML = `
                <div class="arcanum-task-dialog__empty">
                    <p>
                        ${
                            topicName
                                ? "Alle Etappen dieses Themas wurden " +
                                  "bereits begonnen, bestanden oder " +
                                  "gesperrt."
                                : "Die Lehrkraft hat noch kein " +
                                  "aktuelles Thema festgelegt."
                        }
                    </p>
                </div>
            `;

            return;
        }

        summary.textContent =
            `${formatStageCount(result.tasks.length)} · ` +
            `${calculateCoins(result.tasks)} mögliche Münzen`;

        const groups = groupTasksByTopic(
            result.tasks
        );

        content.innerHTML = groups
            .map(group => createTaskGroupHtml(
                group,
                "open"
            ))
            .join("");
    } catch (error) {
        console.error(
            "Arcanum: Offene Etappen konnten nicht geladen werden.",
            error
        );

        summary.textContent =
            "Offene Etappen konnten nicht geladen werden.";

        content.innerHTML = `
            <div class="arcanum-task-dialog__empty">
                <p>
                    Beim Laden ist ein Fehler aufgetreten.
                    Bitte versuche es erneut.
                </p>
            </div>
        `;
    }
}

async function changeStudentTaskStatus(
    action,
    taskId,
    button
) {
    const student = await getArcanumCurrentStudent();
    const studentId = extractEntityId(student?.id);

    if (studentId === null) {
        throw new Error(
            "Die Schüler-ID fehlt."
        );
    }

    const endpoint = action === "begin"
        ? "/begin-task"
        : "/cancel-task";

    const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            studentId,
            taskId
        })
    });

    if (!response.ok) {
        throw new Error(
            `Der Etappenstatus konnte nicht geändert werden ` +
            `(${response.status}).`
        );
    }

    button.classList.add("is-success");

    button.textContent = action === "begin"
        ? "Etappe begonnen"
        : "Etappe abgebrochen";

    window.setTimeout(() => {
        window.location.reload();
    }, 450);
}

async function handleTaskActionClick(event) {
    const button = event.target.closest(
        "[data-task-action]"
    );

    if (!button || button.disabled) {
        return;
    }

    const action = button.dataset.taskAction;
    const taskId = Number(button.dataset.taskId);

    if (
        !["begin", "cancel"].includes(action) ||
        !Number.isFinite(taskId)
    ) {
        return;
    }

    if (
        action === "cancel" &&
        !window.confirm(
            "Möchtest du diese Etappe wirklich abbrechen?"
        )
    ) {
        return;
    }

    const originalText = button.textContent;

    button.disabled = true;

    button.textContent = action === "begin"
        ? "Wird begonnen …"
        : "Wird abgebrochen …";

    try {
        await changeStudentTaskStatus(
            action,
            taskId,
            button
        );
    } catch (error) {
        console.error(
            "Arcanum: Etappenstatus konnte nicht geändert werden.",
            error
        );

        button.disabled = false;
        button.textContent = originalText;
        button.classList.add("is-error");

        window.setTimeout(() => {
            button.classList.remove("is-error");
        }, 1800);
    }
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
    const taskId = extractEntityId(task?.id ?? task);

    const coinText = coins > 0
        ? (
            status === "completed"
                ? `${coins} Münzen`
                : `${coins} mögliche Münzen`
        )
        : "Münzwert noch offen";

    let actionHtml = "";

    if (taskId !== null && status === "open") {
        actionHtml = `
            <button
                type="button"
                class="arcanum-task-action-button
                       arcanum-task-action-button--begin"
                data-task-action="begin"
                data-task-id="${taskId}"
            >
                Etappe beginnen
            </button>
        `;
    }

    if (taskId !== null && status === "current") {
        actionHtml = `
            <button
                type="button"
                class="arcanum-task-action-button
                       arcanum-task-action-button--cancel"
                data-task-action="cancel"
                data-task-id="${taskId}"
            >
                Etappe abbrechen
            </button>
        `;
    }

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
                        textValue(task?.name) ||
                        "Unbenannte Etappe"
                    )}
                </strong>
            </div>

            <div class="arcanum-task-row__side">
                <span class="arcanum-task-row__coins">
                    ${escapeHtml(coinText)}
                </span>

                ${actionHtml}
            </div>
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

        if (type === "partner") {
            if (isActive) {
                await loadPartnerMatches(subject, card);
            } else {
                hidePartnerMatches(card);
            }
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


function extractEntityId(value) {
    if (value && typeof value === "object") {
        const nestedId =
            value.id ??
            value.value ??
            value.classId ??
            value.class_id ??
            value.topicId ??
            value.topic_id;

        const parsedNestedId = Number(nestedId);

        return Number.isFinite(parsedNestedId)
            ? parsedNestedId
            : null;
    }

    const parsedValue = Number(value);

    return Number.isFinite(parsedValue)
        ? parsedValue
        : null;
}

function getStudentClassId(student) {
    return extractEntityId(
        student?.class ??
        student?.schoolClass ??
        student?.classId ??
        student?.class_id
    );
}

function getSubjectTopicId(subject) {
    return extractEntityId(
        subject?.currentTopic ??
        subject?.topic ??
        subject?.current_topic ??
        subject?.topicId ??
        subject?.topic_id
    );
}

function hidePartnerMatches(card) {
    const container = card.querySelector(
        "[data-partner-results]"
    );

    if (!container) {
        return;
    }

    container.hidden = true;
    container.innerHTML = "";
}

async function loadPartnerMatches(subject, card) {
    const container = card.querySelector(
        "[data-partner-results]"
    );

    if (!container) {
        return;
    }

    container.hidden = false;
    container.innerHTML = `
        <div class="arcanum-partner-results__status">
            Passende Lernpartner werden gesucht …
        </div>
    `;

    try {
        const student = await getArcanumCurrentStudent();

        const studentId = extractEntityId(student?.id);
        const classId = getStudentClassId(student);
        const subjectId = extractEntityId(subject?.id);
        const topicId = getSubjectTopicId(subject);

        if (
            studentId === null ||
            classId === null ||
            subjectId === null ||
            topicId === null
        ) {
            throw new Error(
                "Schüler-, Klassen-, Fach- oder Themendaten fehlen."
            );
        }

        const response = await fetch("/search-partner", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                studentId,
                classId,
                subjectId,
                topicId
            })
        });

        if (!response.ok) {
            throw new Error(
                `Partnersuche fehlgeschlagen (${response.status}).`
            );
        }

        const payload = await response.json();

        const rawPartners = Array.isArray(payload)
            ? payload
            : safeArray(
                payload?.partners ??
                payload?.students ??
                payload?.results
            );

        const partners = normalisePartnerMatches(
            rawPartners,
            studentId
        );

        renderPartnerMatches(
            container,
            partners,
            subject
        );
    } catch (error) {
        console.error(
            "Arcanum: Partnersuche konnte nicht geladen werden.",
            error
        );

        container.innerHTML = `
            <div
                class="arcanum-partner-results__status
                       arcanum-partner-results__status--error"
            >
                Die passenden Lernpartner konnten nicht geladen
                werden. Bitte versuche es erneut.
            </div>
        `;
    }
}

function normalisePartnerMatches(partners, ownStudentId) {
    const uniquePartners = new Map();

    safeArray(partners).forEach((partner, index) => {
        const partnerId = extractEntityId(
            partner?.id ??
            partner?.studentId ??
            partner?.student_id
        );

        if (
            partnerId !== null &&
            partnerId === ownStudentId
        ) {
            return;
        }

        const name = getPartnerDisplayName(partner);

        if (!name) {
            return;
        }

        const key = partnerId !== null
            ? `id:${partnerId}`
            : `name:${name.toLocaleLowerCase("de")}:${index}`;

        uniquePartners.set(key, {
            ...partner,
            id: partnerId,
            displayName: name
        });
    });

    return [...uniquePartners.values()].sort(
        (left, right) => left.displayName.localeCompare(
            right.displayName,
            "de",
            { sensitivity: "base" }
        )
    );
}

function getPartnerDisplayName(partner) {
    const directName = textValue(
        partner?.name ??
        partner?.displayName ??
        partner?.display_name
    ).trim();

    if (directName) {
        return directName;
    }

    const firstName = textValue(
        partner?.firstName ??
        partner?.first_name
    ).trim();

    const lastName = textValue(
        partner?.lastName ??
        partner?.last_name
    ).trim();

    return `${firstName} ${lastName}`.trim();
}

function getPartnerInitials(name) {
    const parts = textValue(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
        return "?";
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0].slice(0, 1) +
        parts[parts.length - 1].slice(0, 1)
    ).toUpperCase();
}

function renderPartnerMatches(container, partners, subject) {
    if (partners.length === 0) {
        container.innerHTML = `
            <div class="arcanum-partner-results__status">
                Im Moment sucht hier noch kein passender
                Lernpartner.
            </div>
        `;

        return;
    }

    const topicName = textValue(
        subject?.currentTopic?.name ??
        subject?.topic?.name
    ).trim();

    const heading = partners.length === 1
        ? "1 passender Lernpartner"
        : `${partners.length} passende Lernpartner`;

    const topicText = topicName
        ? ` für das Thema ${topicName}`
        : "";

    const cards = partners.map(partner => `
        <article class="arcanum-partner-card">
            <span
                class="arcanum-partner-card__avatar"
                aria-hidden="true"
            >
                ${escapeHtml(
                    getPartnerInitials(partner.displayName)
                )}
            </span>

            <div class="arcanum-partner-card__identity">
                <strong>
                    ${escapeHtml(partner.displayName)}
                </strong>

                <span>sucht ebenfalls einen Partner</span>
            </div>
        </article>
    `).join("");

    container.innerHTML = `
        <header class="arcanum-partner-results__header">
            <div>
                <span class="arcanum-partner-results__overline">
                    Partnersuche
                </span>

                <strong>${escapeHtml(heading)}</strong>
            </div>

            <span class="arcanum-partner-results__topic">
                ${escapeHtml(topicText)}
            </span>
        </header>

        <div class="arcanum-partner-results__grid">
            ${cards}
        </div>
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

/* arcanum-profile-enhancements-v1 */

function getArcanumGraduationValue(student) {
    return (
        student?.graduationLevel ??
        student?.graduation_level ??
        student?.graduation ??
        student?.level ??
        null
    );
}

function formatArcanumGraduation(value) {
    if (
        value &&
        typeof value === "object"
    ) {
        value = (
            value.name ??
            value.label ??
            value.value ??
            value.id
        );
    }

    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
        const numericLabels = {
            0: "Neustarter",
            1: "Starter",
            2: "Durchstarter",
            3: "Lernprofi"
        };

        if (
            Object.prototype.hasOwnProperty.call(
                numericLabels,
                numericValue
            )
        ) {
            return numericLabels[numericValue];
        }
    }

    const normalised = textValue(value)
        .trim()
        .toLocaleLowerCase("de")
        .replace(/[\s_-]+/g, "");

    const textLabels = {
        neustarter: "Neustarter",
        starter: "Starter",
        durchstarter: "Durchstarter",
        lernprofi: "Lernprofi"
    };

    return (
        textLabels[normalised] ??
        textValue(value).trim() ??
        "noch offen"
    );
}

function findGraduationElement() {
    const directElement = (
        document.getElementById("student-graduation") ??
        document.querySelector(
            "[data-student-graduation]"
        )
    );

    if (directElement) {
        return directElement;
    }

    const details = document.querySelector(
        ".arcanum-profile__details"
    );

    if (!details) {
        return null;
    }

    const candidates = [
        ...details.querySelectorAll(
            "div, span, p"
        )
    ];

    const graduationContainer = candidates.find(
        element => (
            element.textContent
                .toLocaleLowerCase("de")
                .includes("graduierung")
        )
    );

    if (!graduationContainer) {
        return null;
    }

    return (
        graduationContainer.querySelector("strong") ??
        graduationContainer.lastElementChild ??
        graduationContainer
    );
}

async function populateArcanumProfileDetails() {
    try {
        const student = await getArcanumCurrentStudent();

        const emailElement = document.getElementById(
            "student-email"
        );

        if (emailElement) {
            emailElement.textContent = (
                textValue(student?.email).trim() ||
                "nicht hinterlegt"
            );
        }

        const graduationElement =
            findGraduationElement();

        if (graduationElement) {
            graduationElement.textContent =
                formatArcanumGraduation(
                    getArcanumGraduationValue(student)
                );

            graduationElement.setAttribute(
                "data-student-graduation",
                ""
            );
        }

        return student;
    } catch (error) {
        console.error(
            "Arcanum: Profilangaben konnten nicht ergänzt werden.",
            error
        );

        const emailElement = document.getElementById(
            "student-email"
        );

        if (emailElement) {
            emailElement.textContent =
                "nicht verfügbar";
        }

        return null;
    }
}

let arcanumDashboardLoadEventSent = false;

function dispatchArcanumStudentDashboardLoad(student) {
    if (arcanumDashboardLoadEventSent) {
        return;
    }

    arcanumDashboardLoadEventSent = true;

    document.documentElement.dataset
        .studentDashboardLoaded = "true";

    const eventDetail = {
        source: "arcanum-overlay",
        student
    };

    if (
        window.jQuery &&
        typeof window.jQuery === "function"
    ) {
        window.jQuery(document).trigger(
            "student-dashboard-load",
            [eventDetail]
        );
    } else {
        document.dispatchEvent(
            new CustomEvent(
                "student-dashboard-load",
                {
                    detail: eventDetail
                }
            )
        );
    }
}

function installArcanumStudentDashboardLoadHook() {
    const initialise = () => {
        const subjectGrid = document.querySelector(
            ".arcanum-subject-grid"
        );

        if (!subjectGrid) {
            window.setTimeout(
                installArcanumStudentDashboardLoadHook,
                50
            );

            return;
        }

        const dashboardIsReady = () => (
            subjectGrid.querySelector(
                ".arcanum-subject-card, " +
                ".arcanum-empty-state"
            ) !== null
        );

        const finishInitialisation = async () => {
            const student =
                await populateArcanumProfileDetails();

            dispatchArcanumStudentDashboardLoad(
                student
            );
        };

        if (dashboardIsReady()) {
            finishInitialisation();
            return;
        }

        const observer = new MutationObserver(() => {
            if (!dashboardIsReady()) {
                return;
            }

            observer.disconnect();
            finishInitialisation();
        });

        observer.observe(
            subjectGrid,
            {
                childList: true,
                subtree: true
            }
        );
    };

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialise,
            { once: true }
        );
    } else {
        initialise();
    }
}

installArcanumStudentDashboardLoadHook();

/* arcanum-profile-metrics-layout-v1 */

(() => {
    function normaliseMetricText(value) {
        return String(value ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .toLocaleLowerCase("de");
    }

    function elementDepth(element, root) {
        let depth = 0;
        let current = element;

        while (
            current &&
            current !== root
        ) {
            depth += 1;
            current = current.parentElement;
        }

        return depth;
    }

    function findMetricLabel(
        root,
        wantedLabel,
        excludedLabel
    ) {
        const candidates = [
            ...root.querySelectorAll("*")
        ].filter(element => {
            const text = normaliseMetricText(
                element.textContent
            );

            return (
                text.includes(wantedLabel) &&
                !text.includes(excludedLabel)
            );
        });

        candidates.sort(
            (first, second) => (
                elementDepth(second, root) -
                elementDepth(first, root)
            )
        );

        return candidates[0] ?? null;
    }

    function findMetricCard(
        labelElement,
        root,
        excludedLabel
    ) {
        let current = labelElement;

        while (
            current &&
            current !== root
        ) {
            const text = normaliseMetricText(
                current.textContent
            );

            if (
                text.includes(excludedLabel)
            ) {
                break;
            }

            const hasValue = (
                /\d/.test(text) ||
                text.includes("offen")
            );

            if (
                hasValue &&
                text.length <= 80
            ) {
                return current;
            }

            current = current.parentElement;
        }

        return labelElement.parentElement;
    }

    function markMetricValue(
        card,
        labelText
    ) {
        const candidates = [
            ...card.querySelectorAll("*")
        ].filter(element => {
            const text = normaliseMetricText(
                element.textContent
            );

            return (
                text &&
                !text.includes(labelText) &&
                (
                    /\d/.test(text) ||
                    text.includes("offen")
                )
            );
        });

        candidates.sort(
            (first, second) => (
                elementDepth(second, card) -
                elementDepth(first, card)
            )
        );

        const valueElement = candidates[0];

        if (valueElement) {
            valueElement.classList.add(
                "arcanum-profile__metric-value"
            );
        }
    }

    function hideEmptySourceContainer(
        container,
        profile,
        identity
    ) {
        if (
            !container ||
            container === profile ||
            container === identity
        ) {
            return;
        }

        const visibleChildren = [
            ...container.children
        ].filter(child => !child.hidden);

        const remainingText = normaliseMetricText(
            container.textContent
        );

        if (
            visibleChildren.length === 0 &&
            remainingText === ""
        ) {
            container.hidden = true;
            container.classList.add(
                "arcanum-profile__metrics-source-empty"
            );
        }
    }

    function arrangeProfileMetrics() {
        const profile = document.querySelector(
            ".arcanum-profile"
        );

        const identity = document.querySelector(
            ".arcanum-profile__identity"
        );

        if (
            !profile ||
            !identity
        ) {
            return false;
        }

        if (
            identity.dataset.metricsLayout === "true"
        ) {
            return true;
        }

        const totalLabel = findMetricLabel(
            profile,
            "gesamtmünzen",
            "platz"
        );

        const rankLabel = findMetricLabel(
            profile,
            "platz",
            "gesamtmünzen"
        );

        if (
            !totalLabel ||
            !rankLabel
        ) {
            return false;
        }

        const totalCard = findMetricCard(
            totalLabel,
            profile,
            "platz"
        );

        const rankCard = findMetricCard(
            rankLabel,
            profile,
            "gesamtmünzen"
        );

        if (
            !totalCard ||
            !rankCard ||
            totalCard === rankCard
        ) {
            console.warn(
                "Arcanum: Gesamtmünzen und Platz konnten " +
                "nicht eindeutig getrennt werden."
            );

            return false;
        }

        const originalParents = new Set([
            totalCard.parentElement,
            rankCard.parentElement
        ]);

        let identityMain = identity.querySelector(
            ":scope > .arcanum-profile__identity-main"
        );

        if (!identityMain) {
            identityMain = document.createElement("div");
            identityMain.className =
                "arcanum-profile__identity-main";

            const existingNodes = [
                ...identity.childNodes
            ];

            for (const node of existingNodes) {
                identityMain.appendChild(node);
            }

            identity.appendChild(identityMain);
        }

        let metrics = identity.querySelector(
            ":scope > .arcanum-profile__metrics"
        );

        if (!metrics) {
            metrics = document.createElement("div");
            metrics.className =
                "arcanum-profile__metrics";

            metrics.setAttribute(
                "aria-label",
                "Münzen und Rang"
            );

            identity.appendChild(metrics);
        }

        totalCard.classList.add(
            "arcanum-profile__metric-card",
            "arcanum-profile__metric-card--coins"
        );

        rankCard.classList.add(
            "arcanum-profile__metric-card",
            "arcanum-profile__metric-card--rank"
        );

        totalLabel.classList.add(
            "arcanum-profile__metric-label"
        );

        rankLabel.classList.add(
            "arcanum-profile__metric-label"
        );

        markMetricValue(
            totalCard,
            "gesamtmünzen"
        );

        markMetricValue(
            rankCard,
            "platz"
        );

        metrics.appendChild(totalCard);
        metrics.appendChild(rankCard);

        for (const parent of originalParents) {
            hideEmptySourceContainer(
                parent,
                profile,
                identity
            );
        }

        identity.dataset.metricsLayout = "true";

        return true;
    }

    function installProfileMetricsLayout() {
        let attempts = 0;
        const maximumAttempts = 60;

        const tryArrangement = () => {
            attempts += 1;

            if (
                arrangeProfileMetrics() ||
                attempts >= maximumAttempts
            ) {
                window.clearInterval(timer);
            }
        };

        const timer = window.setInterval(
            tryArrangement,
            100
        );

        tryArrangement();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            installProfileMetricsLayout,
            { once: true }
        );
    } else {
        installProfileMetricsLayout();
    }
})();

/* arcanum-avatar-selector-v1 */
const ARCANUM_AVATAR_ASSET_VERSION = "20260720-2";

const ARCANUM_AVATARS = [
    "/arcanum-avatar-01.png",
    "/arcanum-avatar-02.png",
    "/arcanum-avatar-03.png",
    "/arcanum-avatar-04.png",
    "/arcanum-avatar-05.png",
    "/arcanum-avatar-06.png",
    "/arcanum-avatar-07.png",
    "/arcanum-avatar-08.png",
    "/arcanum-avatar-09.png",
    "/arcanum-avatar-10.png",
    "/arcanum-avatar-11.png",
    "/arcanum-avatar-12.png",
    "/arcanum-avatar-13.png",
    "/arcanum-avatar-14.png",
    "/arcanum-avatar-15.png",
    "/arcanum-avatar-16.png",
    "/arcanum-avatar-17.png",
    "/arcanum-avatar-18.png",
    "/arcanum-avatar-19.png",
    "/arcanum-avatar-20.png",
    "/arcanum-avatar-21.png",
    "/arcanum-avatar-22.png",
    "/arcanum-avatar-23.png",
    "/arcanum-avatar-24.png",
    "/arcanum-avatar-25.png",
    "/arcanum-avatar-26.png",
    "/arcanum-avatar-27.png",
    "/arcanum-avatar-28.png",
    "/arcanum-avatar-29.png",
    "/arcanum-avatar-30.png",
    "/arcanum-avatar-31.png",
    "/arcanum-avatar-32.png",
    "/arcanum-avatar-33.png",
    "/arcanum-avatar-34.png",
    "/arcanum-avatar-35.png",
    "/arcanum-avatar-36.png",
    "/arcanum-avatar-37.png",
    "/arcanum-avatar-38.png",
    "/arcanum-avatar-39.png",
    "/arcanum-avatar-40.png",
    "/arcanum-avatar-41.png",
    "/arcanum-avatar-42.png",
    "/arcanum-avatar-43.png",
    "/arcanum-avatar-44.png",
    "/arcanum-avatar-45.png",
    "/arcanum-avatar-46.png",
    "/arcanum-avatar-47.png",
    "/arcanum-avatar-48.png",
    "/arcanum-avatar-49.png",
    "/arcanum-avatar-50.png",
    "/arcanum-avatar-51.png",
    "/arcanum-avatar-52.png",
    "/arcanum-avatar-53.png",
    "/arcanum-avatar-54.png",
    "/arcanum-avatar-55.png",
    "/arcanum-avatar-56.png",
    "/arcanum-avatar-57.png",
    "/arcanum-avatar-58.png",
    "/arcanum-avatar-59.png",
    "/arcanum-avatar-60.png"
];

let arcanumAvatarStudentId = null;
let arcanumSelectedAvatar = null;

function initialiseAvatarSelector(studentData) {
    const button = document.getElementById("avatar-button");
    const studentId = extractEntityId(studentData?.id);

    if (!button || studentId === null) {
        return;
    }

    arcanumAvatarStudentId = studentId;
    button.disabled = false;
    button.removeAttribute("title");

    const storageKey = getAvatarStorageKey(studentId);
    const storedAvatar = window.localStorage.getItem(storageKey);

    if (storedAvatar && ARCANUM_AVATARS.includes(storedAvatar)) {
        arcanumSelectedAvatar = storedAvatar;
        applyAvatarToProfile(storedAvatar);
    }

    if (button.dataset.avatarSelectorBound !== "true") {
        button.dataset.avatarSelectorBound = "true";
        button.addEventListener("click", openAvatarSelector);
    }
}

function getAvatarStorageKey(studentId) {
    return `arcanum-avatar:student:${studentId}`;
}

function applyAvatarToProfile(avatarPath) {
    const avatar = document.getElementById("student-avatar");
    const initials = document.getElementById("student-initials");

    if (!avatar) {
        return;
    }

    avatar.style.setProperty(
        "background-image",
        `url("${avatarPath}?v=${ARCANUM_AVATAR_ASSET_VERSION}")`,
        "important"
    );
    avatar.style.setProperty("background-size", "cover", "important");
    avatar.style.setProperty(
        "background-position",
        "center",
        "important"
    );
    avatar.classList.add("has-selected-avatar");

    if (initials) {
        initials.hidden = true;
    }
}

function openAvatarSelector() {
    const dialog = ensureAvatarSelectorDialog();
    updateAvatarSelection(dialog);

    if (typeof dialog.showModal === "function") {
        if (!dialog.open) {
            dialog.showModal();
        }
    } else {
        dialog.setAttribute("open", "");
    }
}

function ensureAvatarSelectorDialog() {
    let dialog = document.getElementById("arcanum-avatar-dialog");

    if (dialog) {
        return dialog;
    }

    dialog = document.createElement("dialog");
    dialog.id = "arcanum-avatar-dialog";
    dialog.className = "arcanum-avatar-dialog";
    dialog.setAttribute("aria-labelledby", "arcanum-avatar-dialog-title");

    const avatarButtons = ARCANUM_AVATARS.map((avatarPath, index) => `
        <button
            type="button"
            class="arcanum-avatar-choice"
            data-avatar-path="${escapeHtml(avatarPath)}"
            aria-label="Avatar ${index + 1} auswählen"
        >
            <img
                src="${escapeHtml(avatarPath)}?v=${ARCANUM_AVATAR_ASSET_VERSION}"
                alt=""
                draggable="false"
            >
            <span aria-hidden="true">&#10003;</span>
        </button>
    `).join("");

    dialog.innerHTML = `
        <div class="arcanum-avatar-dialog__panel">
            <header class="arcanum-avatar-dialog__header">
                <div>
                    <span class="arcanum-avatar-dialog__overline">
                        Basiscamp Arcanum
                    </span>
                    <h2 id="arcanum-avatar-dialog-title">
                        Wähle deinen Avatar
                    </h2>
                    <p>
                        Tippe auf ein Gesicht. Die Auswahl wird sofort
                        in deinem Profil angezeigt.
                    </p>
                </div>

                <button
                    type="button"
                    class="arcanum-avatar-dialog__close"
                    data-avatar-dialog-close
                    aria-label="Avatar-Auswahl schließen"
                >
                    &times;
                </button>
            </header>

            <div class="arcanum-avatar-dialog__grid">
                ${avatarButtons}
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector("[data-avatar-dialog-close]")
        ?.addEventListener("click", () => dialog.close());

    dialog.addEventListener("click", event => {
        if (event.target === dialog) {
            dialog.close();
            return;
        }

        const choice = event.target.closest("[data-avatar-path]");
        if (!choice) {
            return;
        }

        const avatarPath = choice.dataset.avatarPath;
        if (!ARCANUM_AVATARS.includes(avatarPath)) {
            return;
        }

        arcanumSelectedAvatar = avatarPath;
        applyAvatarToProfile(avatarPath);

        if (arcanumAvatarStudentId !== null) {
            window.localStorage.setItem(
                getAvatarStorageKey(arcanumAvatarStudentId),
                avatarPath
            );
        }

        updateAvatarSelection(dialog);
        window.setTimeout(() => dialog.close(), 140);
    });

    return dialog;
}

function updateAvatarSelection(dialog) {
    dialog.querySelectorAll("[data-avatar-path]").forEach(choice => {
        const selected =
            choice.dataset.avatarPath === arcanumSelectedAvatar;

        choice.classList.toggle("is-selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
    });
}
/* /arcanum-avatar-selector-v1 */
