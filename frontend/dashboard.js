import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";


/* ======================================================
   INIT
====================================================== */

const auth = getAuth();

let firebaseToken = null;

let autoRefreshInterval = null;

let reportExpiryInterval = null;
let userCredits = 0;
let reportReadyTrackerInitialized = false;

const knownReportStatuses = new Map();
/* ======================================================
   PAGINATION
====================================================== */

let currentReportPage = 1;

const REPORTS_PER_PAGE = 5;

let totalReportPages = 1;

let totalReportCount = 0;


/* ======================================================
   GLOBAL REPORT DATA
====================================================== */

let currentReports = [];


/* ======================================================
   DOM
====================================================== */

const reportTable =
  document.getElementById("reportTable");


/* ======================================================
   TOAST
====================================================== */

function showToast(msg) {

  const toast =
    document.createElement("div");

  toast.className =
    "toast-message";

  toast.textContent =
    msg;

  document.body.appendChild(toast);


  setTimeout(() => {

    toast.style.opacity = "1";

  }, 100);


  setTimeout(() => {

    toast.style.opacity = "0";

    setTimeout(() => {

      toast.remove();

    }, 300);

  }, 3000);

}

/* ======================================================
   REPORT READY SOUND
====================================================== */

function playReportReadySound() {

  try {

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext =
      new AudioContext();


    if (
      audioContext.state ===
      "suspended"
    ) {
      audioContext.resume();
    }


    /* =========================
       FIRST BEEP
    ========================= */

    const oscillator1 =
      audioContext.createOscillator();

    const gain1 =
      audioContext.createGain();


    oscillator1.type =
      "sine";

    oscillator1.frequency.setValueAtTime(
      880,
      audioContext.currentTime
    );


    gain1.gain.setValueAtTime(
      0.0001,
      audioContext.currentTime
    );

    gain1.gain.exponentialRampToValueAtTime(
      0.20,
      audioContext.currentTime + 0.02
    );

    gain1.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + 0.20
    );


    oscillator1.connect(
      gain1
    );

    gain1.connect(
      audioContext.destination
    );


    oscillator1.start(
      audioContext.currentTime
    );

    oscillator1.stop(
      audioContext.currentTime + 0.20
    );


    /* =========================
       SECOND BEEP
    ========================= */

    const oscillator2 =
      audioContext.createOscillator();

    const gain2 =
      audioContext.createGain();


    oscillator2.type =
      "sine";

    oscillator2.frequency.setValueAtTime(
      1174,
      audioContext.currentTime + 0.22
    );


    gain2.gain.setValueAtTime(
      0.0001,
      audioContext.currentTime + 0.22
    );

    gain2.gain.exponentialRampToValueAtTime(
      0.20,
      audioContext.currentTime + 0.24
    );

    gain2.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + 0.45
    );


    oscillator2.connect(
      gain2
    );

    gain2.connect(
      audioContext.destination
    );


    oscillator2.start(
      audioContext.currentTime + 0.22
    );

    oscillator2.stop(
      audioContext.currentTime + 0.45
    );


    /* =========================
       CLOSE AUDIO CONTEXT
    ========================= */

    setTimeout(
      () => {
        audioContext.close();
      },
      700
    );


  } catch (error) {

    console.warn(
      "⚠️ Notification sound unavailable:",
      error
    );

  }

}
/* ======================================================
   CHECK FOR NEWLY COMPLETED REPORTS
====================================================== */

