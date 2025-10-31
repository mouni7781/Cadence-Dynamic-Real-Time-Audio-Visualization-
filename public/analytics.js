/* All the dashboard logic from analytics.html now lives here. */
document.addEventListener('DOMContentLoaded', () => {

    const rangeButtons = {
        week: document.getElementById('range-week'),
        month: document.getElementById('range-month'),
        year: document.getElementById('range-year'),
        all: document.getElementById('range-all'),
    };

    const statsElements = {
        totalPlays: document.getElementById('stats-total-plays'),
        totalHours: document.getElementById('stats-total-hours'),
        uniqueSongs: document.getElementById('stats-unique-songs'),
        completionRate: document.getElementById('stats-completion-rate'),
        topSongsList: document.getElementById('top-songs-list'),
    };

    const ctx = document.getElementById('daily-stats-chart').getContext('2d');
    let dailyChart = null;
    let currentRange = 'week';

    /**
     * Fetches stats from the API for a given range.
     */
    async function fetchStats(range = 'week') {
        try {
            const cacheBust = new Date().getTime();
            const response = await fetch(`/api/analytics/stats?range=${range}&_=${cacheBust}`);

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

    /**
     * Updates the dashboard UI with new data.
     */
    function updateUI(data) {
        statsElements.totalPlays.textContent = data.totalPlays || 0;
        statsElements.totalHours.textContent = data.totalHours || 0;
        statsElements.uniqueSongs.textContent = data.uniqueSongs || 0;

        const completionRate = parseFloat(data.completionRate);
        statsElements.completionRate.textContent = isNaN(completionRate) ? '0%' : `${completionRate}%`;

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

        renderChart(data.dailyStats);
    }

    /**
     * Renders the daily stats bar chart.
     */
    function renderChart(dailyData) {
        if (dailyChart) {
            dailyChart.destroy();
        }

        if (!dailyData || dailyData.length === 0) {
            return;
        }

        const labels = dailyData.map(d => d.date);
        const playsData = dailyData.map(d => d.plays);
        const uniqueSongsData = dailyData.map(d => d.uniqueSongs);

        dailyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Plays',
                        data: playsData,
                        backgroundColor: 'rgba(29, 185, 84, 0.7)', // accent-color
                        borderColor: 'rgba(29, 185, 84, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Unique Songs',
                        data: uniqueSongsData,
                        backgroundColor: 'rgba(255, 255, 255, 0.7)', // text-color
                        borderColor: 'rgba(255, 255, 255, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'var(--text-muted)',
                            precision: 0
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'var(--text-muted)'
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'var(--text-color)'
                        }
                    },
                    tooltip: {
                        bodyColor: 'var(--text-color)',
                        titleColor: 'var(--text-muted)',
                        backgroundColor: 'var(--card-color)',
                    }
                }
            }
        });
    }

    /**
     * Sets the 'active' class on the correct range button.
     */
    function setActiveButton(range) {
        currentRange = range;
        Object.values(rangeButtons).forEach(btn => btn.classList.remove('active'));
        if (rangeButtons[range]) {
            rangeButtons[range].classList.add('active');
        }
    }

    // --- Add event listeners to buttons ---
    Object.entries(rangeButtons).forEach(([range, button]) => {
        button.addEventListener('click', () => {
            fetchStats(range);
            setActiveButton(range);
        });
    });

    // --- Connect to the real-time update server ---
    const eventSource = new EventSource('/api/analytics/events');
    eventSource.addEventListener('update', (event) => {
        // When a message comes in, just refetch the stats
        fetchStats(currentRange);
    });

    // --- Initial load ---
    fetchStats('week');
    setActiveButton('week');
});