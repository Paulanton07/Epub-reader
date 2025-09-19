// Import Tauri API functions with error handling
let invoke, open;

function initTauriAPI() {
    try {
        if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
            // Tauri v2 API structure
            invoke = window.__TAURI__.core.invoke;
            open = window.__TAURI__.dialog ? window.__TAURI__.dialog.open : null;
            console.log('✅ Tauri v2 API loaded successfully');
            return true;
        } else if (window.__TAURI__ && window.__TAURI__.tauri && window.__TAURI__.tauri.invoke) {
            // Tauri v1 API structure (fallback)
            invoke = window.__TAURI__.tauri.invoke;
            open = window.__TAURI__.dialog ? window.__TAURI__.dialog.open : null;
            console.log('✅ Tauri v1 API loaded successfully');
            return true;
        } else {
            console.log('❌ Tauri API not available - running in browser mode');
            // Mock functions for browser testing
            invoke = async (command, args) => {
                console.log('Mock invoke:', command, args);
                throw new Error('Tauri API not available');
            };
            open = async (options) => {
                console.log('Mock file open:', options);
                return null;
            };
            return false;
        }
    } catch (error) {
        console.error('Error initializing Tauri API:', error);
        return false;
    }
}

// Application state
let currentDocument = null;
let currentPage = 0;
let wordsPerPage = 500;
let fontSize = 18;
let fontFamily = 'georgia';
let lineHeight = 1.6;
let theme = 'light';
let readingMode = '2d'; // '2d' or '3d'
let library = [];
let documentPages = [];
let chapters = [];
let is3DFlipping = false; // Prevent multiple 3D flips

// DOM elements
const libraryView = document.getElementById('library-view');
const readingView = document.getElementById('reading-view');
const settingsPanel = document.getElementById('settings-panel');
const searchOverlay = document.getElementById('search-overlay');
const tocPanel = document.getElementById('toc-panel');
const tocOverlay = document.getElementById('toc-overlay');
const leftContent = document.getElementById('left-content');
const rightContent = document.getElementById('right-content');
const bookTitle = document.getElementById('book-title');
const bookAuthor = document.getElementById('book-author');
const progressFill = document.getElementById('progress-fill');
const libraryGrid = document.getElementById('library-grid');
const libraryEmpty = document.getElementById('library-empty');
const chapterList = document.getElementById('chapter-list');

// Page counter elements
const currentPageNum = document.getElementById('current-page-num');
const totalPagesNum = document.getElementById('total-pages-num');
const pageDetail = document.getElementById('page-detail');
const progressPercentage = document.getElementById('progress-percentage');
const readingTime = document.getElementById('reading-time');