function checkForNewCompletedReports(
  reports
) {

  if (
    !Array.isArray(reports)
  ) {
    return;
  }


  /* ==================================================
     FIRST LOAD

     Store current statuses but DO NOT play sound.
  ================================================== */

  if (
    !reportReadyTrackerInitialized
  ) {

    reports.forEach(
      (report) => {

        knownReportStatuses.set(
          String(report._id),
          report.status
        );

      }
    );


    reportReadyTrackerInitialized =
      true;

    return;
  }


  let newReportReady =
    false;


  /* ==================================================
     CHECK STATUS CHANGES
  ================================================== */

  reports.forEach(
    (report) => {

      const id =
        String(report._id);

      const oldStatus =
        knownReportStatuses.get(id);


      const newStatus =
        report.status;


      /* ================================================
         PROCESSING / PENDING → COMPLETED
      ================================================ */

      if (
        newStatus === "completed" &&
        oldStatus &&
        oldStatus !== "completed"
      ) {

        newReportReady =
          true;

      }


      /* ================================================
         Store latest status
      ================================================ */

      knownReportStatuses.set(
        id,
        newStatus
      );

    }
  );


  /* ==================================================
     PLAY SOUND ONCE
  ================================================== */

  if (newReportReady) {

    playReportReadySound();

    showToast(
      "Your report is ready! 🎉"
    );

  }

}
/* ======================================================
   FIREBASE TOKEN
====================================================== */

async function getFirebaseToken(
  forceRefresh = false
) {

  const user =
    auth.currentUser;

  if (!user) {

    throw new Error(
      "User not logged in"
    );

  }

  firebaseToken =
    await user.getIdToken(
      forceRefresh
    );

  return firebaseToken;
}


/* ======================================================
   AUTH FETCH
====================================================== */

async function authFetch(
  url,
  options = {}
) {

  const token =
    await getFirebaseToken();

  const headers = {
    ...(options.headers || {}),
    Authorization:
      `Bearer ${token}`
  };

  return fetch(
    url,
    {
      ...options,
      headers
    }
  );

}


/* ======================================================
   LOAD REPORTS
====================================================== */

async function loadReports(
  page = currentReportPage,
  options = {},
  hasRetried = false
) {

  try {

    const {
      silent = false
    } = options;


    if (!silent) {

      if (reportTable) {

        reportTable.innerHTML = `

          <tr>

            <td
              colspan="5"
              style="
                text-align:center;
                padding:30px;
              "
            >

              Loading reports...

            </td>

          </tr>

        `;

      }

    }


    const safePage =
      Math.max(
        1,
        Number(page) || 1
      );


    const response =
      await authFetch(
        `/api/reports?page=${safePage}&limit=${REPORTS_PER_PAGE}`
      );


    /* ==================================================
       AUTH ERROR
    ================================================== */

if (response.status === 401) {

  console.warn(
    "⚠️ Authentication failed"
  );

  if (!options.retried) {

    firebaseToken = null;

    await getFirebaseToken(true);

    return loadReports(
      safePage,
      {
        ...options,
        retried: true
      }
    );

  }

  console.error(
    "❌ Fresh Firebase token also rejected by backend"
  );

  clearInterval(
    autoRefreshInterval
  );

  if (reportTable) {

    reportTable.innerHTML = `
      <tr>
        <td colspan="5"
          style="text-align:center;padding:30px;color:red;">
          Authentication failed. Please refresh the page.
        </td>
      </tr>
    `;

  }

  return;

}


    if (!response.ok) {

      const text =
        await response.text();

      throw new Error(
        `Reports request failed: ${response.status} ${text}`
      );

    }


    const data =
      await response.json();


    /* ==================================================
       NEW PAGINATED RESPONSE
    ================================================== */

    let reports = [];

    if (
      data &&
      Array.isArray(data.reports)
    ) {

      reports =
        data.reports;

      totalReportCount =
        Number(data.total) || 0;

      totalReportPages =
        Math.max(
          1,
          Number(data.totalPages) || 1
        );

      currentReportPage =
        Math.min(
          Math.max(
            1,
            Number(data.page) || safePage
          ),
          totalReportPages
        );

    }

    /* ==================================================
       BACKWARD COMPATIBILITY
       In case old backend is still running
    ================================================== */

    else if (
      Array.isArray(data)
    ) {

      reports =
        data;

      totalReportCount =
        data.length;

      totalReportPages =
        Math.max(
          1,
          Math.ceil(
            data.length /
            REPORTS_PER_PAGE
          )
        );

      currentReportPage =
        1;

    }

    else {

      throw new Error(
        "Invalid reports response"
      );

    }


    currentReports =
      reports;


    /* ==================================================
       RENDER
    ================================================== */

    renderReports(
      reports
    );


    renderPagination();


    updateReportExpiryTimers();


    return reports;


  } catch (error) {

    console.error(
      "❌ Load reports error:",
      error
    );


    if (reportTable) {

      reportTable.innerHTML = `

        <tr>

          <td
            colspan="5"
            style="
              text-align:center;
              padding:30px;
              color:#ff6b6b;
            "
          >

            Unable to load reports.

            <br><br>

            <button
              type="button"
              onclick="loadReports(${currentReportPage})"
              class="view-btn"
            >

              Try Again

            </button>

          </td>

        </tr>

      `;

    }


    throw error;

  }

}


