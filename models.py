from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date, time

db = SQLAlchemy()

class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.Integer, primary_key=True)
    reg_no = db.Column(db.Text, unique=True, nullable=False) 
    name = db.Column(db.Text, nullable=False)
    major = db.Column(db.Text)
    mobile_number = db.Column(db.Text) 
    email = db.Column(db.Text) 
    attendance_records = db.relationship('Attendance', backref='student', lazy=True)
    enrollments = db.relationship('Enrollment', backref='student', lazy=True)

class Class(db.Model):
    __tablename__ = 'classes'
    id = db.Column(db.Integer, primary_key=True)
    class_code = db.Column(db.Text, unique=True, nullable=False) 
    class_name = db.Column(db.Text, nullable=False)
    campus_latitude = db.Column(db.Float)
    campus_longitude = db.Column(db.Float)
    campus_radius_meters = db.Column(db.Integer, default=500)
    enrollments = db.relationship('Enrollment', backref='class', lazy=True)

class Session(db.Model): 
    __tablename__ = 'sessions'
    id = db.Column(db.Integer, primary_key=True) 
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    semester = db.Column(db.Text, nullable=False)
    start_time = db.Column(db.Time) 
    end_time = db.Column(db.Time)
    is_finalized = db.Column(db.Boolean, default=False, nullable=False)
    absentee_emails_sent = db.Column(db.Boolean, default=False, nullable=False)
    secret_key = db.Column(db.String(64), nullable=False, unique=True) 
    class_rel = db.relationship('Class') 
    attendance_records = db.relationship('Attendance', backref='session', lazy=True)
    device_sessions = db.relationship('DeviceSession', backref='session', lazy=True)
    __table_args__ = (db.UniqueConstraint('class_id', 'date', 'semester', name='_class_date_semester_uc'),)

class Enrollment(db.Model): 
    __tablename__ = 'enrollments'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    __table_args__ = (db.UniqueConstraint('student_id', 'class_id', name='_student_class_uc'),)

class Attendance(db.Model): 
    __tablename__ = 'attendance'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.id'), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    device_fingerprint = db.Column(db.Text)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    __table_args__ = (db.UniqueConstraint('student_id', 'session_id', name='_student_session_uc'),)

class DeviceSession(db.Model): 
    __tablename__ = 'device_sessions'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.id'), nullable=False)
    device_fingerprint = db.Column(db.Text, nullable=False)
    first_scan_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    scan_count = db.Column(db.Integer, default=1)
    student_ids_scanned = db.Column(db.Text) 
    __table_args__ = (db.UniqueConstraint('session_id', 'device_fingerprint', name='_session_device_uc'),)