// Initialize the application
async function init() {
    console.log('Initializing application...');
    
    // Initialize Tauri API first
    const tauriReady = initTauriAPI();
    if (!tauriReady) {
        console.warn('Running without Tauri - some features will be limited');
    }
    
    // Test if DOM elements are available
    console.log('DOM Elements check:', {
        libraryView: !!libraryView,
        readingView: !!readingView,
        settingsPanel: !!settingsPanel,
        searchOverlay: !!searchOverlay,
        addBookBtn: !!document.getElementById('add-book-btn'),
        addFirstBookBtn: !!document.getElementById('add-first-book-btn')
    });
    
    setupEventListeners();
    
    try {
        await loadSettings();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    
    applyTheme();
    updateSettingsUI();
    
    try {
        await loadLibrary();
    } catch (error) {
        console.error('Error loading library:', error);
    }
    
    // Test button functionality
    testButtons();
    
    console.log('Application initialized successfully');
}

function testButtons() {
    console.log('Testing buttons...');
    
    // Test add book button
    const addBookBtn = document.getElementById('add-book-btn');
    if (addBookBtn) {
        console.log('Add book button found, adding test click');
        // Test direct click
        setTimeout(() => {
            console.log('Testing add book button click...');
        }, 2000);
    }
    
    // Test keyboard shortcuts
    console.log('Keyboard shortcuts available: Ctrl+O (open file), Ctrl+F (search), Ctrl+, (settings)');
}

// Event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Navigation
    const backToLibraryBtn = document.getElementById('back-to-library');
    const readingSettingsBtn = document.getElementById('reading-settings-btn');
    const librarySettingsBtn = document.getElementById('library-settings-btn');
    
    console.log('Navigation buttons:', { backToLibraryBtn, readingSettingsBtn, librarySettingsBtn });
    
    if (backToLibraryBtn) {
        backToLibraryBtn.addEventListener('click', (e) => {
            console.log('Back to library clicked');
            e.preventDefault();
            showLibraryView();
        });
    } else {
        console.log('back-to-library button not found');
    }
    
    if (readingSettingsBtn) {
        readingSettingsBtn.addEventListener('click', (e) => {
            console.log('Reading settings clicked');
            e.preventDefault();
            toggleSettings();
        });
    } else {
        console.log('reading-settings-btn button not found');
    }
    
    if (librarySettingsBtn) {
        librarySettingsBtn.addEventListener('click', (e) => {
            console.log('Library settings clicked');
            e.preventDefault();
            toggleSettings();
        });
    } else {
        console.log('library-settings-btn button not found');
    }
    
    // File operations
    const addBookBtn = document.getElementById('add-book-btn');
    const addFirstBookBtn = document.getElementById('add-first-book-btn');
    
    console.log('File operation buttons:', { addBookBtn, addFirstBookBtn });
    
    if (addBookBtn) {
        addBookBtn.addEventListener('click', (e) => {
            console.log('Add book clicked');
            e.preventDefault();
            openFileDialog();
        });
    } else {
        console.log('add-book-btn button not found');
    }
    
    if (addFirstBookBtn) {
        addFirstBookBtn.addEventListener('click', (e) => {
            console.log('Add first book clicked');
            e.preventDefault();
            openFileDialog();
        });
    } else {
        console.log('add-first-book-btn button not found');
    }
    
    // Touch areas for page turning (2D mode)
    const leftTouch = document.getElementById('left-touch');
    const rightTouch = document.getElementById('right-touch');
    
    if (leftTouch) leftTouch.addEventListener('click', previousPage);
    if (rightTouch) rightTouch.addEventListener('click', nextPage);
    
    // Touch areas for 3D book
    const leftTouch3D = document.getElementById('left-touch-3d');
    const rightTouch3D = document.getElementById('right-touch-3d');
    
    if (leftTouch3D) leftTouch3D.addEventListener('click', previousPage);
    if (rightTouch3D) rightTouch3D.addEventListener('click', nextPage);
    
    // Progress interaction (we'll need to add this functionality)
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
        progressContainer.addEventListener('click', (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = clickX / rect.width;
            const page = Math.floor(percentage * documentPages.length);
            goToPage(page);
        });
    }
    
    // Theme selection
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const selectedTheme = option.dataset.theme;
            if (selectedTheme) {
                theme = selectedTheme;
                applyTheme();
                updateThemeSelection();
                saveSettings();
            }
        });
    });
    
    // Settings
    const fontFamilySelect = document.getElementById('font-family');
    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', (e) => {
            console.log('Font family changed:', e.target.value);
            fontFamily = e.target.value;
            applyReadingSettings();
            saveSettings();
        });
    }
    
    // Font size slider
    const fontSizeSlider = document.getElementById('font-size');
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            fontSize = parseInt(e.target.value);
            const fontSizeValue = document.getElementById('font-size-value');
            if (fontSizeValue) fontSizeValue.textContent = fontSize + 'px';
            applyReadingSettings();
            saveSettings();
        });
    }
    
    const lineHeightSlider = document.getElementById('line-height');
    if (lineHeightSlider) {
        lineHeightSlider.addEventListener('input', (e) => {
            lineHeight = parseFloat(e.target.value);
            const lineHeightValue = document.getElementById('line-height-value');
            if (lineHeightValue) lineHeightValue.textContent = lineHeight.toFixed(1);
            applyReadingSettings();
            saveSettings();
        });
    }
    
    const wordsPerPageSlider = document.getElementById('words-per-page');
    if (wordsPerPageSlider) {
        wordsPerPageSlider.addEventListener('input', (e) => {
            wordsPerPage = parseInt(e.target.value);
            const wordsPerPageValue = document.getElementById('words-per-page-value');
            if (wordsPerPageValue) wordsPerPageValue.textContent = wordsPerPage;
            if (currentDocument) {
                paginateDocument(currentDocument.content);
                displayCurrentPage();
            }
            saveSettings();
        });
    }
    
    // Reading mode selection
    const readingModeSelect = document.getElementById('reading-mode');
    if (readingModeSelect) {
        readingModeSelect.addEventListener('change', (e) => {
            console.log('Reading mode changed:', e.target.value);
            setReadingMode(e.target.value);
        });
    }
    
    const closeSettingsBtn = document.getElementById('close-settings');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', (e) => {
            console.log('Close settings clicked');
            e.preventDefault();
            closeSettings();
        });
    }
    
    // Settings overlay click-to-close
    const settingsOverlay = document.getElementById('settings-overlay');
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', (e) => {
            console.log('Settings overlay clicked - closing');
            closeSettings();
        });
    }
    
    // Table of Contents
    const tocBtn = document.getElementById('toc-btn');
    if (tocBtn) {
        tocBtn.addEventListener('click', (e) => {
            console.log('TOC button clicked');
            e.preventDefault();
            toggleTOC();
        });
    }
    
    const closeTocBtn = document.getElementById('close-toc');
    if (closeTocBtn) {
        closeTocBtn.addEventListener('click', (e) => {
            console.log('Close TOC clicked');
            e.preventDefault();
            closeTOC();
        });
    }
    
    // TOC overlay click-to-close
    if (tocOverlay) {
        tocOverlay.addEventListener('click', (e) => {
            console.log('TOC overlay clicked - closing');
            closeTOC();
        });
    }
    
    // Search
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
            console.log('Search clicked');
            e.preventDefault();
            performSearch();
        });
    }
    
    const closeSearchBtn = document.getElementById('close-search');
    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', (e) => {
            console.log('Close search clicked');
            e.preventDefault();
            toggleSearch();
        });
    }
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Search enter pressed');
                performSearch();
            }
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
}

// File operations
let isOpeningFile = false;
async function openFileDialog() {
    // Prevent multiple rapid clicks
    if (isOpeningFile) {
        console.log('File dialog already opening, please wait...');
        return;
    }
    
    isOpeningFile = true;
    console.log('Opening file dialog...');
    try {
        const filePath = await open({
            multiple: false,
            filters: [
                {
                    name: 'E-books',
                    extensions: ['epub', 'pdf', 'txt']
                }
            ]
        });
        
        console.log('File selected:', filePath);
        if (filePath) {
            await openDocument(filePath);
        }
    } catch (error) {
        console.error('Error opening file:', error);
        alert('Failed to open file: ' + error);
    } finally {
        isOpeningFile = false;
    }
}

async function openDocument(filePath) {
    try {
        showLoading(true);
        const document = await invoke('open_document', { filePath });
        
        currentDocument = document;
        paginateDocument(document.content);
        displayDocument();
        addToLibrary(document);
        showReadingView();
        
        // Document is automatically saved to database in backend
        await updateLibraryUI();
        
    } catch (error) {
        console.error('Error opening document:', error);
        alert('Failed to parse document: ' + error);
    } finally {
        showLoading(false);
    }
}

// Document display
function displayDocument() {
    if (!currentDocument) return;
    
    bookTitle.textContent = currentDocument.title;
    bookAuthor.textContent = currentDocument.author || 'Unknown Author';
    
    currentPage = currentDocument.current_position || 0;
    displayCurrentPage();
    updateProgressIndicator();
    
    // Apply the current reading mode
    setReadingMode(readingMode);
}

function paginateDocument(content) {
    const words = content.trim().split(/\s+/);
    documentPages = [];
    
    for (let i = 0; i < words.length; i += wordsPerPage) {
        const pageWords = words.slice(i, i + wordsPerPage);
        const pageText = pageWords.join(' ');
        documentPages.push(formatPageContent(pageText));
    }
    
    if (documentPages.length === 0) {
        documentPages = [formatPageContent(content)];
    }
}