/* ======================================================
   RENDER REPORTS
====================================================== */

function renderReports(
  reports
) {

  if (!reportTable) {
    return;
  }


  reportTable.innerHTML = "";


  /* ====================================================
     EMPTY
  ==================================================== */

  if (
    !reports ||
    reports.length === 0
  ) {

    reportTable.innerHTML = `

      <tr>

        <td
          colspan="5"
          style="
            text-align:center;
            padding:35px;
            color:var(--text-muted);
          "
        >

          No reports found.

        </td>

      </tr>

    `;

    return;

  }


  /* ====================================================
     REPORT ROWS
  ==================================================== */

  reports.forEach(
    (report) => {

      const row =
        document.createElement("tr");


      row.dataset.reportId =
        report._id;


      /* =================================================
         DOCUMENT
      ================================================= */

      const documentCell =
        document.createElement("td");

      documentCell.dataset.label =
        "Document";

      documentCell.textContent =
        report.filename ||
        "Untitled";


      /* =================================================
         AI
      ================================================= */

      const aiCell =
        document.createElement("td");

      aiCell.dataset.label =
        "AI";

      aiCell.innerHTML =
        renderReportButton(
          report,
          "ai"
        );


      /* =================================================
         PLAGIARISM
      ================================================= */

      const plagCell =
        document.createElement("td");

      plagCell.dataset.label =
        "Plagiarism";

      plagCell.innerHTML =
        renderReportButton(
          report,
          "plag"
        );


      /* =================================================
         DATE
      ================================================= */

      const dateCell =
        document.createElement("td");

      dateCell.dataset.label =
        "Date";

      dateCell.textContent =
        formatDate(
          report.createdAt
        );


      /* =================================================
         ACTIONS
      ================================================= */

      const actionsCell =
        document.createElement("td");

      actionsCell.dataset.label =
        "Actions";

      actionsCell.className =
        "actions-cell";


      actionsCell.innerHTML =
        renderActions(
          report
        );


      row.appendChild(
        documentCell
      );

      row.appendChild(
        aiCell
      );

      row.appendChild(
        plagCell
      );

      row.appendChild(
        dateCell
      );

      row.appendChild(
        actionsCell
      );


      reportTable.appendChild(
        row
      );

    }
  );

}


/* ======================================================
   REPORT BUTTON
====================================================== */

/* ======================================================
   REPORT BUTTON
   View → Completed after exactly 24 hours
====================================================== */

function renderReportButton(
  report,
  type
) {

  const reportData =
    type === "ai"
      ? report.aiReport
      : report.plagReport;


  /* ====================================================
     REPORT NOT AVAILABLE
  ==================================================== */

  if (
    !reportData ||
    !reportData.storedName
  ) {

    if (
      report.status === "processing" ||
      report.status === "pending"
    ) {

      return `
        <span class="processing">
          Processing...
        </span>
      `;

    }

    return `
      <span class="processing">
        —
      </span>
    `;

  }


  /* ====================================================
     CHECK 24-HOUR EXPIRY
  ==================================================== */

  let expired = false;

  if (report.completedAt) {

    const completedAt =
      new Date(
        report.completedAt
      ).getTime();

    const expiry =
      completedAt +
      (24 * 60 * 60 * 1000);

    expired =
      Date.now() >= expiry;

  }


  /* ====================================================
     AFTER 24 HOURS
     SAME BUTTON CHANGES:
     View → Completed
  ==================================================== */

  if (expired) {

    return `
      <button
        type="button"
        class="completed-btn"
        disabled
      >
        Completed
      </button>
    `;

  }


  /* ====================================================
     BEFORE 24 HOURS
     SHOW VIEW
  ==================================================== */

  return `
    <button
      type="button"
      class="view-btn"
      onclick="viewReport(
        '${escapeJs(reportData.storedName)}',
        '${escapeJs(reportData.filename || type)}',
        '${escapeJs(report._id)}',
        '${type}'
      )"
    >
      View
    </button>
  `;

}


