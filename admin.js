document.addEventListener('DOMContentLoaded', function() {
    let currentMonitoredAttendanceData = [];

    const dateInputForCreateSession = document.getElementById('date');
    if (dateInputForCreateSession) {
        if (dateInputForCreateSession.type === 'date') {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            
            dateInputForCreateSession.value = `${year}-${month}-${day}`;
            dateInputForCreateSession.readOnly = true; 
            dateInputForCreateSession.title = "Date is automatically set to today's date and cannot be changed here.";
        } else {
            console.warn("Element with ID 'date' found, but it is not of type 'date'. Automatic date population skipped.");
        }
    }

    function fetchData(endpoint, listElementId, itemHtmlGenerator, afterFetchCallback) {
        const list = document.getElementById(listElementId);
        if (!list) {
             console.warn(`List element with ID "${listElementId}" not found. Skipping population.`);
             return;
        }
        list.innerHTML = '<li>Loading...</li>';

        fetch(endpoint)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status} fetching ${endpoint}`);
                }
                return response.json();
            })
            .then(data => {
                list.innerHTML = '';
                if (data.length === 0) {
                    list.innerHTML = `<li>No ${listElementId.replace('-list','').toLowerCase()} found.</li>`;
                    if (list.tagName === 'SELECT') {
                         const defaultOption = document.createElement('option');
                         defaultOption.value = "";
                         defaultOption.textContent = `-- No ${listElementId.replace('_id','').replace('-list','').toLowerCase()} available --`;
                         defaultOption.disabled = true;
                         defaultOption.selected = true;
                         list.appendChild(defaultOption);
                         list.disabled = true;
                    }
                    if (afterFetchCallback) {
                         afterFetchCallback([]);
                    }
                    return;
                }

                if (list.tagName === 'SELECT') {
                     list.innerHTML = '';
                     const defaultOption = document.createElement('option');
                     defaultOption.value = "";
                     defaultOption.textContent = `-- Select ${listElementId.replace('_id','').replace('-list','').toLowerCase()} --`;
                     list.appendChild(defaultOption);
                     data.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = itemHtmlGenerator(item);
                        list.appendChild(option);
                    });
                    list.disabled = false;
                } else {
                    data.forEach(item => {
                        const listItemHtml = itemHtmlGenerator(item);
                        list.insertAdjacentHTML('beforeend', listItemHtml);
                    });
                }

                if (afterFetchCallback) {
                    afterFetchCallback(data);
                }
            })
            .catch(error => {
                console.error(`Error fetching ${endpoint}:`, error);
                if (list.tagName === 'SELECT') {
                     list.innerHTML = '<option value="">Error loading data</option>';
                     list.disabled = true;
                } else {
                    list.innerHTML = `<li>Error loading data: ${error.message}.</li>`;
                }
            });
    }

     function createClassOptionText(c) {
        return `${c.class_code} - ${c.class_name}`;
     }

    function createSessionListItem(s) {
        const enrolledCount = s.enrolled_count || 0;
        const attendedCount = s.attended_count || 0;
        const attendancePercentage = enrolledCount > 0 ? Math.round((attendedCount / enrolledCount) * 100) : 0;
        
        return `
            <li class="session-item">
                <span>
                    ID: ${s.id},
                    Class: ${s.class_code},
                    Date: ${s.date},
                    Semester: ${s.semester}
                    <br>
                    <small>Attendance: ${attendedCount}/${enrolledCount} (${attendancePercentage}%)</small>
                </span>
                <span class="session-controls">
                        <button class="show-qr-btn" data-session-id="${s.id}">Show QR</button>
                        <button class="send-notifications-btn" data-session-id="${s.id}" title="Send email notifications to absentees">
                        📧 Notify Absentees
                        </button>
                    <button class="geo-settings-btn" data-session-id="${s.id}" title="Configure geolocation settings">
                        🌍 Geo Settings
                    </button>
                    <button class="device-logs-btn" data-session-id="${s.id}" title="View device access logs">
                        📱 Device Logs
                    </button>
                    <button class="finalize-btn" data-session-id="${s.id}">
                        Stop Session
                    </button>
                </span>
            </li>
        `;
    }

     function createMonitorSessionOptionText(s) {
         return `ID: ${s.id} - ${s.class_code} on ${s.date} ${s.is_finalized ? '(Finalized)' : ''}`;
     }

    fetchData('/admin/classes', 'class_id', createClassOptionText);
    fetchData('/admin/sessions', 'session-list', createSessionListItem);
    fetchData('/admin/sessions', 'monitor_session_id', createMonitorSessionOptionText, populateMonitorSessionSelect);

    function populateMonitorSessionSelect(sessions) {
        sessions.sort((a, b) => {
             const dateA = new Date(a.date);
             const dateB = new Date(b.date);
             if (dateA < dateB) return 1;
             if (dateA > dateB) return -1;
             if (a.start_time && b.start_time) {
                 if (a.start_time < b.start_time) return 1;
                 if (a.start_time > b.start_time) return -1;
             }
             if (a.class_code < b.class_code) return -1;
             if (a.class_code > b.class_code) return 1;
             return 0;
        });
    }

    const createSessionForm = document.getElementById('create-session-form');

    if (createSessionForm) {
        createSessionForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const classId = document.getElementById('class_id').value;
            const date = document.getElementById('date').value;
            const semester = document.getElementById('semester').value;
            const enableGeoLocation = document.getElementById('enable_geolocation').checked;
            const geoLatitude = document.getElementById('geo_latitude').value;
            const geoLongitude = document.getElementById('geo_longitude').value;
            const geoRadius = document.getElementById('geo_radius').value;

            if (!classId || !date || !semester) {
                alert('Please fill in all required fields.');
                return;
            }

            if (enableGeoLocation) {
                if (!geoLatitude || !geoLongitude || !geoRadius) {
                    alert('Please provide latitude, longitude, and radius for geolocation restriction.');
                    return;
                }
                if (isNaN(geoLatitude) || isNaN(geoLongitude) || isNaN(geoRadius)) {
                    alert('Latitude, longitude, and radius must be valid numbers.');
                    return;
                }
                if (geoRadius <= 0) {
                    alert('Radius must be greater than 0.');
                    return;
                }
            }

            const sessionData = {
                class_id: parseInt(classId),
                date: date,
                semester: semester,
                enable_geolocation: enableGeoLocation,
                geo_latitude: enableGeoLocation ? parseFloat(geoLatitude) : null,
                geo_longitude: enableGeoLocation ? parseFloat(geoLongitude) : null,
                geo_radius: enableGeoLocation ? parseInt(geoRadius) : null // Ensure integer for radius
            };

            fetch('/admin/create_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert(data.message + ` Session ID: ${data.session_id}`);
                    const qrDisplay = document.getElementById('session-qr-display');
                    const qrImg = document.getElementById('session-qr-img');
                    const qrInfo = document.getElementById('qr-session-info');
                    const displaySessionId = document.getElementById('display-session-id');
                    const qrCountdown = document.getElementById('qr-countdown');
                    
                    if(qrDisplay && qrImg && qrInfo && displaySessionId && qrCountdown) {
                        displaySessionId.textContent = data.session_id;
                        qrInfo.textContent = `${data.session.class_code} - ${data.session.date} - ${data.session.semester}`;
                        qrDisplay.style.display = 'block';
                        
                        qrImg.src = `/admin/generate_qr_image?data=${encodeURIComponent(data.qr_data)}`;
                        qrCountdown.style.display = 'none'; // Ensure countdown is hidden for static QR
                    }
                    fetchData('/admin/sessions', 'session-list', createSessionListItem);
                    fetchData('/admin/sessions', 'monitor_session_id', createMonitorSessionOptionText, populateMonitorSessionSelect);
                    
                    createSessionForm.reset();
                    dateInputForCreateSession.value = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
                    toggleGeolocationFields(); // Reset geo fields visibility
                } else {
                    alert('Error creating session: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error creating session:', error);
                alert('An error occurred while creating session.');
            });
        });
    }

    // Function to start Static QR Code display (No dynamic refreshing)
    function startStaticQrCode(sessionId, qrImgElement, qrCountdownElement) {
        fetch(`/admin/get_static_qr_data/${sessionId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to get QR data: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    qrImgElement.src = `/admin/generate_qr_image?data=${encodeURIComponent(data.qr_data)}`;
                    qrCountdownElement.style.display = 'none'; // Hide countdown as QR is static
                } else {
                    qrImgElement.alt = "Error generating QR";
                    qrImgElement.src = ""; // Clear image
                    qrCountdownElement.textContent = `Error: ${data.message}`;
                    console.error('Backend reported error getting QR data:', data.message);
                }
            })
            .catch(error => {
                qrImgElement.alt = "Error generating QR";
                qrImgElement.src = ""; // Clear image
                qrCountdownElement.textContent = `Network Error: ${error.message}`;
                console.error('Error fetching QR data:', error);
            });
    }

    const geoLocationCheckbox = document.getElementById('enable_geolocation');
    if (geoLocationCheckbox) {
        geoLocationCheckbox.addEventListener('change', toggleGeolocationFields);
        toggleGeolocationFields(); // Call on load to set initial state
    }

    function toggleGeolocationFields() {
        const geoFieldsDiv = document.getElementById('geo-fields');
        const isEnabled = document.getElementById('enable_geolocation').checked;
        
        if (geoFieldsDiv) {
            geoFieldsDiv.style.display = isEnabled ? 'block' : 'none';
            
            if (!isEnabled) {
                document.getElementById('geo_latitude').value = '';
                document.getElementById('geo_longitude').value = '';
                document.getElementById('geo_radius').value = '';
            }
        }
    }

    const getCurrentLocationBtn = document.getElementById('get-current-location');
    if (getCurrentLocationBtn) {
        getCurrentLocationBtn.addEventListener('click', function() {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by this browser.');
                return;
            }

            this.disabled = true;
            this.textContent = 'Getting location...';
            const statusMessage = document.getElementById('location-status-message');
            if (statusMessage) statusMessage.textContent = 'Attempting to get high-accuracy location...';

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const accuracy = position.coords.accuracy;
                    const latitude = position.coords.latitude.toFixed(6);
                    const longitude = position.coords.longitude.toFixed(6);
                    const ACCURACY_THRESHOLD_METERS = 100; // Define an acceptable accuracy threshold

                    if (accuracy <= ACCURACY_THRESHOLD_METERS) {
                        document.getElementById('geo_latitude').value = latitude;
                        document.getElementById('geo_longitude').value = longitude;
                        if (statusMessage) statusMessage.textContent = `Location captured with accuracy: ±${Math.round(accuracy)}m.`;
                        alert(`Location captured successfully! Accuracy: ±${Math.round(accuracy)}m.`);
                    } else {
                        if (statusMessage) statusMessage.textContent = `Location accuracy too low: ±${Math.round(accuracy)}m. Please try again in a better location or wait for a more accurate fix.`;
                        alert(`Location accuracy too low (±${Math.round(accuracy)}m). For best results, accuracy should be within ${ACCURACY_THRESHOLD_METERS}m. Please try again.`);
                    }
                    this.disabled = false;
                    this.textContent = 'Get Current Location';
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    let errorMessage = 'Unable to get your location. '; 
                    if (error.code === error.PERMISSION_DENIED) {
                        errorMessage += 'Please enable location services and grant permission to this site.';
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        errorMessage += 'Location information is unavailable.';
                    } else if (error.code === error.TIMEOUT) {
                        errorMessage += 'The request to get user location timed out. Try again.';
                    }
                    if (statusMessage) statusMessage.textContent = `Error: ${errorMessage}`; 
                    alert(errorMessage);
                    this.disabled = false;
                    this.textContent = 'Get Current Location';
                },
                {
                    enableHighAccuracy: true,
                    timeout: 30000, // Increased timeout for better chance of high accuracy
                    maximumAge: 0
                }
            );
        });
    }

    const sessionListUL = document.getElementById('session-list');
     if (sessionListUL) {
         sessionListUL.addEventListener('click', function(event) {
             const target = event.target;
             const sessionId = target.dataset.sessionId;

             if (target.classList.contains('finalize-btn')) {
                 handleStopSession(sessionId, target);
             } else if (target.classList.contains('send-notifications-btn')) {
                 handleSendNotifications(sessionId, target);
             } else if (target.classList.contains('geo-settings-btn')) {
                 handleGeoSettings(sessionId);
             } else if (target.classList.contains('device-logs-btn')) {
                 handleDeviceLogs(sessionId);
             } else if (target.classList.contains('show-qr-btn')) {
                 handleShowQr(sessionId);
             }
         });
     } else {
         console.error("Session list element ('session-list') not found. Cannot attach button listeners.");
     }

    function handleShowQr(sessionId) {
        const qrDisplay = document.getElementById('session-qr-display');
        const qrImg = document.getElementById('session-qr-img');
        const qrInfo = document.getElementById('qr-session-info');
        const displaySessionId = document.getElementById('display-session-id');
        const qrCountdown = document.getElementById('qr-countdown');

        if(qrDisplay && qrImg && qrInfo && displaySessionId && qrCountdown) {
            displaySessionId.textContent = sessionId;
            qrInfo.textContent = `Loading session details...`; 
            qrDisplay.style.display = 'block';
            startStaticQrCode(sessionId, qrImg, qrCountdown); // Call the static QR generator
        } else {
            alert('Required QR display elements not found.');
            console.error('Missing QR display elements.');
        }
    }


    function handleStopSession(sessionId, buttonElement) {
        console.log(`Stop Session button clicked for Session ID: ${sessionId}. This will attempt to delete the session.`);

        if (buttonElement.disabled) {
            console.log(`Session ${sessionId} stop/delete button is already disabled.`);
            return;
        }
        
        if (confirm(`Are you sure you want to DELETE Session ID ${sessionId}? This will permanently remove the session and all its attendance records. This action cannot be undone.`)) {
            console.log(`Deletion confirmation accepted for Session ID: ${sessionId}`);
            deleteSession(parseInt(sessionId), buttonElement);
        } else {
             console.log(`Deletion confirmation rejected for Session ID: ${sessionId}`);
        }
    }

    function handleSendNotifications(sessionId, buttonElement) {
        if (buttonElement.disabled) return;

        if (confirm(`Send email notifications to all absentees for Session ID ${sessionId}?`)) {
            buttonElement.disabled = true;
            buttonElement.textContent = 'Sending...';

            fetch(`/admin/send_absentee_notifications/${sessionId}`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert(`Notifications sent successfully!`);
                    // Optionally refresh session list to update absentee_emails_sent status
                    fetchData('/admin/sessions', 'session-list', createSessionListItem);
                } else {
                    alert('Error sending notifications: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error sending notifications:', error);
                alert('An error occurred while sending notifications.');
            })
            .finally(() => {
                buttonElement.disabled = false;
                buttonElement.textContent = '📧 Notify Absentees';
            });
        }
    }

    function handleGeoSettings(sessionId) {
        // Fetch current geo settings from the new backend endpoint
        fetch(`/admin/geo_settings/${sessionId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status} fetching geo settings`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    showGeoSettingsModal(sessionId, data.settings);
                } else {
                    alert('Error fetching geo settings: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error fetching geo settings:', error);
                alert('An error occurred while fetching geo settings.');
            });
    }

    function handleDeviceLogs(sessionId) {
        // You'll need to implement the /admin/device_logs/<int:session_id> endpoint in app.py if you haven't already
        fetch(`/admin/session_statistics/${sessionId}`) // Using existing statistics endpoint for now
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status} fetching device logs`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Adapt the data structure if necessary, or create a dedicated /device_logs endpoint
                    showDeviceLogsModal(sessionId, data.device_statistics); 
                } else {
                    alert('Error fetching device logs: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error fetching device logs:', error);
                alert('An error occurred while fetching device logs.');
            });
    }

    function showGeoSettingsModal(sessionId, settings) {
        const modal = createModal('Geolocation Settings', `
            <form id="geo-settings-form">
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="modal-enable-geo" ${settings.enabled ? 'checked' : ''}> 
                        Enable Geolocation Restriction
                    </label>
                </div>
                <div id="modal-geo-fields" style="display: ${settings.enabled ? 'block' : 'none'}">
                    <div class="form-group">
                        <label for="modal-latitude">Latitude:</label>
                        <input type="number" id="modal-latitude" step="any" value="${settings.latitude || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="modal-longitude">Longitude:</label>
                        <input type="number" id="modal-longitude" step="any" value="${settings.longitude || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="modal-radius">Radius (meters):</label>
                        <input type="number" id="modal-radius" min="1" value="${settings.radius || '100'}" required>
                    </div>
                    <button type="button" id="modal-get-location">Get Current Location</button>
                </div>
                <div class="modal-buttons">
                    <button type="submit">Update Settings</button>
                    <button type="button" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        `);

        // Toggle geo fields within the modal
        document.getElementById('modal-enable-geo').addEventListener('change', function() {
            document.getElementById('modal-geo-fields').style.display = this.checked ? 'block' : 'none';
            // Clear values if disabling to avoid sending stale data
            if (!this.checked) {
                document.getElementById('modal-latitude').value = '';
                document.getElementById('modal-longitude').value = '';
                document.getElementById('modal-radius').value = '100'; // Set default to 100
            }
        });

        // Get current location within the modal
        document.getElementById('modal-get-location').addEventListener('click', function() {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by this browser.');
                return;
            }

            this.disabled = true;
            this.textContent = 'Getting location...';

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    document.getElementById('modal-latitude').value = position.coords.latitude.toFixed(6);
                    document.getElementById('modal-longitude').value = position.coords.longitude.toFixed(6);
                    this.disabled = false;
                    this.textContent = 'Get Current Location';
                },
                (error) => {
                    alert('Unable to get your location. Please ensure location services are enabled and permissions are granted.');
                    this.disabled = false;
                    this.textContent = 'Get Current Location';
                }
            );
        });

        // Form submission for Geo Settings within modal
        document.getElementById('geo-settings-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const enabled = document.getElementById('modal-enable-geo').checked;
            const updateData = {
                enabled: enabled,
                latitude: enabled ? parseFloat(document.getElementById('modal-latitude').value) : null,
                longitude: enabled ? parseFloat(document.getElementById('modal-longitude').value) : null,
                radius: enabled ? parseInt(document.getElementById('modal-radius').value) : null // Ensure integer for radius
            };

            fetch(`/admin/update_geo_settings/${sessionId}`, { // Corrected endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(errorData.message || 'Unknown error');
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('Geolocation settings updated successfully!');
                    closeModal();
                    // Optionally refresh session list to show updated geo settings if needed
                    fetchData('/admin/sessions', 'session-list', createSessionListItem); 
                } else {
                    alert('Error updating settings: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error updating geo settings:', error);
                alert('An error occurred while updating settings: ' + error.message);
            });
        });

        document.body.appendChild(modal);
    }

    function showDeviceLogsModal(sessionId, logs) {
        let logsHtml = '<div class="device-logs-container">';
        
        if (logs.length === 0) {
            logsHtml += '<p>No device access logs found for this session.</p>';
        } else {
            logsHtml += '<table class="device-logs-table">';
            logsHtml += '<thead><tr><th>Device ID</th><th>Students Count</th><th>Scans</th><th>First Scan</th></tr></thead>';
            logsHtml += '<tbody>';
            
            logs.forEach(log => {
                logsHtml += `
                    <tr>
                        <td>${log.device_fingerprint}</td>
                        <td>${log.student_count}</td>
                        <td>${log.scan_count}</td>
                        <td>${log.first_scan_time}</td>
                    </tr>
                `;
            });
            
            logsHtml += '</tbody></table>';
        }
        
        logsHtml += '</div>';
        logsHtml += '<div class="modal-buttons"><button type="button" onclick="closeModal()">Close</button></div>';

        const modal = createModal('Device Access Logs', logsHtml);
        document.body.appendChild(modal);
    }

    function createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <span class="close" onclick="closeModal()">×</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        return modal;
    }

    window.closeModal = function() {
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
    };

    function deleteSession(sessionId, buttonElement) {
        if (buttonElement) {
             buttonElement.disabled = true;
             buttonElement.textContent = 'Deleting...'; 
        }
        console.log(`Sending POST request to /admin/finalize_session/${sessionId} to DELETE it.`);

        fetch(`/admin/finalize_session/${sessionId}`, { 
            method: 'POST' 
        })
        .then(response => {
             if (!response.ok) {
                 return response.json().then(errorData => {
                     const errorMessage = errorData.message || 'Unknown backend error';
                     console.error(`Backend responded with error status ${response.status}: ${errorMessage}`);
                     throw new Error(`HTTP error ${response.status}: ${errorMessage}`);
                 });
             }
             return response.json();
        })
        .then(data => {
            console.log("Backend delete session response:", data);
            if (data.success) {
                alert(data.message); 
                 fetchData('/admin/sessions', 'session-list', createSessionListItem);
                 fetchData('/admin/sessions', 'monitor_session_id', createMonitorSessionOptionText, populateMonitorSessionSelect);
                 if (monitorSessionSelect && monitorSessionSelect.value === String(sessionId)) {
                    monitorSessionSelect.value = ""; 
                    if (pollingInterval) {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                    }
                    liveAttendanceList.innerHTML = '';
                    liveAttendanceStatus.textContent = 'Select a session...';
                    printPdfBtn.style.display = 'none';
                    currentMonitoredAttendanceData = [];
                 }
            } else {
                 console.warn(`Delete session response success: false. Message: ${data.message}`);
                alert('Error deleting session: ' + data.message); 
                if (buttonElement) {
                    buttonElement.disabled = false;
                    buttonElement.textContent = 'Stop Session'; 
                     fetchData('/admin/sessions', 'session-list', createSessionListItem);
                     fetchData('/admin/sessions', 'monitor_session_id', createMonitorSessionOptionText, populateMonitorSessionSelect);
                }
            }
        })
        .catch(error => {
            console.error('Fetch request failed during session deletion:', error); 
            alert('An error occurred while deleting the session: ' + error.message); 
            if (buttonElement) {
                buttonElement.disabled = false;
                buttonElement.textContent = 'Stop Session';
            }
        });
    }

    let pollingInterval = null;
    const monitorSessionSelect = document.getElementById('monitor_session_id');
    const liveAttendanceList = document.getElementById('live-attendance-list');
    const liveAttendanceStatus = document.getElementById('live-attendance-status');
    const printPdfBtn = document.getElementById('print-pdf-report-btn');

    if (monitorSessionSelect && liveAttendanceList && liveAttendanceStatus && printPdfBtn) {
        monitorSessionSelect.addEventListener('change', function() {
            const selectedSessionId = this.value;
            currentMonitoredAttendanceData = [];

            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
                console.log("Polling interval cleared.");
            }

            liveAttendanceList.innerHTML = '';
            liveAttendanceStatus.textContent = 'Select a session...';
            printPdfBtn.style.display = 'none';

            if (selectedSessionId) {
                console.log(`Session selected for monitoring: ${selectedSessionId}. Starting polling.`);
                liveAttendanceStatus.textContent = `Monitoring Session ${selectedSessionId}...`;
                printPdfBtn.style.display = 'inline-block';
                fetchLiveAttendance(selectedSessionId);
                pollingInterval = setInterval(() => {
                    console.log(`Polling live attendance for session ${selectedSessionId}...`);
                    fetchLiveAttendance(selectedSessionId);
                }, 10000);
            } else {
                 console.log("Monitoring session selection cleared. Stopping polling.");
            }
        });
    } else {
         console.warn("Live attendance monitoring elements (select, list, status, or PDF button) not found in HTML.");
    }

    function fetchLiveAttendance(sessionId) {

        fetch(`/admin/live_attendance/${sessionId}`)
            .then(response => {
                 if (!response.ok) {
                    if (response.status === 404) {
                         throw new Error(`Session ${sessionId} not found. It may have been deleted.`);
                    }
                    throw new Error(`HTTP error ${response.status} fetching live data`);
                }
                return response.json();
            })
            .then(data => {
                liveAttendanceList.innerHTML = ''; // Clear content before re-populating
                if (data.success && data.attended_students) {
                    currentMonitoredAttendanceData = data.attended_students;

                    if (data.attended_students.length === 0) {
                        liveAttendanceList.innerHTML = '<li>No attendance recorded yet for this session.</li>';
                    } else {
                        data.attended_students.sort((a, b) => new Date('1970/01/01 ' + a.timestamp) - new Date('1970/01/01 ' + b.timestamp));
                        data.attended_students.forEach(student => {
                            // The backend /admin/live_attendance does not currently return device_id or location info directly
                            // from the attendance object in the `attended_students` list.
                            // If you need it, modify that backend route.
                            const deviceInfo = ''; // student.device_id ? ` [Device: ${student.device_id.substring(0, 8)}...]` : '';
                            const geoInfo = ''; // student.location ? ` [Location verified]` : '';
                            liveAttendanceList.innerHTML += `<li>${student.timestamp} - ${student.reg_no} (${student.name})${deviceInfo}${geoInfo}</li>`;
                        });
                    }

                    const totalEnrolled = 'N/A'; // Placeholder until fetched or calculated
                    const totalAttended = data.attended_students.length;
                    
                    liveAttendanceStatus.textContent = `Monitoring Session ${sessionId} (${totalAttended} present)`;
                } else {
                    currentMonitoredAttendanceData = [];
                    liveAttendanceList.innerHTML = `<li>Error fetching attendance: ${data.message || 'Unknown error'}</li>`;
                    liveAttendanceStatus.textContent = `Error monitoring Session ${sessionId}.`;
                     if (pollingInterval) {
                         clearInterval(pollingInterval);
                         pollingInterval = null;
                         printPdfBtn.style.display = 'none';
                         console.log("Polling stopped due to backend error fetching live data.");
                     }
                     console.error('Backend reported error fetching live data:', data.message);
                }
            })
            .catch(error => {
                currentMonitoredAttendanceData = [];
                console.error('Fetch request failed during live attendance polling:', error);
                liveAttendanceList.innerHTML = `<li>Network or session error: ${error.message}.</li>`;
                liveAttendanceStatus.textContent = `Error monitoring Session ${sessionId}. Polling stopped.`;
                 if (pollingInterval) {
                     clearInterval(pollingInterval);
                     pollingInterval = null;
                     printPdfBtn.style.display = 'none';
                     console.log("Polling stopped due to network/session error.");
                 }
                 if(monitorSessionSelect.value === sessionId){
                    alert(`Session ${sessionId} is no longer available. It might have been deleted.`);
                    monitorSessionSelect.value = ""; 
                    fetchData('/admin/sessions', 'monitor_session_id', createMonitorSessionOptionText, populateMonitorSessionSelect);
                 }
            });
    }

    if (printPdfBtn) {
        printPdfBtn.addEventListener('click', function() {
            const selectedSessionId = monitorSessionSelect.value;
            if (!selectedSessionId) {
                alert("Please select a session to monitor first.");
                return;
            }
            if (currentMonitoredAttendanceData.length === 0) {
                alert("No attendance data available to print for this session.");
                return;
            }
            generateAttendancePdf(selectedSessionId, currentMonitoredAttendanceData);
        });
    }

    function generateAttendancePdf(sessionId, attendanceData) {
        const { jsPDF } = window.jspdf; 
        if (!jsPDF || !jsPDF.API || !jsPDF.API.autoTable) {
            alert("PDF generation library (jsPDF with autoTable) not loaded correctly. Please check console.");
            console.error("jsPDF or jsPDF.autoTable is not available.");
            return;
        }
        const doc = new jsPDF();

        let sessionTitle = "Attendance Report";
        let sessionDetailsText = `Session ID: ${sessionId}`;
        const selectedOptionText = monitorSessionSelect.options[monitorSessionSelect.selectedIndex]?.text;

        if (selectedOptionText) {
            const match = selectedOptionText.match(/ID: (\d+) - (.*?) on (\d{4}-\d{2}-\d{2})(?: \((.*)\))?/);
            if (match) {
                const classInfo = match[2].trim();
                const sessionDate = match[3];
                sessionTitle = `Attendance Report: ${classInfo}`;
                sessionDetailsText = `Session ID: ${sessionId}  |  Date: ${sessionDate}`;
            } else {
                 sessionDetailsText = `Session: ${selectedOptionText}`;
            }
        }


        doc.setFontSize(18);
        doc.text(sessionTitle, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100); 
        doc.text(sessionDetailsText, 14, 30);

        const tableColumns = ["#", "Reg No", "Student Name"]; 
        const tableRows = attendanceData.map((student, index) => [
            index + 1,
            student.reg_no,
            student.name
        ]);

        doc.autoTable({
            startY: 38,
            head: [tableColumns],
            body: tableRows,
            theme: 'striped', 
            headStyles: { fillColor: [34, 107, 165] }, 
            alternateRowStyles: { fillColor: [245, 245, 245] },
            didDrawPage: function (data) { 
                doc.setFontSize(10);
                doc.setTextColor(150);
                const pageCount = doc.internal.getNumberOfPages();
                 doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
                doc.text(`Generated: ${new Date().toLocaleString()}`, doc.internal.pageSize.width - data.settings.margin.right - 50, doc.internal.pageSize.height - 10, { align: 'left'});
            }
        });

        const fileNameDate = new Date().toISOString().slice(0,10);
        doc.save(`Attendance_Report_S${sessionId}_${fileNameDate}.pdf`);
    }
});