function formatPageContent(text) {
    // Simple paragraph formatting
    return text
        .split(/\n\s*\n/)
        .map(paragraph => `<p>${paragraph.trim()}</p>`)
        .join('');
}

function displayCurrentPage() {
    if (!documentPages.length) return;
    
    currentPage = Math.max(0, Math.min(currentPage, documentPages.length - 1));
    
    // Update dual-page layout
    if (leftContent) {
        // Show current page on left, next page on right (if exists)
        leftContent.innerHTML = documentPages[currentPage] || '';
    }
    
    if (rightContent) {
        const nextPageIndex = currentPage + 1;
        rightContent.innerHTML = nextPageIndex < documentPages.length ? documentPages[nextPageIndex] : '';
    }
    
    // Update page numbers
    const leftPageNum = document.getElementById('left-page-num');
    const rightPageNum = document.getElementById('right-page-num');
    
    if (leftPageNum) leftPageNum.textContent = (currentPage + 1).toString();
    if (rightPageNum) {
        const nextPageIndex = currentPage + 1;
        rightPageNum.textContent = nextPageIndex < documentPages.length ? (nextPageIndex + 1).toString() : '';
    }
    
    // Update all page counter elements
    updateAllPageCounters();
}

// Navigation with Animation
function nextPage() {
    if (currentPage < documentPages.length - 1) {
        animatePageTurn('next', () => {
            currentPage++;
            displayCurrentPage();
            updateProgressIndicator();
            saveReadingProgress();
        });
    }
}

function previousPage() {
    if (currentPage > 0) {
        animatePageTurn('prev', () => {
            currentPage--;
            displayCurrentPage();
            updateProgressIndicator();
            saveReadingProgress();
        });
    }
}

function goToPage(page) {
    if (page >= 0 && page < documentPages.length) {
        currentPage = page;
        displayCurrentPage();
        updateProgressIndicator();
        saveReadingProgress();
    }
}

// Page Turn Animation
function animatePageTurn(direction, callback) {
    if (readingMode === '3d') {
        animate3DPageTurn(direction, callback);
        return;
    }
    
    const book = document.getElementById('book');
    if (!book) {
        callback();
        return;
    }
    
    // Prevent multiple animations
    if (book.classList.contains('turning-left') || book.classList.contains('turning-right')) {
        return;
    }
    
    const turningClass = direction === 'next' ? 'turning-left' : 'turning-right';
    book.classList.add(turningClass);
    
    // Execute callback after animation (optimized for smooth 600ms animation)
    setTimeout(() => {
        callback();
        book.classList.remove(turningClass);
    }, 600);
}

// Enhanced 3D Book Page Turn Animation
function animate3DPageTurn(direction, callback) {
    if (is3DFlipping) {
        callback();
        return;
    }
    
    is3DFlipping = true;
    
    const pageToAnimate = direction === 'next' ? '.page-3d-right' : '.page-3d-left';
    const page = document.querySelector(pageToAnimate);
    
    if (page) {
        // Store original transform
        const isLeft = direction === 'prev';
        const originalTransform = isLeft ? 
            'translate(-320px, -50%) rotateX(10deg) rotateY(8deg)' : 
            'translate(-160px, -50%) rotateX(10deg) rotateY(-8deg)';
        
        // Create dramatic flip animation
        page.style.transition = 'transform 0.9s cubic-bezier(0.25, 0.8, 0.25, 1)';
        
        // First phase: lift the page
        const liftTransform = isLeft ? 
            'translate(-320px, -50%) rotateX(10deg) rotateY(20deg) scale(1.05)' : 
            'translate(-160px, -50%) rotateX(10deg) rotateY(-20deg) scale(1.05)';
        
        page.style.transform = liftTransform;
        
        setTimeout(() => {
            // Second phase: flip the page
            const flipTransform = isLeft ? 
                'translate(-320px, -50%) rotateX(10deg) rotateY(180deg)' : 
                'translate(-160px, -50%) rotateX(10deg) rotateY(-180deg)';
            
            page.style.transform = flipTransform;
            
            setTimeout(() => {
                callback();
                is3DFlipping = false;
                
                // Reset the page transform after content update
                setTimeout(() => {
                    const newPage = document.querySelector(pageToAnimate);
                    if (newPage) {
                        newPage.style.transition = 'transform 0.3s ease';
                        newPage.style.transform = originalTransform;
                    }
                }, 50);
            }, 500);
        }, 200);
    } else {
        callback();
        is3DFlipping = false;
    }
}

// Ensure 3D book has proper HTML structure
function ensure3DBookStructure() {
    const book3d = document.getElementById('book-3d');
    if (!book3d) return;
    
    // Check if structure is already there
    if (book3d.querySelector('.book-pages')) {
        return; // Structure already exists
    }
    
    // Recreate the 3D book structure
    book3d.innerHTML = `
        <div class="book-pages">
            <!-- Book page stack (creates 3D depth) -->
            <div class="book-page-3d" data-page="background-1">
                <div class="page-content"><!-- Background page content --></div>
            </div>
            <div class="book-page-3d" data-page="background-2">
                <div class="page-content"><!-- Background page content --></div>
            </div>
            <div class="book-page-3d" data-page="current" id="current-3d-page">
                <div class="page-content" id="current-3d-content">
                    <!-- Current page content -->
                </div>
            </div>
            <div class="book-page-3d" data-page="next-1">
                <div class="page-content"><!-- Next page preview --></div>
            </div>
            <div class="book-page-3d" data-page="next-2">
                <div class="page-content"><!-- Next page preview --></div>
            </div>
            <div class="book-page-3d" data-page="back-cover">
                <div class="page-content"><!-- Back pages --></div>
            </div>
        </div>
        
        <!-- Book spine gap -->
        <div class="book-gap"></div>
        
        <!-- Page flipping segments -->
        <div class="flip-segments" id="flip-segments">
            <div class="flip-segment segment-1" data-segment="1">
                <div class="segment-content" id="segment-1-content"><!-- Segment content --></div>
            </div>
            <div class="flip-segment segment-2" data-segment="2">
                <div class="segment-content" id="segment-2-content"><!-- Segment content --></div>
            </div>
            <div class="flip-segment segment-3" data-segment="3">
                <div class="segment-content" id="segment-3-content"><!-- Segment content --></div>
            </div>
            <div class="flip-segment segment-4" data-segment="4">
                <div class="segment-content" id="segment-4-content"><!-- Segment content --></div>
            </div>
            <div class="flip-segment segment-5" data-segment="5">
                <div class="segment-content" id="segment-5-content"><!-- Segment content --></div>
            </div>
            <div class="flip-segment segment-6" data-segment="6">
                <div class="segment-content" id="segment-6-content"><!-- Segment content --></div>
            </div>
            <div class="flip-segment segment-7" data-segment="7">
                <div class="segment-content" id="segment-7-content"><!-- Segment content --></div>
            </div>
        </div>
        
        <!-- Touch areas for 3D page turning -->
        <div class="touch-area left-touch" id="left-touch-3d"></div>
        <div class="touch-area right-touch" id="right-touch-3d"></div>
    `;
    
    // Re-attach event listeners to the new touch areas
    const leftTouch3D = document.getElementById('left-touch-3d');
    const rightTouch3D = document.getElementById('right-touch-3d');
    
    if (leftTouch3D) leftTouch3D.addEventListener('click', previousPage);
    if (rightTouch3D) rightTouch3D.addEventListener('click', nextPage);
}