/* ======================================================
   ACTIONS
====================================================== */

/* ======================================================
   ACTIONS
   - Before 24 hours: ONLY countdown + Delete
   - After 24 hours: Completed + Delete
====================================================== */

function renderActions(report) {

  /* ====================================================
     COMPLETED REPORT
     24-HOUR VIEW WINDOW
  ==================================================== */

  if (
    report.completedAt &&
    report.status === "completed"
  ) {

    const completedAt =
      new Date(report.completedAt).getTime();

    const expiry =
      completedAt + (24 * 60 * 60 * 1000);

    const now = Date.now();


    /* ==================================================
       BEFORE 24 HOURS
       COUNTDOWN + DELETE
    ================================================== */

    if (now < expiry) {

      return `
        <span
          class="report-expiry-countdown"
          data-expiry="${expiry}"
        >
          Expires in
          <strong>
            ${formatRemainingTime(
              expiry - now
            )}
          </strong>
        </span>

        <button
          type="button"
          class="delete-btn"
          onclick="deleteReport('${escapeJs(report._id)}')"
        >
          Delete
        </button>
      `;
    }


    /* ==================================================
       AFTER 24 HOURS
       COMPLETED + DELETE
    ================================================== */

    return `
      <button
        type="button"
        class="completed-btn"
        disabled
      >
        Completed
      </button>

      <button
        type="button"
        class="delete-btn"
        onclick="deleteReport('${escapeJs(report._id)}')"
      >
        Delete
      </button>
    `;
  }


  /* ====================================================
     PROCESSING / PENDING
     ONLY DELETE
  ==================================================== */

  if (
    report.status === "processing" ||
    report.status === "pending"
  ) {

    return `
      <button
        type="button"
        class="delete-btn"
        onclick="deleteReport('${escapeJs(report._id)}')"
      >
        Delete
      </button>
    `;
  }


  /* ====================================================
     OTHER STATUS
  ==================================================== */

  return `
    <button
      type="button"
      class="delete-btn"
      onclick="deleteReport('${escapeJs(report._id)}')"
    >
      Delete
    </button>
  `;
}


/* ======================================================
   VIEW REPORT
====================================================== */

window.viewReport = function (
  url,
  filename,
  reportId,
  type
) {

  if (!url) {

    showToast(
      "Report is not available."
    );

    return;

  }


  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );


  /*
    The report is considered viewed when the user
    opens it. We intentionally do not change the
    database completedAt here because your existing
    24-hour logic is based on completedAt.
  */

};


/* ======================================================
   DELETE REPORT
====================================================== */

window.deleteReport =
  async function (
    reportId
  ) {

    if (!reportId) {
      return;
    }


    const confirmed =
      window.confirm(
        "Are you sure you want to delete this report?"
      );


    if (!confirmed) {
      return;
    }


    try {

      const response =
        await authFetch(
          `/api/admin/delete-report/${encodeURIComponent(reportId)}`,
          {
            method: "DELETE"
          }
        );


      if (!response.ok) {

        throw new Error(
          `Delete failed: ${response.status}`
        );

      }


      showToast(
        "Report deleted successfully."
      );


      /*
        Reload current page.

        If the user deleted the last report
        on the current page, automatically move
        to the previous page.
      */

      if (
        currentReports.length === 1 &&
        currentReportPage > 1
      ) {

        currentReportPage--;

      }


      await loadReports(
        currentReportPage
      );


    } catch (error) {

      console.error(
        "❌ Delete report error:",
        error
      );


      showToast(
        "Unable to delete report."
      );

    }

  };


/* ======================================================
   PAGINATION
====================================================== */

