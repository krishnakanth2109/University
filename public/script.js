document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const countrySelect = document.getElementById('country-select');
    const universityNameInput = document.getElementById('university-name');
    const searchBtn = document.getElementById('search-btn');
    const universityList = document.getElementById('university-list');
    const resultsCount = document.getElementById('results-count');
    const loadingSpinner = document.getElementById('loading-spinner');
    const noResults = document.getElementById('no-results');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');
    const exportCsvBtn = document.getElementById('export-csv');
    const pagination = document.getElementById('pagination');
    const modal = document.getElementById('university-modal');
    const closeModal = document.querySelector('.close-modal');
    
    // App State
    let currentUniversities = [];
    let currentPage = 1;
    const universitiesPerPage = 12;
    let allCountries = [];
    
    // Initialize the app
    init();
    
    function init() {
        loadCountries();
        setupEventListeners();
    }
    
    function setupEventListeners() {
        searchBtn.addEventListener('click', handleSearch);
        retryBtn.addEventListener('click', handleSearch);
        exportCsvBtn.addEventListener('click', exportToCsv);
        closeModal.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // Load countries for the dropdown
    async function loadCountries() {
        try {
            showLoading(true);
            const response = await fetch('/api/countries');
            const data = await response.json();
            
            if (data.status === 'success') {
                allCountries = data.data;
                populateCountryDropdown();
            } else {
                throw new Error('Failed to load countries');
            }
        } catch (error) {
            console.error('Error loading countries:', error);
            showError('Failed to load countries. Please try again later.');
        } finally {
            showLoading(false);
        }
    }
    
    function populateCountryDropdown() {
        countrySelect.innerHTML = '<option value="" disabled selected>Choose a country...</option>';
        
        allCountries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
    }
    
    // Handle search button click
    async function handleSearch() {
        const country = countrySelect.value;
        const name = universityNameInput.value.trim();
        
        if (!country) {
            alert('Please select a country');
            return;
        }
        
        try {
            showLoading(true);
            hideMessages();
            
            const url = `/api/universities?country=${encodeURIComponent(country)}${name ? `&name=${encodeURIComponent(name)}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === 'success') {
                currentUniversities = data.data;
                currentPage = 1;
                updateResultsCount(currentUniversities.length);
                renderUniversities();
                renderPagination();
                exportCsvBtn.disabled = currentUniversities.length === 0;
            } else {
                throw new Error(data.message || 'Failed to fetch universities');
            }
        } catch (error) {
            console.error('Search error:', error);
            showError('Failed to fetch universities. Please try again.');
        } finally {
            showLoading(false);
        }
    }
    
    // Render universities to the page
    function renderUniversities() {
        if (currentUniversities.length === 0) {
            showNoResults();
            return;
        }
        
        // Calculate pagination
        const startIndex = (currentPage - 1) * universitiesPerPage;
        const endIndex = startIndex + universitiesPerPage;
        const paginatedUniversities = currentUniversities.slice(startIndex, endIndex);
        
        universityList.innerHTML = '';
        
        paginatedUniversities.forEach(university => {
            const card = createUniversityCard(university);
            universityList.appendChild(card);
        });
    }
    
    // Create a university card element
    function createUniversityCard(university) {
        const card = document.createElement('div');
        card.className = 'university-card';
        
        const header = document.createElement('div');
        header.className = 'university-card-header';
        header.innerHTML = `<h3 class="university-card-title">${university.name}</h3>`;
        
        const body = document.createElement('div');
        body.className = 'university-card-body';
        
        const country = document.createElement('div');
        country.className = 'university-card-country';
        country.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${university.country} (${university.alphaTwoCode})`;
        
        const state = document.createElement('p');
        state.className = 'university-card-state';
        state.textContent = university.stateProvince ? `State/Province: ${university.stateProvince}` : '';
        
        const domains = document.createElement('p');
        domains.className = 'university-card-domains';
        domains.textContent = `Domains: ${university.domains.join(', ')}`;
        
        const websites = document.createElement('div');
        websites.className = 'university-card-websites';
        if (university.webPages && university.webPages.length > 0) {
            websites.innerHTML = `<p><strong>Website:</strong> <a href="${university.webPages[0]}" target="_blank" class="university-card-website">${university.webPages[0]}</a></p>`;
        }
        
        const detailsBtn = document.createElement('button');
        detailsBtn.className = 'university-card-details-btn';
        detailsBtn.textContent = 'View Details';
        detailsBtn.addEventListener('click', () => showUniversityDetails(university));
        
        body.appendChild(country);
        if (university.stateProvince) body.appendChild(state);
        body.appendChild(domains);
        body.appendChild(websites);
        body.appendChild(detailsBtn);
        
        card.appendChild(header);
        card.appendChild(body);
        
        return card;
    }
    
    // Show university details in modal
    function showUniversityDetails(university) {
        document.getElementById('modal-university-name').textContent = university.name;
        document.getElementById('modal-country').textContent = university.country;
        document.getElementById('modal-country-code').textContent = university.alphaTwoCode;
        document.getElementById('modal-state').textContent = university.stateProvince || 'N/A';
        
        const domainsList = document.getElementById('modal-domains');
        domainsList.innerHTML = '';
        university.domains.forEach(domain => {
            const li = document.createElement('li');
            li.textContent = domain;
            domainsList.appendChild(li);
        });
        
        const websitesList = document.getElementById('modal-websites');
        websitesList.innerHTML = '';
        if (university.webPages && university.webPages.length > 0) {
            university.webPages.forEach(webPage => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = webPage;
                a.target = '_blank';
                a.textContent = webPage;
                li.appendChild(a);
                websitesList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'N/A';
            websitesList.appendChild(li);
        }
        
        modal.style.display = 'block';
    }
    
    // Render pagination controls
    function renderPagination() {
        if (currentUniversities.length <= universitiesPerPage) {
            pagination.innerHTML = '';
            return;
        }
        
        const pageCount = Math.ceil(currentUniversities.length / universitiesPerPage);
        pagination.innerHTML = '';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-secondary';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderUniversities();
                renderPagination();
            }
        });
        pagination.appendChild(prevBtn);
        
        // Page buttons
        for (let i = 1; i <= pageCount; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                renderUniversities();
                renderPagination();
            });
            pagination.appendChild(pageBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-secondary';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = currentPage === pageCount;
        nextBtn.addEventListener('click', () => {
            if (currentPage < pageCount) {
                currentPage++;
                renderUniversities();
                renderPagination();
            }
        });
        pagination.appendChild(nextBtn);
    }
    
    // Update results count display
    function updateResultsCount(count) {
        resultsCount.textContent = count;
    }
    
    // Show loading spinner
    function showLoading(show) {
        if (show) {
            loadingSpinner.style.display = 'flex';
            universityList.style.display = 'none';
            hideMessages();
        } else {
            loadingSpinner.style.display = 'none';
            universityList.style.display = 'grid';
        }
    }
    
    // Show no results message
    function showNoResults() {
        noResults.style.display = 'flex';
        universityList.style.display = 'none';
    }
    
    // Show error message
    function showError(message) {
        errorMessage.style.display = 'flex';
        document.getElementById('error-text').textContent = message;
        universityList.style.display = 'none';
    }
    
    // Hide all messages
    function hideMessages() {
        noResults.style.display = 'none';
        errorMessage.style.display = 'none';
    }
    
    // Export to CSV
    function exportToCsv() {
        if (currentUniversities.length === 0) return;
        
        const headers = ['Name', 'Country', 'Country Code', 'State/Province', 'Domains', 'Websites'];
        const rows = currentUniversities.map(university => {
            return [
                `"${university.name.replace(/"/g, '""')}"`,
                `"${university.country.replace(/"/g, '""')}"`,
                `"${university.alphaTwoCode}"`,
                `"${university.stateProvince || ''}"`,
                `"${university.domains.join(', ')}"`,
                `"${university.webPages ? university.webPages.join(', ') : ''}"`
            ].join(',');
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `universities_${countrySelect.value}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (document.activeElement === countrySelect || document.activeElement === universityNameInput)) {
            handleSearch();
        }
        
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
});