// Update 3D book content with current page text
function update3DBookContent() {
    // Make sure we have the proper HTML structure first
    ensure3DBookStructure();
    
    const currentContent = document.getElementById('current-3d-content');
    if (currentContent && documentPages[currentPage]) {
        currentContent.innerHTML = formatContentFor3D(documentPages[currentPage]);
    }
    
    // Update segment contents with portions of the current page
    const pageContent = documentPages[currentPage] || '';
    const segments = splitContentIntoSegments(pageContent, 7);
    
    for (let i = 1; i <= 7; i++) {
        const segmentContent = document.getElementById(`segment-${i}-content`);
        if (segmentContent) {
            segmentContent.innerHTML = formatContentFor3D(segments[i - 1] || '');
        }
    }
}

// Format content for 3D book display (smaller text, better layout)
function formatContentFor3D(content) {
    if (!content) return '';
    
    // Remove paragraph tags and format for narrow segments
    return content
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '<br><br>')
        .substring(0, 200) + (content.length > 200 ? '...' : '');
}

// Split page content into segments for the flip animation
function splitContentIntoSegments(content, numSegments) {
    if (!content) return Array(numSegments).fill('');
    
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const segmentLength = Math.ceil(text.length / numSegments);
    const segments = [];
    
    for (let i = 0; i < numSegments; i++) {
        const start = i * segmentLength;
        const segment = text.substring(start, start + segmentLength);
        segments.push(segment);
    }
    
    return segments;
}

// Update the layered 3D book pages
function update3DBookPages() {
    const bookPages = document.querySelectorAll('.book-page-3d');
    
    bookPages.forEach((page, index) => {
        const pageData = page.dataset.page;
        const content = page.querySelector('.page-content');
        if (!content) return;
        
        switch (pageData) {
            case 'current':
                content.innerHTML = formatContentFor3D(documentPages[currentPage] || '');
                break;
            case 'next-1':
                content.innerHTML = formatContentFor3D(documentPages[currentPage + 1] || '');
                break;
            case 'next-2':
                content.innerHTML = formatContentFor3D(documentPages[currentPage + 2] || '');
                break;
            case 'background-1':
            case 'background-2':
                // Keep these as background/filler content
                content.innerHTML = '<div style="opacity: 0.3; padding: 10px; font-size: 0.7rem;">Background page content...</div>';
                break;
            case 'back-cover':
                content.innerHTML = '<div style="opacity: 0.2; padding: 10px; font-size: 0.7rem;">More pages...</div>';
                break;
        }
    });
}