function renderPagination() {

  let wrapper =
    document.getElementById(
      "paginationWrapper"
    );


  /*
    Create pagination automatically if
    HTML does not contain it yet.
  */

  if (!wrapper) {

    const resultsSection =
      document.querySelector(
        ".results-section"
      );


    if (!resultsSection) {
      return;
    }


    wrapper =
      document.createElement("div");

    wrapper.id =
      "paginationWrapper";

    wrapper.className =
      "pagination-wrapper";


    resultsSection.appendChild(
      wrapper
    );

  }


  wrapper.innerHTML = "";


  /* ====================================================
     SHOWING TEXT
  ==================================================== */

  const info =
    document.createElement("div");

  info.className =
    "pagination-info";


  if (
    totalReportCount === 0
  ) {

    info.textContent =
      "Showing 0–0 of 0";

  } else {

    const start =
      (
        (currentReportPage - 1) *
        REPORTS_PER_PAGE
      ) + 1;


    const end =
      Math.min(
        start +
        currentReports.length -
        1,

        totalReportCount
      );


    info.textContent =
      `Showing ${start}–${end} of ${totalReportCount}`;

  }


  /* ====================================================
     CONTROLS
  ==================================================== */

  const controls =
    document.createElement("div");

  controls.className =
    "pagination";


  /*
    Hide pagination if only one page.
  */

  if (
    totalReportPages <= 1
  ) {

    wrapper.appendChild(
      info
    );

    return;

  }


  /* ====================================================
     PREVIOUS
  ==================================================== */

  const previous =
    document.createElement("button");

  previous.type =
    "button";

  previous.className =
    "pagination-btn";

  previous.innerHTML =
    "‹";

  previous.disabled =
    currentReportPage <= 1;


  previous.onclick =
    () => {

      if (
        currentReportPage > 1
      ) {

        goToReportPage(
          currentReportPage - 1
        );

      }

    };


  controls.appendChild(
    previous
  );


  /* ====================================================
     PAGE NUMBERS
  ==================================================== */

  const pages =
    getPaginationPages(
      currentReportPage,
      totalReportPages
    );


  pages.forEach(
    (page) => {

      if (
        page === "..."
      ) {

        const dots =
          document.createElement(
            "span"
          );

        dots.className =
          "pagination-dots";

        dots.textContent =
          "...";

        controls.appendChild(
          dots
        );

        return;

      }


      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "pagination-btn";


      if (
        page === currentReportPage
      ) {

        button.classList.add(
          "active"
        );

      }


      button.textContent =
        page;


      button.onclick =
        () => {

          goToReportPage(
            page
          );

        };


      controls.appendChild(
        button
      );

    }
  );


  /* ====================================================
     NEXT
  ==================================================== */

  const next =
    document.createElement("button");

  next.type =
    "button";

  next.className =
    "pagination-btn";

  next.innerHTML =
    "›";

  next.disabled =
    currentReportPage >=
    totalReportPages;


  next.onclick =
    () => {

      if (
        currentReportPage <
        totalReportPages
      ) {

        goToReportPage(
          currentReportPage + 1
        );

      }

    };


  controls.appendChild(
    next
  );


  wrapper.appendChild(
    info
  );

  wrapper.appendChild(
    controls
  );

}


/* ======================================================
   PAGINATION PAGE LIST
====================================================== */

function getPaginationPages(
  current,
  total
) {

  /*
    Example:

    1 2 3 4 5 ... 24

    or

    1 ... 10 11 12 13 14 ... 24
  */


  if (
    total <= 8
  ) {

    return Array.from(
      {
        length: total
      },
      (_, index) =>
        index + 1
    );

  }


  const pages = [];


  pages.push(1);


  if (
    current > 4
  ) {

    pages.push("...");

  }


  const start =
    Math.max(
      2,
      current - 2
    );


  const end =
    Math.min(
      total - 1,
      current + 2
    );


  for (
    let i = start;
    i <= end;
    i++
  ) {

    pages.push(i);

  }


  if (
    current < total - 3
  ) {

    pages.push("...");

  }


  pages.push(total);


  return pages;

}


/* ======================================================
   GO TO PAGE
====================================================== */

