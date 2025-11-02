document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);

    const rangeButtons = {
        week: $('range-week'),
        month: $('range-month'),
        year: $('range-year'),
        all: $('range-all'),
    };

    const statsElements = {
        totalPlays: $('stats-total-plays'),
        totalHours: $('stats-total-hours'),
        uniqueSongs: $('stats-unique-songs'),
        completionRate: $('stats-completion-rate'),
        topSongsList: $('top-songs-list'),
    };

    // Static chart options, defined once
    const CHART_OPTIONS = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                ticks: { color: 'var(--text-muted)', precision: 0 },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
                ticks: { color: 'var(--text-muted)' },
                grid: { display: false }
            }
        },
        plugins: {
            legend: {
                labels: { color: 'var(--text-color)' }
            },
            tooltip: {
                bodyColor: 'var(--text-color)',
                titleColor: 'var(--text-muted)',
                backgroundColor: 'var(--card-color)',
            }
        }
    };

    const ctx = $('daily-stats-chart').getContext('2d');
    let dailyChart = null;
    let currentTotals = { totalPlays: 0, uniqueSongs: 0 };
    let currentRange = 'week';


    async function fetchStats(range = 'week') {
        try {
            // Inlined cache-buster
            const response = await fetch(`/api/analytics/stats?range=${range}&_=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            updateUI(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            statsElements.totalPlays.textContent = 'Error';
            statsElements.topSongsList.innerHTML = '<li>Error loading data.</li>';
        }
    }


    // analytics.js

    function updateUI(data) {
        statsElements.totalPlays.textContent = data.totalPlays || 0;
        statsElements.totalHours.textContent = data.totalHours || 0;
        statsElements.uniqueSongs.textContent = data.uniqueSongs || 0;
        statsElements.completionRate.textContent = `${parseFloat(data.completionRate) || 0}%`;

        // Store totals for the 'all' chart
        currentTotals.totalPlays = data.totalPlays || 0;
        currentTotals.uniqueSongs = data.uniqueSongs || 0;

        statsElements.topSongsList.innerHTML = '';
        if (data.topSongs && data.topSongs.length > 0) {
            data.topSongs.forEach(song => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${song.name || 'Unknown Song'}</strong> (${song.plays} plays)`;
                statsElements.topSongsList.appendChild(li);
            });
        } else {
            statsElements.topSongsList.innerHTML = '<li>No song data available.</li>';
        }

        // data.dailyStats will be EMPTY if range is 'all'
        renderChart(data.dailyStats);
    }

    // analytics.js

    function renderChart(dailyData) {
        if (dailyChart) {
            dailyChart.destroy();
        }

        // Request 1: Handle "all time" range
        if (currentRange === 'all') {
            // Render the special two-bar chart
            dailyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Total Plays', 'Unique Songs'],
                    datasets: [
                        {
                            label: 'All Time Stats',
                            data: [currentTotals.totalPlays, currentTotals.uniqueSongs],
                            backgroundColor: [
                                'rgba(29, 185, 84, 0.7)', // Green
                                'rgba(255, 255, 255, 0.7)' // White
                            ],
                            borderColor: [
                                'rgba(29, 185, 84, 1)',
                                'rgba(255, 255, 255, 1)'
                            ],
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    ...CHART_OPTIONS, // Use the same base options
                    scales: { // Override scales
                        ...CHART_OPTIONS.scales,
                        x: { // No time-based axis
                            ticks: { color: 'var(--text-muted)' },
                            grid: { display: false }
                        }
                    },
                    plugins: { // Override plugins
                        ...CHART_OPTIONS.plugins,
                        legend: {
                            display: false // Hide legend, it's redundant
                        }
                    }
                }
            });

        } else {
            // Render the normal time-series chart for 'week', 'month', 'year'
            dailyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dailyData.map(d => d.date), // Formatted by backend
                    datasets: [
                        {
                            label: 'Total Plays',
                            data: dailyData.map(d => d.plays),
                            backgroundColor: 'rgba(29, 185, 84, 0.7)',
                            borderColor: 'rgba(29, 185, 84, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Unique Songs',
                            data: dailyData.map(d => d.uniqueSongs),
                            backgroundColor: 'rgba(255, 255, 255, 0.7)',
                            borderColor: 'rgba(255, 255, 255, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: CHART_OPTIONS // Use the standard options
            });
        }
    }
    function setActiveButton(range) {
        currentRange = range;
        Object.values(rangeButtons).forEach(btn => btn.classList.remove('active'));
        if (rangeButtons[range]) {
            rangeButtons[range].classList.add('active');
        }
    }
    Object.entries(rangeButtons).forEach(([range, button]) => {
        button.addEventListener('click', () => {
            fetchStats(range);
            setActiveButton(range);
        });
    });
    const eventSource = new EventSource('/api/analytics/events');
    eventSource.addEventListener('update', () => fetchStats(currentRange));
    fetchStats('week');
    setActiveButton('week');
});