// Create a simple but effective 3D book
function create3DBook() {
    const book3d = document.getElementById('book-3d');
    if (!book3d) return;
    
    const currentPageContent = documentPages[currentPage] || 'No content available';
    const nextPageContent = documentPages[currentPage + 1] || '';
    
    book3d.innerHTML = `
        <div style="
            position: relative;
            width: 700px;
            height: 450px;
            margin: 0 auto;
            perspective: 1200px;
            perspective-origin: center center;
            transform-style: preserve-3d;
        ">
            <!-- Back pages (for depth) -->
            <div style="
                position: absolute;
                width: 320px;
                height: 420px;
                background: var(--page-bg);
                border: 2px solid var(--border-color);
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%) rotateX(15deg) rotateY(-2deg);
                z-index: 1;
                box-shadow: 0 15px 30px rgba(0,0,0,0.25);
            "></div>
            
            <div style="
                position: absolute;
                width: 320px;
                height: 420px;
                background: var(--page-bg);
                border: 2px solid var(--border-color);
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%) rotateX(12deg) rotateY(-1deg);
                z-index: 2;
                box-shadow: 0 12px 25px rgba(0,0,0,0.2);
            "></div>
            
            <!-- Main left page -->
            <div class="page-3d-left" style="
                position: absolute;
                width: 320px;
                height: 420px;
                background: var(--page-bg);
                border: 2px solid var(--border-color);
                left: 50%;
                top: 50%;
                transform: translate(-320px, -50%) rotateX(10deg) rotateY(8deg);
                transform-origin: right center;
                z-index: 5;
                padding: 20px;
                font-size: 0.9rem;
                line-height: 1.5;
                overflow: hidden;
                color: var(--text-primary);
                box-shadow: 0 8px 20px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: transform 0.3s ease;
            ">
                ${currentPageContent.substring(0, 800) + (currentPageContent.length > 800 ? '...' : '')}
            </div>
            
            <!-- Main right page -->
            <div class="page-3d-right" style="
                position: absolute;
                width: 320px;
                height: 420px;
                background: var(--page-bg);
                border: 2px solid var(--border-color);
                left: 50%;
                top: 50%;
                transform: translate(-160px, -50%) rotateX(10deg) rotateY(-8deg);
                transform-origin: left center;
                z-index: 5;
                padding: 20px;
                font-size: 0.9rem;
                line-height: 1.5;
                overflow: hidden;
                color: var(--text-primary);
                box-shadow: 0 8px 20px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: transform 0.3s ease;
            ">
                ${nextPageContent ? (nextPageContent.substring(0, 800) + (nextPageContent.length > 800 ? '...' : '')) : '<div style="text-align: center; margin-top: 150px; opacity: 0.5;">End of book</div>'}
            </div>
            
            <!-- Book spine -->
            <div style="
                position: absolute;
                width: 12px;
                height: 420px;
                background: linear-gradient(to right, var(--border-color), var(--text-secondary));
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%) rotateX(10deg);
                z-index: 6;
                border-radius: 6px;
                box-shadow: 0 8px 15px rgba(0,0,0,0.4);
            "></div>
        </div>
    `;
    
    // Add click handlers for page turning
    const leftPage = book3d.querySelector('.page-3d-left');
    const rightPage = book3d.querySelector('.page-3d-right');
    
    if (leftPage) {
        leftPage.addEventListener('click', () => {
            animate3DPageTurn('prev', () => {
                previousPage();
                create3DBook(); // Refresh content
            });
        });
        
        // Add hover effects
        leftPage.addEventListener('mouseenter', () => {
            if (!is3DFlipping) {
                leftPage.style.transform = 'translate(-320px, -50%) rotateX(10deg) rotateY(12deg) scale(1.02)';
                leftPage.style.boxShadow = '0 12px 25px rgba(0,0,0,0.4)';
            }
        });
        
        leftPage.addEventListener('mouseleave', () => {
            if (!is3DFlipping) {
                leftPage.style.transform = 'translate(-320px, -50%) rotateX(10deg) rotateY(8deg)';
                leftPage.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
            }
        });
    }
    
    if (rightPage) {
        rightPage.addEventListener('click', () => {
            animate3DPageTurn('next', () => {
                nextPage();
                create3DBook(); // Refresh content
            });
        });
        
        // Add hover effects
        rightPage.addEventListener('mouseenter', () => {
            if (!is3DFlipping) {
                rightPage.style.transform = 'translate(-160px, -50%) rotateX(10deg) rotateY(-12deg) scale(1.02)';
                rightPage.style.boxShadow = '0 12px 25px rgba(0,0,0,0.4)';
            }
        });
        
        rightPage.addEventListener('mouseleave', () => {
            if (!is3DFlipping) {
                rightPage.style.transform = 'translate(-160px, -50%) rotateX(10deg) rotateY(-8deg)';
                rightPage.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
            }
        });
    }
}

// Switch between 2D and 3D reading modes
function setReadingMode(mode) {
    const readingView = document.getElementById('reading-view');
    const bookContainer = document.querySelector('.book-container');
    const book3d = document.getElementById('book-3d');
    
    if (!readingView || !bookContainer || !book3d) return;
    
    readingMode = mode;
    
    if (mode === '3d') {
        readingView.classList.add('mode-3d');
        readingView.classList.remove('mode-2d');
        bookContainer.style.display = 'none';
        book3d.style.display = 'block';
        book3d.classList.remove('hidden');
        
        // Create simple 3D book with current page content
        create3DBook();
        
        console.log('Switched to 3D book mode');
    } else {
        readingView.classList.add('mode-2d');
        readingView.classList.remove('mode-3d');
        bookContainer.style.display = 'flex';
        book3d.style.display = 'none';
        book3d.classList.add('hidden');
        
        console.log('Switched to 2D book mode');
    }
    
    // Update the settings UI
    updateReadingModeUI();
    saveSettings();
}

function updateReadingModeUI() {
    const readingModeSelect = document.getElementById('reading-mode');
    const readingModeValue = document.getElementById('reading-mode-value');
    
    if (readingModeSelect) {
        readingModeSelect.value = readingMode;
    }
    
    if (readingModeValue) {
        readingModeValue.textContent = readingMode === '3d' ? '3D Book' : '2D Book';
    }
}

function updateProgressIndicator() {
    updateAllPageCounters();
}

function updateAllPageCounters() {
    if (documentPages.length === 0) return;
    
    const currentPageDisplay = currentPage + 1;
    const totalPages = documentPages.length;
    const progress = totalPages > 1 ? (currentPage / (totalPages - 1)) * 100 : 0;
    const progressPercent = Math.round(progress);
    
    // Update header page counter
    if (currentPageNum) currentPageNum.textContent = currentPageDisplay;
    if (totalPagesNum) totalPagesNum.textContent = totalPages;
    
    // Update progress bar
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    
    // Update detailed page info in progress container
    if (pageDetail) {
        pageDetail.textContent = `Page ${currentPageDisplay} of ${totalPages}`;
    }
    
    if (progressPercentage) {
        progressPercentage.textContent = `${progressPercent}%`;
    }
    
    // Calculate and display estimated reading time
    if (readingTime && currentDocument) {
        const pagesRemaining = totalPages - currentPageDisplay;
        const estimatedMinutes = Math.max(1, Math.round(pagesRemaining * 1.5)); // ~1.5 minutes per page
        
        if (pagesRemaining === 0) {
            readingTime.textContent = 'Finished! ✨';
        } else if (pagesRemaining === 1) {
            readingTime.textContent = 'Last page!';
        } else if (estimatedMinutes < 60) {
            readingTime.textContent = `~${estimatedMinutes} min left`;
        } else {
            const hours = Math.floor(estimatedMinutes / 60);
            const mins = estimatedMinutes % 60;
            readingTime.textContent = mins > 0 ? `~${hours}h ${mins}m left` : `~${hours}h left`;
        }
    }
    
    console.log(`Page updated: ${currentPageDisplay}/${totalPages} (${progressPercent}%)`);
}