async function goToReportPage(
  page
) {

  if (
    page < 1 ||
    page > totalReportPages ||
    page === currentReportPage
  ) {

    return;

  }


  currentReportPage =
    page;


  try {

    await loadReports(
      currentReportPage
    );


    window.scrollTo({
      top:
        document.querySelector(
          ".results-section"
        )?.offsetTop || 0,

      behavior:
        "smooth"
    });


  } catch (error) {

    console.error(
      "❌ Pagination error:",
      error
    );

  }

}


/* ======================================================
   FORMAT DATE
====================================================== */

function formatDate(
  date
) {

  if (!date) {
    return "—";
  }


  const parsed =
    new Date(date);


  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {

    return "—";

  }


  return parsed.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


/* ======================================================
   24-HOUR EXPIRY COUNTDOWN
====================================================== */

/* ======================================================
   24-HOUR EXPIRY COUNTDOWN
====================================================== */

function updateReportExpiryTimers() {

  if (
    reportExpiryInterval
  ) {

    clearInterval(
      reportExpiryInterval
    );

  }


  const update =
    () => {

      const elements =
        document.querySelectorAll(
          ".report-expiry-countdown"
        );


      let hasExpired = false;


      elements.forEach(
        (element) => {

          const expiry =
            Number(
              element.dataset.expiry
            );


          if (!expiry) {
            return;
          }


          const remaining =
            expiry -
            Date.now();


          /* ==========================================
             24 HOURS FINISHED
          ========================================== */

          if (
            remaining <= 0
          ) {

            hasExpired = true;

            return;

          }


          const strong =
            element.querySelector(
              "strong"
            );


          if (strong) {

            strong.textContent =
              formatRemainingTime(
                remaining
              );

          }

        }
      );


      /* ==============================================
         RE-RENDER REPORTS

         This is important.

         renderReportButton()
         will now see that 24 hours expired
         and change:

         View → Completed
      ============================================== */

      if (hasExpired) {

        clearInterval(
          reportExpiryInterval
        );

        reportExpiryInterval =
          null;


        renderReports(
          currentReports
        );


        renderPagination();


        /*
          If another report still has
          an active countdown, restart timer.
        */

        const activeTimers =
          document.querySelectorAll(
            ".report-expiry-countdown"
          );


        if (
          activeTimers.length > 0
        ) {

          updateReportExpiryTimers();

        }

        return;

      }

    };


  update();


  reportExpiryInterval =
    setInterval(
      update,
      1000
    );

}


/* ======================================================
   FORMAT REMAINING TIME
====================================================== */

function formatRemainingTime(
  milliseconds
) {

  if (
    milliseconds <= 0
  ) {

    return "Expired";

  }


  const totalSeconds =
    Math.floor(
      milliseconds / 1000
    );


  const days =
    Math.floor(
      totalSeconds /
      86400
    );


  const hours =
    Math.floor(
      (
        totalSeconds %
        86400
      ) / 3600
    );


  const minutes =
    Math.floor(
      (
        totalSeconds %
        3600
      ) / 60
    );


  const seconds =
    totalSeconds %
    60;


  if (days > 0) {

    return `${days}d ${hours}h ${minutes}m`;

  }


  return [
    String(hours).padStart(
      2,
      "0"
    ),

    String(minutes).padStart(
      2,
      "0"
    ),

    String(seconds).padStart(
      2,
      "0"
    )

  ].join(":");

}


/* ======================================================
   HTML ESCAPE
====================================================== */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


/* ======================================================
   JAVASCRIPT ESCAPE
====================================================== */

function escapeJs(
  value
) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "\\",
      "\\\\"
    )

    .replaceAll(
      "'",
      "\\'"
    )

    .replaceAll(
      "\n",
      "\\n"
    )

    .replaceAll(
      "\r",
      "\\r"
    );

}

/* ======================================================
   UPLOAD LOCK BASED ON CREDITS
====================================================== */

