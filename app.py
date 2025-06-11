from flask import Flask, render_template, request, redirect, url_for, jsonify, send_file, current_app
from models import db, Student, Class, Session, Enrollment, Attendance, DeviceSession
from datetime import datetime, date, time, timezone
import qrcode
import qrcode.image.svg
from io import BytesIO
import hashlib
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import math
import os
import secrets
from flask import session

# Import email configuration
try:
    from config import MAIL_CONFIG, SECRET_KEY, ADMIN_PASSWORD # Add SECRET_KEY, ADMIN_PASSWORD
except ImportError:
    # Fallback configuration if config.py doesn't exist
    MAIL_CONFIG = {
        'MAIL_SERVER': 'smtp.gmail.com',
        'MAIL_PORT': 587,
        'MAIL_USE_TLS': True,
        'MAIL_USERNAME': '',  
        'MAIL_PASSWORD': '',  
        'MAIL_DEFAULT_SENDER': ''
    }
    SECRET_KEY = secrets.token_hex(16) # SECRET_KEY
    ADMIN_PASSWORD = "admin" #ADMIN_PASSWORD

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db?journal_mode=WAL'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = SECRET_KEY # Set SECRET_KEY here

# Apply email configuration from the imported settings
app.config['MAIL_SERVER'] = MAIL_CONFIG['MAIL_SERVER']
app.config['MAIL_PORT'] = MAIL_CONFIG['MAIL_PORT']
app.config['MAIL_USE_TLS'] = MAIL_CONFIG['MAIL_USE_TLS']
app.config['MAIL_USERNAME'] = MAIL_CONFIG['MAIL_USERNAME']
app.config['MAIL_PASSWORD'] = MAIL_CONFIG['MAIL_PASSWORD']
app.config['MAIL_DEFAULT_SENDER'] = MAIL_CONFIG['MAIL_DEFAULT_SENDER']

db.init_app(app)

# --- Database Creation ---
def create_database():
    with app.app_context():

        print("Creating database tables if they don't exist...")
        db.create_all()
        print("Database tables created successfully.")

def generate_device_fingerprint(request):
    user_agent = request.headers.get('User-Agent', '')
    ip_address = request.remote_addr or 'unknown'
    accept_language = request.headers.get('Accept-Language', '')
    accept_encoding = request.headers.get('Accept-Encoding', '')
    
    fingerprint_data = f"{user_agent}|{ip_address}|{accept_language}|{accept_encoding}"
    return hashlib.sha256(fingerprint_data.encode()).hexdigest()[:32]

def calculate_distance(lat1, lon1, lat2, lon2):
    if not all([lat1, lon1, lat2, lon2]):
        return float('inf')
    
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    earth_radius = 6371000
    distance = earth_radius * c
    
    return distance

def send_email(to_email, subject, html_body):
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = app.config['MAIL_DEFAULT_SENDER']
        msg['To'] = to_email
        
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        
        server = smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT'])
        server.starttls()
        server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False