let progressSaveTimeout;
function saveReadingProgress() {
    if (!currentDocument) return;
    
    // Debounce progress saving to avoid excessive database writes
    clearTimeout(progressSaveTimeout);
    progressSaveTimeout = setTimeout(async () => {
        try {
            const position = documentPages.length > 0 ? 
                Math.floor((currentPage / documentPages.length) * currentDocument.total_pages) : 0;
            
            await invoke('update_reading_progress', {
                documentId: currentDocument.id,
                position: position
            });
            
            // Update local document object
            currentDocument.current_position = position;
            
            console.log(`Progress saved: page ${currentPage + 1}/${documentPages.length} (${position}/${currentDocument.total_pages})`);
            
        } catch (error) {
            console.error('Error saving reading progress:', error);
        }
    }, 1000); // Save after 1 second of inactivity
}

// Reading settings
function changeFontSize(delta) {
    fontSize += delta * 2;
    fontSize = Math.max(12, Math.min(fontSize, 32));
    applyReadingSettings();
    saveSettings();
}

function applyReadingSettings() {
    // Apply settings using CSS custom properties for better performance
    const root = document.documentElement;
    root.style.setProperty('--font-size', fontSize + 'px');
    root.style.setProperty('--font-family', getFontFamily(fontFamily));
    root.style.setProperty('--line-height', lineHeight);
    
    // Also apply directly to page contents for immediate effect
    const contents = [leftContent, rightContent];
    contents.forEach(content => {
        if (content) {
            content.style.fontSize = fontSize + 'px';
            content.style.fontFamily = getFontFamily(fontFamily);
            content.style.lineHeight = lineHeight;
        }
    });
}

function getFontFamily(family) {
    const families = {
        'georgia': 'Georgia, serif',
        'times': '"Times New Roman", Times, serif',
        'arial': 'Arial, sans-serif',
        'helvetica': 'Helvetica, Arial, sans-serif'
    };
    return families[family] || families.georgia;
}

// Theme management
function toggleTheme() {
    const themes = ['light', 'dark', 'sepia'];
    const currentIndex = themes.indexOf(theme);
    theme = themes[(currentIndex + 1) % themes.length];
    applyTheme();
    saveSettings();
}

function applyTheme() {
    document.body.setAttribute('data-theme', theme);
    updateThemeSelection();
}

function updateThemeSelection() {
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        if (option.dataset.theme === theme) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// UI management
function toggleSettings() {
    console.log('Toggle settings called, settingsPanel:', settingsPanel);
    if (settingsPanel) {
        const isVisible = settingsPanel.classList.contains('visible');
        const overlay = document.getElementById('settings-overlay');
        
        if (isVisible) {
            // Close settings
            settingsPanel.classList.remove('visible');
            if (overlay) overlay.classList.remove('visible');
        } else {
            // Open settings
            settingsPanel.classList.add('visible');
            if (overlay) overlay.classList.add('visible');
        }
        
        console.log('Settings panel toggled, visible?', !isVisible);
    } else {
        console.error('Settings panel not found!');
    }
}

function closeSettings() {
    const settingsPanel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');
    
    if (settingsPanel) settingsPanel.classList.remove('visible');
    if (overlay) overlay.classList.remove('visible');
}

// Table of Contents management
function toggleTOC() {
    console.log('Toggle TOC called, tocPanel:', tocPanel);
    if (tocPanel) {
        const isVisible = tocPanel.classList.contains('visible');
        
        if (isVisible) {
            // Close TOC
            closeTOC();
        } else {
            // Open TOC
            openTOC();
        }
        
        console.log('TOC panel toggled, visible?', !isVisible);
    } else {
        console.error('TOC panel not found!');
    }
}

async function openTOC() {
    if (tocPanel && tocOverlay) {
        // Show TOC immediately with loading state
        tocPanel.classList.remove('hidden');
        tocPanel.classList.add('visible');
        tocOverlay.classList.add('visible');
        
        // Show loading in chapter list
        if (chapterList) {
            chapterList.innerHTML = '<li class="chapter-item"><div class="chapter-link" style="opacity: 0.6;">📖 Loading chapters...</div></li>';
        }
        
        // Load chapters if we have a current document
        if (currentDocument) {
            await loadChapters(currentDocument.id);
        }
    }
}

function closeTOC() {
    if (tocPanel) tocPanel.classList.remove('visible');
    if (tocOverlay) tocOverlay.classList.remove('visible');
}

async function loadChapters(documentId) {
    try {
        console.log('Loading chapters for document:', documentId);
        chapters = await invoke('get_chapters', { documentId });
        console.log('Chapters loaded:', chapters);
        updateTOCUI();
    } catch (error) {
        console.error('Error loading chapters:', error);
        chapters = [];
        updateTOCUI();
    }
}

function updateTOCUI() {
    if (!chapterList) return;
    
    chapterList.innerHTML = '';
    
    if (chapters.length === 0) {
        const noChapters = document.createElement('li');
        noChapters.className = 'chapter-item';
        noChapters.innerHTML = '<div class="chapter-link" style="opacity: 0.6;">No chapters found</div>';
        chapterList.appendChild(noChapters);
        return;
    }
    
    chapters.forEach((chapter, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'chapter-item';
        
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'chapter-link';
        link.innerHTML = `
            <span class="chapter-number">${index + 1}.</span>
            <span class="chapter-title">${chapter.title}</span>
        `;
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            goToChapter(chapter);
        });
        
        listItem.appendChild(link);
        chapterList.appendChild(listItem);
    });
}

function goToChapter(chapter) {
    console.log('Going to chapter:', chapter);
    
    // Calculate which page the chapter starts on
    const wordsBeforeChapter = chapter.start_position;
    const pageNumber = Math.floor(wordsBeforeChapter / wordsPerPage);
    
    // Go to that page
    goToPage(Math.max(0, pageNumber));
    
    // Close TOC
    closeTOC();
    
    // Update current chapter in TOC
    updateCurrentChapter(chapter.id);
}