function updateUploadLock() {

  const uploadSection =
    document.querySelector(".upload-section");

  const uploadForm =
    document.getElementById("uploadForm");

  if (!uploadSection || !uploadForm) {
    return;
  }

  const fileInput =
    uploadForm.querySelector('input[type="file"]');

  const uploadButton =
    uploadForm.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

  const locked =
    userCredits <= 0;


  /* ==================================================
     DISABLE / ENABLE UPLOAD CONTROLS
  ================================================== */

  if (fileInput) {
    fileInput.disabled = locked;
  }

  if (uploadButton) {
    uploadButton.disabled = locked;
  }


  /* ==================================================
     LOCK CLASS
  ================================================== */

  uploadSection.classList.toggle(
    "upload-locked",
    locked
  );


  /* ==================================================
     LOCK MESSAGE
  ================================================== */

  let lockMessage =
    uploadSection.querySelector(
      ".upload-lock-message"
    );


  if (locked) {

    if (!lockMessage) {

      lockMessage =
        document.createElement("div");

      lockMessage.className =
        "upload-lock-message";

      lockMessage.innerHTML = `
        <strong>Upload Locked 🔒</strong>
        <span>You need credits to upload documents.</span>

      
      `;

      uploadSection.prepend(
        lockMessage
      );
    }

  } else {

    if (lockMessage) {
      lockMessage.remove();
    }

  }

}
/* ======================================================
   LOAD USER STATUS
====================================================== */
async function loadUserStatus() {

  try {

    const response =
      await authFetch(
        "/api/user/status"
      );

    if (!response.ok) {
      return;
    }

    const data =
      await response.json();


    /* =========================
       CREDITS
    ========================= */

    const desktopCredits =
      document.getElementById("credits");

    const mobileCredits =
      document.getElementById("creditsMobile");

    const creditValue =
  Number(data.credits) || 0;

userCredits =
  creditValue;

    if (desktopCredits) {
      desktopCredits.textContent =
        creditValue;
    }

    if (mobileCredits) {
      mobileCredits.textContent =
        creditValue;
    }


    /* =========================
       ACCOUNT CREDITS
    ========================= */

    const accCredits =
      document.getElementById(
        "accCredits"
      );

    if (accCredits) {
      accCredits.textContent =
        creditValue;
    }


    /* =========================
       EXPIRY DATE
    ========================= */

    const expiryDate =
      document.getElementById(
        "expiryDate"
      );

    if (
      expiryDate &&
      data.expiryDate
    ) {

      expiryDate.textContent =
        formatDate(
          data.expiryDate
        );

    }
    updateUploadLock();

  } catch (error) {

    console.error(
      "❌ User status error:",
      error
    );

  }

}


/* ======================================================
   ACCOUNT
====================================================== */

window.openAccount =
  async function () {

    const panel =
      document.getElementById(
        "accountPanel"
      );


    if (!panel) {
      return;
    }


    panel.classList.add(
      "open"
    );


    const email =
      document.getElementById(
        "accEmail"
      );


    if (
      email &&
      auth.currentUser
    ) {

      email.textContent =
        auth.currentUser.email ||
        "—";

    }


    await loadUserStatus();

  };


window.closeAccount =
  function () {

    const panel =
      document.getElementById(
        "accountPanel"
      );


    if (panel) {

      panel.classList.remove(
        "open"
      );

    }

  };


/* ======================================================
   PURCHASE
====================================================== */

/* ======================================================
   PURCHASE
====================================================== */

window.redirectToPurchase = function () {
  window.location.href = "https://scanai.sell.app/";
};


window.showPurchaseHistory =
  function () {

    window.location.href =
      "/purchase-history.html";

  };


/* ======================================================
   LOGOUT
====================================================== */

window.logout =
  async function () {

    try {

      await signOut(
        auth
      );

      window.location.href =
        "/login.html";

    } catch (error) {

      console.error(
        "❌ Logout error:",
        error
      );

      showToast(
        "Unable to logout."
      );

    }

  };


/* ======================================================
   UPLOAD FORM
====================================================== */

