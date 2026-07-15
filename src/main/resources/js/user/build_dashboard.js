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

        <dl class="arcanum-subject-stats">
            <div>
                <dt>Aktuell</dt>
                <dd>${subject.selectedTasks.length} Etappen</dd>
            </div>

            <div>
                <dt>Bestanden</dt>
                <dd>${subject.completedTasks.length} Etappen</dd>
            </div>

            <div>
                <dt>Gesperrt</dt>
                <dd>${subject.lockedTasks.length} Etappen</dd>
            </div>
        </dl>

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

    return card;
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