function updateCurrentChapter(chapterId) {
    const chapterLinks = document.querySelectorAll('.chapter-link');
    chapterLinks.forEach(link => {
        link.classList.remove('current');
    });
    
    // Find and highlight current chapter
    // This is a simplified approach - in a real app you'd want more sophisticated tracking
    const currentChapterIndex = chapters.findIndex(ch => ch.id === chapterId);
    if (currentChapterIndex !== -1) {
        const currentLink = chapterLinks[currentChapterIndex];
        if (currentLink) {
            currentLink.classList.add('current');
        }
    }
}

function toggleSearch() {
    console.log('Toggle search called, searchOverlay:', searchOverlay);
    if (searchOverlay) {
        searchOverlay.classList.toggle('hidden');
        if (!searchOverlay.classList.contains('hidden')) {
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.focus();
        }
    } else {
        console.error('Search overlay not found!');
    }
}

function showLibraryView() {
    console.log('Show library view called');
    if (libraryView) libraryView.classList.remove('hidden');
    if (readingView) readingView.classList.add('hidden');
    closeSettings();
    closeTOC();
    if (searchOverlay) searchOverlay.classList.add('hidden');
    console.log('Library view shown');
}

function showReadingView() {
    console.log('Show reading view called');
    if (libraryView) libraryView.classList.add('hidden');
    if (readingView) readingView.classList.remove('hidden');
    console.log('Reading view shown');
}

let loadingState = false;
function showLoading(show) {
    // Prevent redundant loading state changes
    if (loadingState === show) {
        return;
    }
    
    loadingState = show;
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        if (show) {
            loadingIndicator.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
        }
    }
    console.log('Loading:', show);
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
}

// Library management
async function loadLibrary() {
    try {
        library = await invoke('get_library');
        updateLibraryUI();
    } catch (error) {
        console.error('Error loading library:', error);
        library = [];
    }
}

function addToLibrary(document) {
    const existing = library.find(doc => doc.file_path === document.file_path);
    if (!existing) {
        library.push(document);
    }
}

async function deleteBook(bookId) {
    try {
        // Call backend to delete from database
        await invoke('delete_document', { documentId: bookId });
        
        // Remove from local library array
        library = library.filter(doc => doc.id !== bookId);
        
        // Update UI
        updateLibraryUI();
        
        console.log('Book deleted successfully:', bookId);
    } catch (error) {
        console.error('Error deleting book:', error);
        throw error;
    }
}

function updateLibraryUI() {
    if (!libraryGrid || !libraryEmpty) return;
    
    if (library.length === 0) {
        libraryGrid.style.display = 'none';
        libraryEmpty.style.display = 'flex';
    } else {
        libraryGrid.style.display = 'grid';
        libraryEmpty.style.display = 'none';
        
        libraryGrid.innerHTML = '';
        library.forEach(doc => {
            const item = createLibraryItem(doc);
            libraryGrid.appendChild(item);
        });
    }
}

function createLibraryItem(doc) {
    const item = document.createElement('div');
    item.className = 'library-item';
    
    // Add progress indicator
    const progressPercent = doc.total_pages > 0 ? (doc.current_position / doc.total_pages * 100).toFixed(1) : 0;
    
    item.innerHTML = `
        <div class="library-item-header">
            <h4>${doc.title}</h4>
            <div class="library-item-actions">
                <span class="progress-badge">${progressPercent}%</span>
                <button class="delete-book-btn" data-book-id="${doc.id}" title="Delete book">✕</button>
            </div>
        </div>
        <p class="library-item-meta">${doc.author || 'Unknown Author'} • ${doc.file_type.toUpperCase()}</p>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <p class="library-item-date">Last read: ${formatDate(doc.last_read)}</p>
    `;
    
    item.addEventListener('click', async () => {
        try {
            showLoading(true);
            // Load document content from file since database only stores metadata
            const content = await invoke('get_document_content', { filePath: doc.file_path });
            
            // Create Document object for frontend
            currentDocument = {
                id: doc.id,
                title: doc.title,
                author: doc.author,
                file_path: doc.file_path,
                file_type: doc.file_type,
                content: content,
                current_position: doc.current_position,
                total_pages: doc.total_pages
            };
            
            paginateDocument(content);
            
            // Set current page to saved position
            const pagePosition = Math.floor((doc.current_position / doc.total_pages) * documentPages.length);
            currentPage = Math.max(0, Math.min(pagePosition, documentPages.length - 1));
            
            displayDocument();
            showReadingView();
            
        } catch (error) {
            console.error('Error opening library document:', error);
            alert('Failed to load document: ' + error);
        } finally {
            showLoading(false);
        }
    });
    
    // Add delete button event listener
    const deleteBtn = item.querySelector('.delete-book-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent opening the book
            
            const confirmDelete = confirm(`Are you sure you want to delete "${doc.title}"?\n\nThis will remove the book from your library but won't delete the original file.`);
            if (confirmDelete) {
                try {
                    await deleteBook(doc.id);
                } catch (error) {
                    console.error('Error deleting book:', error);
                    alert('Failed to delete book: ' + error.message);
                }
            }
        });
    }
    
    return item;
}

// Search functionality
async function performSearch() {
    if (!currentDocument) return;
    
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    
    try {
        const results = await invoke('search_in_document', {
            documentId: currentDocument.id,
            query: query
        });
        
        console.log('Search results:', results);
        // You could implement search result highlighting here
        alert(`Found ${results.length} results for "${query}"`);
        
    } catch (error) {
        console.error('Search error:', error);
        alert('Search failed: ' + error);
    }
}

// Keyboard shortcuts
function handleKeyboard(e) {
    console.log('Key pressed:', e.key, 'Ctrl:', e.ctrlKey);
    
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'o':
                e.preventDefault();
                console.log('Ctrl+O pressed - opening file dialog');
                openFileDialog();
                break;
            case 'f':
                e.preventDefault();
                console.log('Ctrl+F pressed - opening search');
                toggleSearch();
                break;
            case ',':
                e.preventDefault();
                console.log('Ctrl+, pressed - opening settings');
                toggleSettings();
                break;
        }
    } else {
        switch (e.key) {
            case 'ArrowLeft':
            case 'PageUp':
                e.preventDefault();
                console.log('Previous page');
                previousPage();
                break;
            case 'ArrowRight':
            case 'PageDown':
            case ' ':
                e.preventDefault();
                console.log('Next page');
                nextPage();
                break;
            case 'Home':
                e.preventDefault();
                goToPage(0);
                break;
            case 'End':
                e.preventDefault();
                goToPage(documentPages.length - 1);
                break;
            case 'Escape':
                if (settingsPanel && settingsPanel.classList.contains('visible')) {
                    closeSettings();
                }
                if (searchOverlay && !searchOverlay.classList.contains('hidden')) {
                    searchOverlay.classList.add('hidden');
                }
                break;
        }
    }
}