function initializeUpload() {

  const uploadSection =
    document.querySelector(
      ".upload-section"
    );


  if (!uploadSection) {
    return;
  }


  /*
    Do not overwrite an existing upload UI.
  */

  const existingForm =
    document.getElementById(
      "uploadForm"
    );


  if (!existingForm) {
    return;
  }


  existingForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      /* ==================================================
         STOP UPLOAD WHEN CREDITS ARE 0
      ================================================== */

      if (userCredits <= 0) {

        showToast(
          "You need credits to upload documents."
        );

        updateUploadLock();

        return;
      }


      const fileInput =
        existingForm.querySelector(
          'input[type="file"]'
        );


      if (
        !fileInput ||
        !fileInput.files.length
      ) {

        showToast(
          "Please select a file."
        );

        return;

      }


      const formData =
        new FormData(
          existingForm
        );


      try {

        const response =
          await authFetch(
            "/api/upload",
            {
              method: "POST",
              body: formData
            }
          );


        if (!response.ok) {

          const text =
            await response.text();

          throw new Error(
            `Upload failed: ${response.status} ${text}`
          );

        }


        showToast(
          "File uploaded successfully."
        );


        existingForm.reset();


        /*
          Newest report will appear on page 1.
        */

        currentReportPage =
          1;


        await loadReports(
          1
        );


        await loadUserStatus();


      } catch (error) {

        console.error(
          "❌ Upload error:",
          error
        );


        showToast(
          "Upload failed."
        );

      }

    }
  );


  /* ==================================================
     APPLY CREDIT LOCK AFTER FORM IS INITIALIZED
  ================================================== */

  updateUploadLock();

}


/* ======================================================
   AUTO REFRESH
====================================================== */

function startAutoRefresh() {

  if (
    autoRefreshInterval
  ) {

    clearInterval(
      autoRefreshInterval
    );

  }


  autoRefreshInterval =
    setInterval(
      async () => {

        try {

          /*
            First request current page silently.
          */

          const response =
            await authFetch(
              `/api/reports?page=${currentReportPage}&limit=${REPORTS_PER_PAGE}`
            );


          if (!response.ok) {
            return;
          }


          const data =
            await response.json();


          if (
            !data ||
            !Array.isArray(
              data.reports
            )
          ) {

            return;

          }


          totalReportCount =
            Number(
              data.total
            ) || 0;


          totalReportPages =
            Math.max(
              1,
              Number(
                data.totalPages
              ) || 1
            );


          /*
            If current page disappeared after
            deletion, move back.
          */

          if (
            currentReportPage >
            totalReportPages
          ) {

            currentReportPage =
              totalReportPages;


            await loadReports(
              currentReportPage
            );

            return;

          }


          /* ==================================================
             CHECK FOR NEWLY COMPLETED REPORTS
             
             This compares the latest report status with
             the status stored by the notification tracker.

             It will play the sound only when a report changes
             from pending/processing → completed.
          ================================================== */

          checkForNewCompletedReports(
            data.reports
          );


          /* ==================================================
             UPDATE CURRENT REPORTS
          ================================================== */

          currentReports =
            data.reports;


          renderReports(
            currentReports
          );


          /* ==================================================
             UPDATE PAGINATION
          ================================================== */

          renderPagination();


          /* ==================================================
             UPDATE 24-HOUR COUNTDOWN
          ================================================== */

          updateReportExpiryTimers();


        } catch (error) {

          console.warn(
            "⚠️ Auto refresh failed:",
            error.message
          );

        }

      },

      3000
    );

}


/* ======================================================
   AUTH STATE
====================================================== */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.href =
        "/login.html";

      return;

    }


    console.log(
      "✅ Firebase user:",
      user.email
    );


    try {

      await getFirebaseToken(
        true
      );


      await loadUserStatus();


      await loadReports(
        1
      );


      initializeUpload();


      startAutoRefresh();


    } catch (error) {

      console.error(
        "❌ Dashboard initialization error:",
        error
      );

    }

  }
);


/* ======================================================
   GLOBAL FUNCTIONS
====================================================== */

window.loadReports =
  loadReports;

window.goToReportPage =
  goToReportPage;

window.renderPagination =
  renderPagination;


/* ======================================================
   CLEANUP
====================================================== */

window.addEventListener(
  "beforeunload",
  () => {

    if (
      autoRefreshInterval
    ) {

      clearInterval(
        autoRefreshInterval
      );

    }


    if (
      reportExpiryInterval
    ) {

      clearInterval(
        reportExpiryInterval
      );

    }

  }
);
