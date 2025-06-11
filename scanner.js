document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const output = document.getElementById('output');
    const error = document.getElementById('error');
    const regnoPrompt = document.getElementById('regno-prompt');
    const regnoInput = document.getElementById('regno-input');
    const submitRegnoBtn = document.getElementById('submit-regno');

    let isScanning = true;
    let scannedQrDataString = null; 
    let stream = null;
    let userLocation = null;
    let locationWatchId = null; 
    // Add this line to store the registration number
    let savedRegNo = sessionStorage.getItem('savedRegNo');

    // Hide regno prompt initially
    regnoPrompt.style.display = 'none';

    // Start continuous location tracking instead of one-time location
    startLocationTracking();

    // Function to start continuous location tracking
    function startLocationTracking() {
        if (!navigator.geolocation) {
            console.warn('Geolocation is not supported by this browser');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 15000, // Increased timeout for better accuracy
            maximumAge: 60000 // Reduced to 1 minute for more frequent updates
        };

        // Get an initial position
        navigator.geolocation.getCurrentPosition(
            updateLocation,
            handleLocationError,
            options
        );

        // Then start watching position for changes
        locationWatchId = navigator.geolocation.watchPosition(
            updateLocation,
            handleLocationError,
            options
        );
    }

    // Function to update location with accuracy checks
    function updateLocation(position) {
        // Only update location if accuracy is reasonable (less than 100 meters)
        // This helps filter out very inaccurate readings
        if (position.coords.accuracy <= 100) {
            userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            console.log('Location updated:', userLocation);
            showMessage(`Location detected (±${Math.round(position.coords.accuracy)}m). Ready to scan QR code.`, 'info');
        } else {
            console.warn('Location accuracy too low:', position.coords.accuracy);
            // Still store the location but with a warning
            userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            showMessage(`Location detected but accuracy is low (±${Math.round(position.coords.accuracy)}m). This may affect attendance verification.`, 'warning');
        }
    }

    // Function to handle location errors
    function handleLocationError(error) {
        console.warn('Location error:', error);
        // More user-friendly error message
        let errorMessage = 'Location access denied or timed out. ';
        if (error.code === error.PERMISSION_DENIED) {
            errorMessage += 'Please enable location services and grant permission to this site.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage += 'Location information is unavailable.';
        } else if (error.code === error.TIMEOUT) {
            errorMessage += 'The request to get user location timed out.';
        }
        showMessage(errorMessage + ' Attendance recording may require location.', 'warning');
    }

    // Function to display messages
    function showMessage(message, type = 'info') {
        output.textContent = message;
        output.className = type;
        
        if (type === 'success' || type === 'info') {
            error.textContent = ''; // Clear error if showing success/info
            error.style.display = 'none';
        } else {
            error.style.display = 'block';
        }
    }

    function showError(message) {
        error.textContent = message;
        output.className = 'error'; // Apply error styling to output for visual feedback
        error.style.display = 'block'; // Make sure the explicit error div is shown
    }

    // Function to start camera
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment', 
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            video.srcObject = stream;
            video.style.display = 'block';
            
            await new Promise((resolve) => {
                video.onloadedmetadata = resolve;
            });
            
            if (userLocation) {
                showMessage(`Camera and location ready (±${Math.round(userLocation.accuracy)}m). Point at QR code to scan.`, 'info');
            } else {
                showMessage('Camera ready. Point at QR code to scan. (Location pending)', 'info');
            }
            
            requestAnimationFrame(scanFrame);
            
        } catch (err) {
            console.error('Camera access error:', err);
            showError('Camera access denied or not available. Please allow camera access and refresh the page.');
        }
    }

    // Function to scan QR code from video frame
    function scanFrame() {
        if (!isScanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
            if (isScanning) {
                requestAnimationFrame(scanFrame);
            }
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
            console.log('QR Code detected:', code.data);
            handleQRCode(code.data);
        } else {
            requestAnimationFrame(scanFrame);
        }
    }

    // Function to handle detected QR code
    function handleQRCode(qrData) {
        isScanning = false; // Stop scanning temporarily
        
        const trimmedQrData = qrData.trim();
        
        console.log('--- QR SCAN DEBUG ---');
        console.log('Raw QR Data detected by jsQR:', qrData);
        console.log('Trimmed QR Data:', trimmedQrData);

        // Expected format: "SESSION_ID|SECRET_KEY"
        const qrDataParts = trimmedQrData.split('|');
        
        console.log('QR Data Parts (after split):', qrDataParts);
        console.log('Length of parts:', qrDataParts.length);
        console.log('Is first part a number?', /^\d+$/.test(qrDataParts[0]));

        // --- CRITICAL FIX HERE ---
        // Check if it has exactly two parts AND the first part is a number (session ID)
        if (qrDataParts.length !== 2 || !/^\d+$/.test(qrDataParts[0])) {
            showError('Invalid QR code format. Please scan a valid attendance QR code (Expecting "SessionID|SecretKey").');
            setTimeout(() => {
                isScanning = true;
                showMessage('Scanning...', 'scanning');
                requestAnimationFrame(scanFrame);
            }, 3000); // Resume scanning after 3 seconds
            return;
        }
        // --- END CRITICAL FIX ---
        
        scannedQrDataString = trimmedQrData;
        
        // Check if we already have a saved registration number
        if (savedRegNo) {
            // Use the saved registration number automatically
            showMessage('QR code detected! Using your saved registration number.', 'info');
            submitAttendanceWithRegNo(savedRegNo);
        } else {
            // Ask for registration number as before
            showMessage('QR code detected! Please enter your registration number.', 'info');
            regnoPrompt.style.display = 'block';
            regnoInput.focus();
        }
    }

    // Function to submit attendance with a given registration number
    function submitAttendanceWithRegNo(regNo) {
        if (!scannedQrDataString) {
            showError('No QR code scanned. Please scan again.');
            resetScanner();
            return;
        }
        
        showMessage('Recording attendance...', 'info');
        
        const attendanceData = {
            session_id: scannedQrDataString, // Pass the full QR data string to the backend
            reg_no: regNo
        };

        if (userLocation) {
            attendanceData.latitude = userLocation.latitude;
            attendanceData.longitude = userLocation.longitude;
            // Also send accuracy information to the server
            attendanceData.accuracy = userLocation.accuracy;
        }
        
        fetch('/record_attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(attendanceData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Save the registration number in session storage
                if (!savedRegNo) {
                    sessionStorage.setItem('savedRegNo', regNo);
                    savedRegNo = regNo;
                }
                showMessage(`✓ Attendance recorded successfully! Welcome, ${data.student_name}`, 'success');
            } else {
                showError(`Failed to record attendance: ${data.message}`);
            }
            // Auto-reset after 3 seconds for next scan
            setTimeout(() => {
                resetScanner();
            }, 3000);
        })
        .catch(err => {
            console.error('Attendance submission error:', err);
            showError('Network error. Please check your connection and try again.');
            setTimeout(() => {
                resetScanner();
            }, 3000);
        });
    }

    // Modify the existing submitAttendance function to use the new function
    function submitAttendance() {
        const regNo = regnoInput.value.trim();
        
        if (!regNo) {
            showError('Please enter your registration number.');
            regnoInput.focus();
            return;
        }
        
        submitAttendanceWithRegNo(regNo);
    }

    // Function to reset scanner for next scan
    function resetScanner() {
        regnoPrompt.style.display = 'none';
        regnoInput.value = '';
        scannedQrDataString = null; 
        isScanning = true;
        showMessage('Scanning...', 'scanning');
        requestAnimationFrame(scanFrame);
    }

    submitRegnoBtn.addEventListener('click', submitAttendance);
    
    regnoInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            submitAttendance();
        }
    });

    output.addEventListener('click', function() {
        if (output.className === 'success' || output.className === 'error') {
            resetScanner();
        }
    });

    // Add a function to clear saved registration number
    function clearSavedRegNo() {
        sessionStorage.removeItem('savedRegNo');
        savedRegNo = null;
        showMessage('Your saved registration number has been cleared.', 'info');
    }


    function cleanup() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (locationWatchId !== null) {
            navigator.geolocation.clearWatch(locationWatchId);
        }
        isScanning = false;
    }

    window.addEventListener('beforeunload', cleanup);
    
    startCamera();
});