// Settings persistence with database
async function saveSettings() {
    const settings = {
        theme: theme,
        reading_mode: readingMode,
        font_family: fontFamily,
        font_size: fontSize,
        line_height: lineHeight,
        letter_spacing: 0.0, // Not implemented in frontend yet
        words_per_page: wordsPerPage,
        page_margin: 'normal', // Not implemented in frontend yet
        justify_text: true, // Not implemented in frontend yet
        hyphenation: true, // Not implemented in frontend yet
        animation_speed: 'normal', // Not implemented in frontend yet
        page_curl: true // Not implemented in frontend yet
    };
    
    try {
        await invoke('save_user_settings', { settings });
        console.log('Settings saved to database');
    } catch (error) {
        console.error('Error saving settings to database:', error);
        // Fallback to localStorage
        const localSettings = { fontSize, fontFamily, lineHeight, theme, wordsPerPage };
        localStorage.setItem('mindful-reader-settings', JSON.stringify(localSettings));
    }
}

async function loadSettings() {
    try {
        // Try to load from database first
        const settings = await invoke('get_user_settings');
        
        fontSize = settings.font_size || fontSize;
        fontFamily = settings.font_family || fontFamily;
        lineHeight = settings.line_height || lineHeight;
        theme = settings.theme || theme;
        readingMode = settings.reading_mode || readingMode;
        wordsPerPage = settings.words_per_page || wordsPerPage;
        
        console.log('Settings loaded from database:', settings);
        
    } catch (error) {
        console.error('Error loading settings from database, trying localStorage:', error);
        
        // Fallback to localStorage
        try {
            const saved = localStorage.getItem('mindful-reader-settings');
            if (saved) {
                const localSettings = JSON.parse(saved);
                fontSize = localSettings.fontSize || fontSize;
                fontFamily = localSettings.fontFamily || fontFamily;
                lineHeight = localSettings.lineHeight || lineHeight;
                theme = localSettings.theme || theme;
                wordsPerPage = localSettings.wordsPerPage || wordsPerPage;
                
                // Migrate to database
                await saveSettings();
            }
        } catch (localError) {
            console.error('Error loading settings from localStorage:', localError);
        }
    }
    
    // Update UI elements
    updateSettingsUI();
}

function updateSettingsUI() {
    const fontFamilyEl = document.getElementById('font-family');
    const fontSizeEl = document.getElementById('font-size');
    const fontSizeValueEl = document.getElementById('font-size-value');
    const lineHeightEl = document.getElementById('line-height');
    const lineHeightValueEl = document.getElementById('line-height-value');
    const wordsPerPageEl = document.getElementById('words-per-page');
    const wordsPerPageValueEl = document.getElementById('words-per-page-value');
    
    if (fontFamilyEl) fontFamilyEl.value = fontFamily;
    if (fontSizeEl) fontSizeEl.value = fontSize;
    if (fontSizeValueEl) fontSizeValueEl.textContent = fontSize + 'px';
    if (lineHeightEl) lineHeightEl.value = lineHeight;
    if (lineHeightValueEl) lineHeightValueEl.textContent = lineHeight.toFixed(1);
    if (wordsPerPageEl) wordsPerPageEl.value = wordsPerPage;
    if (wordsPerPageValueEl) wordsPerPageValueEl.textContent = wordsPerPage;
    
    // Update reading mode UI
    updateReadingModeUI();
}

// Manual test functions for debugging (call from browser console)
window.testOpenFile = openFileDialog;
window.testSettings = toggleSettings;
window.testSearch = toggleSearch;
window.testShowReading = showReadingView;
window.testShowLibrary = showLibraryView;

// Manual Tauri API test
window.testTauriAPI = () => {
    console.log('=== TAURI API DEBUG ===');
    console.log('window.__TAURI__:', window.__TAURI__);
    console.log('Available window properties:', Object.keys(window).filter(k => k.includes('TAURI') || k.includes('tauri')));
    
    if (window.__TAURI__) {
        console.log('window.__TAURI__.tauri:', window.__TAURI__.tauri);
        console.log('window.__TAURI__.dialog:', window.__TAURI__.dialog);
        console.log('window.__TAURI__.app:', window.__TAURI__.app);
        
        // Try to invoke a simple command
        if (window.__TAURI__.tauri) {
            console.log('Trying simple invoke...');
            window.__TAURI__.tauri.invoke('get_library')
                .then(result => console.log('Invoke success:', result))
                .catch(err => console.log('Invoke error:', err));
        }
    } else {
        console.log('Tauri API not found!');
        console.log('Current URL:', window.location.href);
        console.log('User Agent:', navigator.userAgent);
    }
    console.log('=====================');
};

// Force reinit function
window.forceReinitTauri = async () => {
    console.log('Force reinitializing Tauri...');
    await waitForTauri();
    initTauriAPI();
    console.log('Reinitialization complete');
};

// Wait for both DOM and Tauri to be ready
async function waitForTauri(maxRetries = 50, delay = 200) {
    for (let i = 0; i < maxRetries; i++) {
        if (window.__TAURI__ && window.__TAURI__.tauri && window.__TAURI__.dialog) {
            console.log('Tauri API ready after', i, 'attempts');
            return true;
        }
        console.log(`Waiting for Tauri API... attempt ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    console.warn('Tauri API not available after', maxRetries, 'attempts - running in browser mode');
    return false;
}

async function startApp() {
    console.log('Starting application...');
    
    // Initialize the app directly - Tauri API is already checked in initTauriAPI
    await init();
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// Tauri API is initialized immediately - no need for window load backup