def send_absentee_notifications(session_id):
    try:
        session_obj = db.session.get(Session, session_id)
        if not session_obj:
            return False
        
        enrolled_students = db.session.query(Student).join(Enrollment).filter(
            Enrollment.class_id == session_obj.class_id
        ).all()
        
        attended_student_ids = db.session.query(Attendance.student_id).filter(
            Attendance.session_id == session_id
        ).all()
        attended_ids = [record[0] for record in attended_student_ids]
        
        absentee_students = [student for student in enrolled_students if student.id not in attended_ids]
        
        if not absentee_students:
            current_app.logger.info(f"No absentee students found for session {session_id}")
            return True
        
        class_obj = db.session.get(Class, session_obj.class_id)
        
        sent_count = 0
        for student in absentee_students:
            if not student.email:
                current_app.logger.warning(f"No email address for student {student.reg_no}")
                continue
            
            subject = f"Absence Notification: {class_obj.class_code} - {class_obj.class_name}"
            
            html_body = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>{subject}</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4;">
                <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); overflow: hidden;">
                    
                    <!-- Header with Logo -->
                    <div style="background: linear-gradient(135deg, #0056b3 0%, #0077cc 100%); padding: 25px; text-align: center; color: #ffffff;">
                        <h1 style="margin: 0; font-size: 26px; letter-spacing: 0.5px;">Attendance Notification</h1>
                        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Alipurduar Government Polytechnic</p>
                    </div>
                    
                    <!-- Alert Banner -->
                    <div style="background-color: #ffe8e8; border-left: 4px solid #ff5252; margin: 0; padding: 12px 25px;">
                        <p style="margin: 0; font-weight: 600; color: #d32f2f;">Absence Recorded</p>
                    </div>
                    
                    <!-- Content Body -->
                    <div style="padding: 30px 25px;">
                        <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong style="color: #0056b3; font-size: 17px;">{student.name}</strong>,</p>
                        
                        <p style="margin-bottom: 20px;">This is an official notification regarding your attendance for the following class session:</p>
                        
                        <div style="background-color: #f9f9f9; border-left: 3px solid #0056b3; border-radius: 5px; padding: 20px; margin-bottom: 25px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; width: 120px;"><strong>Course:</strong></td>
                                    <td style="padding: 8px 0;">{class_obj.class_name} <span style="font-weight: bold; color: #0056b3; background-color: rgba(0,86,179,0.1); padding: 3px 8px; border-radius: 4px; font-size: 14px;">{class_obj.class_code}</span></td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;"><strong>Date:</strong></td>
                                    <td style="padding: 8px 0;">{session_obj.date.strftime('%B %d, %Y')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;"><strong>Semester:</strong></td>
                                    <td style="padding: 8px 0;">{session_obj.semester}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <p style="margin-bottom: 20px; font-size: 16px;">
                            Our records indicate you were <span style="font-weight: bold; color: #d32f2f;">absent</span> from this session.
                        </p>
                        
                        <p style="margin-bottom: 25px; background-color: #fff8e1; padding: 15px; border-radius: 5px; border-left: 3px solid #ffc107;">
                            <strong>Important:</strong> If you believe this is an error or have valid reasons for your absence, please contact your instructor promptly to clarify the situation.
                        </p>
                        
                        <!-- Call to Action Button -->
                        <div style="text-align: center; margin-top: 35px;">
                            <a href="mailto:instructor@alipurduarpolytechnic.edu" 
                               style="display: inline-block; background: linear-gradient(to right, #0056b3, #007bff); color: #ffffff; padding: 14px 30px; border-radius: 50px; text-decoration: none; font-weight: bold; box-shadow: 0 4px 8px rgba(0,123,255,0.3); transition: all 0.3s;">
                               Contact Instructor
                            </a>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f0f4f8; padding: 25px; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0; font-size: 13px; color: #555;">
                            This is an automated notification from Alipurduar (Damanpur) Government Polytechnic Attendance System.
                        </p>
                        <p style="margin: 10px 0 0; font-size: 13px; color: #555;">
                            © {datetime.now().year} Alipurduar (Damanpur) Government Polytechnic. All rights reserved.
                        </p>
                        <div style="margin-top: 15px;">
                            <a href="https://alipurduarpolytechnic.edu" style="color: #0056b3; text-decoration: none; font-size: 13px; margin: 0 10px;">
                                Website
                            </a>
                            <a href="https://alipurduarpolytechnic.edu/contact" style="color: #0056b3; text-decoration: none; font-size: 13px; margin: 0 10px;">
                                Contact
                            </a>
                            <a href="https://alipurduarpolytechnic.edu/policy" style="color: #0056b3; text-decoration: none; font-size: 13px; margin: 0 10px;">
                                Privacy Policy
                            </a>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
            
            if send_email(student.email, subject, html_body):
                sent_count += 1
            
        current_app.logger.info(f"Sent {sent_count} absentee notifications for session {session_id}")
        
        session_obj.absentee_emails_sent = True
        db.session.commit()
        
        return True
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error sending absentee notifications for session {session_id}: {str(e)}", exc_info=True)
        return False

def send_sms(to_number, message_body):
    if not to_number:
        print(f"--- SIMULATED SMS: SKIPPED (No number) --- Message: {message_body}")
        return False
    print(f"--- SIMULATED SMS to {to_number} --- Message: {message_body}")
    return True

# --- General Routes ---

@app.route('/')
def homepage():
    return render_template('index.html')

@app.route('/scanner', methods=['GET'])
def scanner():
    return render_template('scanner.html')

def get_qr_data_for_session(session_obj):
    qr_data = f"{session_obj.id}|{session_obj.secret_key}"
    return qr_data

@app.route('/record_attendance', methods=['POST'])
def record_attendance():
    data = request.get_json()
    scanned_qr_data_string = data.get('session_id') # This now contains the 'session_id|secret_key' from the QR
    reg_no = data.get('reg_no')
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    device_fingerprint = None 

    try:
        device_fingerprint = generate_device_fingerprint(request)
        
        # Split the scanned QR data string into its components: 'session_id|secret_key'
        parts = scanned_qr_data_string.split('|')
        if len(parts) != 2:
            current_app.logger.warning(f"Scan attempt: Invalid QR data format: {scanned_qr_data_string}")
            return jsonify({'success': False, 'message': 'Invalid QR Code format.'}), 400
        
        session_id_from_qr = int(parts[0])
        secret_key_from_qr = parts[1]

        session_obj = db.session.get(Session, session_id_from_qr)
        if not session_obj:
             current_app.logger.warning(f"Scan attempt: Session not found for ID: {session_id_from_qr}")
             return jsonify({'success': False, 'message': 'Invalid session QR code.'}), 404

        # --- QR Code Verification ---
        # Verify the secret_key from the QR code against the one stored for the session
        if not (secret_key_from_qr == session_obj.secret_key):
            current_app.logger.warning(f"Scan attempt: Invalid secret key for session {session_obj.id}. Scanned: {secret_key_from_qr[:10]}... Expected: {session_obj.secret_key[:10]}...")
            return jsonify({'success': False, 'message': 'QR Code is invalid. It may have been generated incorrectly or tampered with.'}), 403
        # --- Static QR Code Verification ---

        if session_obj.is_finalized:
             current_app.logger.info(f"Scan attempt: Session {session_obj.id} is finalized.")
             return jsonify({'success': False, 'message': 'Attendance for this session is closed (session finalized).'}), 403

        student = Student.query.filter_by(reg_no=reg_no).first()
        if not student:
            current_app.logger.warning(f"Scan attempt: Student not found for Reg No: {reg_no} scanning session {session_obj.id}")
            return jsonify({'success': False, 'message': 'Invalid Registration Number.'}), 404

        enrollment = Enrollment.query.filter_by(
            student_id=student.id, 
            class_id=session_obj.class_id
        ).first()
        if not enrollment:
            current_app.logger.warning(f"Scan attempt: Student {student.reg_no} not enrolled in class for session {session_obj.id}")
            return jsonify({'success': False, 'message': 'You are not enrolled in this class.'}), 403

        existing_attendance = Attendance.query.filter_by(student_id=student.id, session_id=session_obj.id).first()
        if existing_attendance:
             current_app.logger.info(f"Scan attempt: Attendance already recorded for student {student.reg_no} in session {session_obj.id}")
             return jsonify({'success': True, 'message': 'Attendance already recorded.', 'student_name': student.name}), 200

        class_obj = db.session.get(Class, session_obj.class_id)
        
        # In the record_attendance route, modify the geolocation check section:
        
        # Geolocation check
        if class_obj.campus_latitude is not None and class_obj.campus_longitude is not None and latitude is not None and longitude is not None:
            distance = calculate_distance(
                float(latitude), float(longitude),
                class_obj.campus_latitude, class_obj.campus_longitude
            )
            
            # Get GPS accuracy if provided (default to 50m if not)
            gps_accuracy = float(data.get('accuracy', 50))
            
            # Add the accuracy to the max distance to account for GPS error
            max_distance = (class_obj.campus_radius_meters or 500) + gps_accuracy
            
            if distance > max_distance:
                current_app.logger.warning(f"Scan attempt: Student {student.reg_no} outside campus area. Distance: {distance:.0f}m, GPS Accuracy: ±{gps_accuracy:.0f}m")
                return jsonify({
                    'success': False, 
                    'message': f'You appear to be outside the allowed campus area. Distance: {distance:.0f}m (Max: {max_distance-gps_accuracy:.0f}m + {gps_accuracy:.0f}m GPS accuracy)'
                }), 403
        elif (class_obj.campus_latitude is not None or class_obj.campus_longitude is not None) and (latitude is None or longitude is None):
            # If class has geo-restriction set, but scanner did not provide location
            current_app.logger.warning(f"Scan attempt: Class {class_obj.class_code} requires location, but student {student.reg_no} did not provide it.")
            return jsonify({
                'success': False,
                'message': 'Geolocation is required for this class, but your device did not provide it.'
            }), 403

        device_session = DeviceSession.query.filter_by(
            session_id=session_obj.id,
            device_fingerprint=device_fingerprint
        ).first()
        
        if device_session:
            student_ids_used = json.loads(device_session.student_ids_scanned or '[]')
            
            if student.id not in student_ids_used:
                if len(student_ids_used) >= 3:
                    current_app.logger.warning(f"Scan attempt: Device {device_fingerprint[:8]} exceeded student limit for session {session_obj.id}")
                    return jsonify({
                        'success': False, 
                        'message': 'This device has been used by too many students. Please use a different device.'
                    }), 403
                
                student_ids_used.append(student.id)
                device_session.student_ids_scanned = json.dumps(student_ids_used)
                device_session.scan_count += 1
            
        else:
            device_session = DeviceSession(
                session_id=session_obj.id,
                device_fingerprint=device_fingerprint,
                first_scan_time=datetime.now(timezone.utc),
                scan_count=1,
                student_ids_scanned=json.dumps([student.id])
            )
            db.session.add(device_session)

        new_attendance = Attendance(
            student_id=student.id, 
            session_id=session_obj.id, 
            timestamp=datetime.now(timezone.utc),
            device_fingerprint=device_fingerprint,
            latitude=float(latitude) if latitude else None,
            longitude=float(longitude) if longitude else None
        )
        db.session.add(new_attendance)
        db.session.commit()
        
        current_app.logger.info(f"Attendance recorded for student {student.reg_no} in session {session_obj.id}")
        return jsonify({'success': True, 'message': 'Attendance recorded!', 'student_name': student.name}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"An error occurred during attendance recording: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'An internal error occurred.', 'error_details': str(e)}), 500

# --- Admin Backend Routes ---

@app.route('/admin', methods=['GET'])
def admin_dashboard():
    return render_template('admin.html')

@app.route('/admin/add_student', methods=['POST'])
def admin_add_student():
    data = request.get_json()
    reg_no, name, major, mobile_number, email = data.get('reg_no'), data.get('name'), data.get('major'), data.get('mobile_number'), data.get('email')
    if not reg_no or not name: return jsonify({'success': False, 'message': 'Missing reg_no or name'}), 400
    if Student.query.filter_by(reg_no=reg_no).first(): return jsonify({'success': False, 'message': f'Reg No {reg_no} already exists'}), 409
    new_student = Student(reg_no=reg_no, name=name, major=major, mobile_number=mobile_number, email=email)
    db.session.add(new_student); db.session.commit()
    return jsonify({'success': True, 'message': 'Student added', 'student': {'id': new_student.id, 'reg_no': new_student.reg_no, 'name': new_student.name}}), 201

@app.route('/admin/students', methods=['GET'])
def admin_list_students():
    students = Student.query.all()
    return jsonify([{'id': s.id, 'reg_no': s.reg_no, 'name': s.name, 'major': s.major, 'mobile_number': s.mobile_number, 'email': s.email} for s in students])

@app.route('/admin/add_class', methods=['POST'])
def admin_add_class():
    data = request.get_json()
    class_code, class_name = data.get('class_code'), data.get('class_name')
    # No need to get geo data here, it's set with session creation or geo settings modal
    # campus_latitude = data.get('campus_latitude') 
    # campus_longitude = data.get('campus_longitude')
    # campus_radius_meters = data.get('campus_radius_meters', 500)
    
    if not class_code or not class_name: return jsonify({'success': False, 'message': 'Missing class_code or class_name'}), 400
    if Class.query.filter_by(class_code=class_code).first(): return jsonify({'success': False, 'message': f'Class code {class_code} already exists'}), 409
    
    new_class = Class(
        class_code=class_code, 
        class_name=class_name,
        # Initialize geo values to None/default for a new class
        campus_latitude=None,
        campus_longitude=None,
        campus_radius_meters=100 
    )
    db.session.add(new_class); db.session.commit()
    return jsonify({'success': True, 'message': 'Class added', 'class': {'id': new_class.id, 'class_code': new_class.class_code, 'class_name': new_class.class_name}}), 201

@app.route('/admin/classes', methods=['GET'])
def admin_list_classes():
    classes = Class.query.all()
    return jsonify([{
        'id': c.id, 
        'class_code': c.class_code, 
        'class_name': c.class_name,
        'campus_latitude': c.campus_latitude,
        'campus_longitude': c.campus_longitude,
        'campus_radius_meters': c.campus_radius_meters
    } for c in classes])

@app.route('/admin/enroll_student', methods=['POST'])
def admin_enroll_student():
    data = request.get_json()
    student_id, class_id = data.get('student_id'), data.get('class_id')
    if not student_id or not class_id: return jsonify({'success': False, 'message': 'Missing student_id or class_id'}), 400
    try: student_id, class_id = int(student_id), int(class_id)
    except ValueError: return jsonify({'success': False, 'message': 'IDs must be integers'}), 400
    student, class_obj = db.session.get(Student, student_id), db.session.get(Class, class_id)
    if not student or not class_obj: return jsonify({'success': False, 'message': 'Student or Class not found'}), 404
    if Enrollment.query.filter_by(student_id=student_id, class_id=class_id).first(): return jsonify({'success': False, 'message': 'Already enrolled'}), 409
    new_enrollment = Enrollment(student_id=student_id, class_id=class_id)
    db.session.add(new_enrollment); db.session.commit()
    return jsonify({'success': True, 'message': 'Enrollment added'}), 201

@app.route('/admin/enrollments', methods=['GET'])
def admin_list_enrollments():
    enrollments = db.session.query(Enrollment, Student, Class).join(Student).join(Class).all()
    return jsonify([{'id': e.id, 'student_id': s.id, 'student_reg_no': s.reg_no, 'student_name': s.name, 'class_id': c.id, 'class_code': c.class_code, 'class_name': c.class_name} for e,s,c in enrollments])

@app.route('/admin/create_session', methods=['POST'])
def admin_create_session():
    data = request.get_json()
    class_id, date_str, semester = data.get('class_id'), data.get('date'), data.get('semester')
    
    enable_geolocation = data.get('enable_geolocation', False)
    geo_latitude = data.get('geo_latitude')
    geo_longitude = data.get('geo_longitude')
    geo_radius = data.get('geo_radius')

    if not class_id or not date_str or not semester: return jsonify({'success': False, 'message': 'Missing fields'}), 400
    try:
        class_id = int(class_id)
        session_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError: return jsonify({'success': False, 'message': 'Invalid ID or date format'}), 400
    
    class_obj = db.session.get(Class, class_id)
    if not class_obj: return jsonify({'success': False, 'message': f'Class ID {class_id} not found'}), 404
    
    # --- Geolocation settings based on form input ---
    try:
        if enable_geolocation:
            if geo_latitude is None or geo_longitude is None or geo_radius is None:
                # Should be caught by frontend, but server-side validation is good
                return jsonify({'success': False, 'message': 'Latitude, Longitude, and Radius are required when geolocation is enabled for session creation.'}), 400
            class_obj.campus_latitude = float(geo_latitude)
            class_obj.campus_longitude = float(geo_longitude)
            class_obj.campus_radius_meters = int(geo_radius)
        else:
            # If geolocation is NOT enabled on session creation, clear the class's geo settings
            class_obj.campus_latitude = None
            class_obj.campus_longitude = None
            class_obj.campus_radius_meters = 100 # Reset to default of 100
        db.session.add(class_obj) # Make sure class_obj is tracked for changes
    except ValueError:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Invalid number format for geolocation coordinates or radius.'}), 400
    # --- End of class geolocation update ---

    existing_session = Session.query.filter_by(class_id=class_id, date=session_date, semester=semester).first()
    
    if existing_session:
        qr_data_for_existing = get_qr_data_for_session(existing_session)
        return jsonify({
            'success': True,
            'message': 'Session already exists. Displaying its QR code.', 
            'session_id': existing_session.id, 
            'session': {
                'id': existing_session.id, 
                'class_code': class_obj.class_code, 
                'date': str(existing_session.date), # Corrected typo here
                'semester': existing_session.semester
            },
            'qr_data': qr_data_for_existing
        }), 200
        
    session_secret_key = secrets.token_urlsafe(32)

    new_session = Session(
        class_id=class_id, 
        date=session_date, 
        semester=semester, 
        is_finalized=False,
        absentee_emails_sent=False,
        secret_key=session_secret_key
    )
    db.session.add(new_session); 
    db.session.commit() # Commit both new session and any updated class changes
    
    qr_data_for_new = get_qr_data_for_session(new_session)

    return jsonify({
        'success': True,
        'message': 'Session created', 
        'session_id': new_session.id, 
        'session': {
            'id': new_session.id, 
            'class_code': class_obj.class_code, 
            'date': str(new_session.date), 
            'semester': new_session.semester
        },
        'qr_data': qr_data_for_new
    }), 201

@app.route('/admin/sessions', methods=['GET'])
def admin_list_sessions():
    sessions_query = db.session.query(Session, Class).\
                     join(Class).\
                     filter(Session.is_finalized == False)

    sessions = sessions_query.order_by(Session.date.desc(), Session.start_time.desc(), Class.class_code).all()

    session_list = []
    for session_obj, class_obj in sessions:
        session_list.append({
            'id': session_obj.id,
            'class_id': session_obj.class_id,
            'class_code': class_obj.class_code,
            'class_name': class_obj.class_name,
            'date': str(session_obj.date),
            'semester': session_obj.semester,
            'start_time': str(session_obj.start_time) if session_obj.start_time else None,
            'end_time': str(session_obj.end_time) if session_obj.end_time else None,
            'is_finalized': session_obj.is_finalized,
            'absentee_emails_sent': session_obj.absentee_emails_sent
        })
    return jsonify(session_list)

@app.route('/admin/get_static_qr_data/<int:session_id>', methods=['GET'])
def admin_get_static_qr_data(session_id):
    session_obj = db.session.get(Session, session_id)
    if not session_obj:
        return jsonify({'success': False, 'message': 'Session not found'}), 404
    
    qr_data = get_qr_data_for_session(session_obj)

    return jsonify({
        'success': True,
        'qr_data': qr_data
    })

@app.route('/admin/generate_qr_image', methods=['GET'])
def admin_generate_qr_image():
    qr_data_string = request.args.get('data')
    if not qr_data_string:
        return "Missing QR data", 400
    
    factory = qrcode.image.svg.SvgImage
    img = qrcode.make(qr_data_string, image_factory=factory)
    buffer = BytesIO()
    img.save(buffer); buffer.seek(0)
    return send_file(buffer, mimetype='image/svg+xml')

# --- Fetch Geolocation Settings for a Session's Class (FIXED) ---
@app.route('/admin/geo_settings/<int:session_id>', methods=['GET'])
def admin_geo_settings(session_id):
    session_obj = db.session.get(Session, session_id)
    if not session_obj:
        return jsonify({'success': False, 'message': 'Session not found'}), 404
    
    class_obj = db.session.get(Class, session_obj.class_id)
    if not class_obj:
        return jsonify({'success': False, 'message': 'Associated class not found'}), 404
    
    # Correctly determine 'enabled' state based on actual stored coordinates
    settings = {
        'enabled': class_obj.campus_latitude is not None and class_obj.campus_longitude is not None,
        'latitude': class_obj.campus_latitude,
        'longitude': class_obj.campus_longitude,
        'radius': class_obj.campus_radius_meters
    }
    return jsonify({'success': True, 'settings': settings})

# --- Update Geolocation Settings for a Session's Class ---
@app.route('/admin/update_geo_settings/<int:session_id>', methods=['POST'])
def admin_update_geo_settings(session_id):
    data = request.get_json()
    enabled = data.get('enabled')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    radius = data.get('radius')

    session_obj = db.session.get(Session, session_id)
    if not session_obj:
        return jsonify({'success': False, 'message': 'Session not found'}), 404
    
    class_obj = db.session.get(Class, session_obj.class_id)
    if not class_obj:
        return jsonify({'success': False, 'message': 'Associated class not found'}), 404

    try:
        if enabled:
            if latitude is None or longitude is None or radius is None:
                return jsonify({'success': False, 'message': 'Latitude, Longitude, and Radius are required when geolocation is enabled.'}), 400
            class_obj.campus_latitude = float(latitude)
            class_obj.campus_longitude = float(longitude)
            class_obj.campus_radius_meters = int(radius)
        else:
            # If disabled, clear the location settings for the class
            class_obj.campus_latitude = None
            class_obj.campus_longitude = None
            class_obj.campus_radius_meters = 500 # Revert to default or set to None
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Geolocation settings updated.'})
    except ValueError:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Invalid number format for latitude, longitude, or radius.'}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating geo settings for session {session_id}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'An internal error occurred.'}), 500

@app.route('/admin/finalize_session/<int:session_id>', methods=['POST'])
def admin_delete_session_action(session_id):
    session_obj = db.session.get(Session, session_id)

    if not session_obj:
        current_app.logger.warning(f"Attempt to delete non-existent session ID: {session_id}")
        return jsonify({'success': False, 'message': 'Session not found. It may have already been deleted.'}), 404
    try:
        if not session_obj.absentee_emails_sent:
            current_app.logger.info(f"Sending absentee notifications for session {session_id} before deletion")
            send_absentee_notifications(session_id)
        
        num_attendance_deleted = Attendance.query.filter_by(session_id=session_obj.id).delete()
        num_device_sessions_deleted = DeviceSession.query.filter_by(session_id=session_obj.id).delete()
        
        db.session.delete(session_obj)
        db.session.commit()
        
        message = f"Session ID {session_id} and its {num_attendance_deleted} attendance record(s) and {num_device_sessions_deleted} device session(s) have been successfully deleted."
        current_app.logger.info(message)
        return jsonify({
            'success': True,
            'message': message,
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting session ID {session_id}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'An internal error occurred while deleting the session: {str(e)}'}), 500

@app.route('/admin/send_absentee_notifications/<int:session_id>', methods=['POST'])
def admin_send_absentee_notifications(session_id):
    """Manually trigger absentee notifications for a session"""
    try:
        session_obj = db.session.get(Session, session_id)
        if not session_obj:
            return jsonify({'success': False, 'message': 'Session not found'}), 404
        
        if session_obj.absentee_emails_sent:
            return jsonify({'success': False, 'message': 'Absentee notifications already sent for this session'}), 400
        
        success = send_absentee_notifications(session_id)
        if success:
            return jsonify({'success': True, 'message': 'Absentee notifications sent successfully'}), 200
        else:
            return jsonify({'success': False, 'message': 'Failed to send some or all notifications'}), 500
            
    except Exception as e:
        current_app.logger.error(f"Error sending absentee notifications for session {session_id}: {str(e)}")
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

@app.route('/admin/live_attendance/<int:session_id>', methods=['GET'])
def admin_live_attendance(session_id):
    session_obj = db.session.get(Session, session_id)
    if not session_obj:
        current_app.logger.info(f"Live attendance requested for non-existent/deleted session ID: {session_id}")
        return jsonify({'success': False, 'message': 'Session not found (it may have been deleted).'}), 404

    attendance_records = db.session.query(Attendance, Student).\
                           join(Student).\
                           filter(Attendance.session_id == session_id).\
                           order_by(Attendance.timestamp.asc()).all()

    attended_students = [{'reg_no': student.reg_no, 'name': student.name, 'timestamp': record.timestamp.strftime('%H:%M:%S')} for record, student in attendance_records]
    return jsonify({'success': True, 'session_id': session_id, 'attended_students': attended_students})

@app.route('/admin/session_statistics/<int:session_id>', methods=['GET'])
def admin_session_statistics(session_id):
    """Get detailed statistics for a session including device usage"""
    try:
        session_obj = db.session.get(Session, session_id)
        if not session_obj:
            return jsonify({'success': False, 'message': 'Session not found'}), 404
        
        attendance_count = Attendance.query.filter_by(session_id=session_id).count()
        
        enrolled_count = Enrollment.query.filter_by(class_id=session_obj.class_id).count()
        
        device_sessions = DeviceSession.query.filter_by(session_id=session_id).all()
        device_stats = []
        
        for ds in device_sessions:
            student_ids = json.loads(ds.student_ids_scanned or '[]')
            device_stats.append({
                'device_fingerprint': ds.device_fingerprint[:8] + '...',
                'student_count': len(student_ids),
                'scan_count': ds.scan_count,
                'first_scan_time': ds.first_scan_time.strftime('%H:%M:%S'),
            })
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'attendance_count': attendance_count,
            'enrolled_count': enrolled_count,
            'absent_count': enrolled_count - attendance_count,
            'device_count': len(device_sessions),
            'device_statistics': device_stats,
            'absentee_emails_sent': session_obj.absentee_emails_sent
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting session statistics for {session_id}: {str(e)}")
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

@app.route('/admin/attendance_records', methods=['GET'])
def admin_view_attendance_raw():
    attendance = db.session.query(Attendance, Student, Session, Class).join(Student).join(Session).join(Class).all()
    records = []
    for att, s, sess, c in attendance:
        record = {
            'id': att.id, 
            'student_reg_no': s.reg_no, 
            'student_name': s.name, 
            'session_id': sess.id, 
            'class_code': c.class_code, 
            'class_name': c.class_name, 
            'date': str(sess.date), 
            'semester': sess.semester, 
            'timestamp': att.timestamp.isoformat(),
            'device_fingerprint': att.device_fingerprint[:8] + '...' if att.device_fingerprint else None,
            'latitude': att.latitude,
            'longitude': att.longitude
        }
        records.append(record)
    
    records.sort(key=lambda x: x['timestamp'], reverse=True)
    return jsonify(records)

@app.route('/admin/login', methods=['POST'])
def admin_login():
    password = request.json.get('password')
    if password == ADMIN_PASSWORD:
        session['logged_in'] = True
        return jsonify({'success': True, 'message': 'Login successful'}), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid password'}), 401

@app.route('/admin/logout')
def admin_logout():
    session.pop('logged_in', None)
    return redirect(url_for('index'))

if __name__ == '__main__':
    with app.app_context():
        create_database() 
        
    app.run(debug=True, host='0.0.0.0', port=5000)